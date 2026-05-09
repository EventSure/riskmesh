# `track_b.rs` 상세 설명

> Legacy note: 이 문서는 구 `Policy` / `check_oracle_and_create_claim` 기반 Track B를 설명합니다.
> 현재 구현은 `FlightPolicy` / `check_oracle_and_resolve_flight`와 Switchboard quote 검증 경로를 사용합니다.
> 최신 운영 흐름은 `backend/docs/backend-overview.md`의 Track B 섹션을 기준으로 보세요.

이 문서는 [track_b.rs](../src/oracle/track_b.rs)를 중심으로, Track B 오라클 파이프라인이 어떤 역할을 하고 어떤 순서로 동작하는지 설명합니다.

Track B는 Switchboard On-Demand 오라클을 사용하는 경로입니다.  
핵심 목표는 다음 한 줄로 요약할 수 있습니다.

> 온체인의 `Policy` 계정을 스캔하고, 출발 시각이 지난 정책에 대해 Switchboard 업데이트를 받아 `check_oracle_and_create_claim` 트랜잭션을 전송한다.

## 1. Track B가 어디서 호출되는가

Track B는 스케줄러 사이클 안에서 실행됩니다.

관련 코드는 [scheduler.rs](../src/scheduler.rs#L35)에 있습니다.

흐름:

1. `SolanaClient` 생성
2. 리더 키페어 로드
3. `track_b::scan_active_policies(...)` 호출
4. 활성 정책마다 `track_b::run(...)` 호출

즉 `track_b.rs`는 혼자 실행되는 파일이 아니라, 스케줄러가 주기적으로 호출하는 “Track B 처리기”입니다.

### `SolanaClient`가 무엇인가

스케줄러는 먼저 [scheduler.rs](../src/scheduler.rs#L42)에서 `SolanaClient`를 만듭니다.

```rust
let client = SolanaClient::new(&config.rpc_url);
```

`SolanaClient`는 [client.rs](../src/solana/client.rs#L18)에 정의된, 이 프로젝트 전용 Solana RPC 래퍼입니다.

쉽게 말하면:

- Solana 체인에서 계정을 읽고
- 슬롯을 조회하고
- 트랜잭션을 전송하는

공용 “체인 접근 창구”입니다.

내부적으로는 Solana 공식 `RpcClient`를 감싸고 있습니다.

```rust
pub struct SolanaClient {
    pub rpc: RpcClient,
}
```

즉 `track_b.rs`는 체인과 직접 통신하지 않고, `SolanaClient`를 통해:

- `get_program_accounts`
- `get_slot`
- `send_v0_transaction`

같은 동작을 수행합니다.

비유하면 `SolanaClient`는 “백엔드가 Solana 네트워크와 대화할 때 쓰는 전용 통신 도구”입니다.

### 리더 키페어가 무엇인가

그 다음 스케줄러는 [scheduler.rs](../src/scheduler.rs#L44)에서 리더 키페어를 파일에서 읽습니다.

```rust
let keypair_path = shellexpand::tilde(&config.leader_keypair_path).to_string();
let leader = read_keypair_file(&keypair_path)?;
```

여기서 리더 키페어는:

- 공개키 `pubkey`
- 비밀키 `secret key`

를 함께 가진 서명용 계정입니다.

이 프로젝트에서 리더 키페어의 역할은 크게 두 가지입니다.

1. 이 백엔드가 어떤 `leader`의 정책을 담당하는지 나타냄
2. 온체인 트랜잭션에 실제 서명하는 주체가 됨

즉 `leader_pubkey`는 “누구 정책을 처리할지 구분하는 공개 식별자”이고,  
리더 키페어는 “그 공개키에 대응하는 실제 서명 권한”입니다.

Track B에서 이 키페어가 필요한 이유는 최종적으로 다음 코드에서 트랜잭션 서명자로 쓰이기 때문입니다.

```rust
client.send_v0_transaction(instructions, &oracle_update.luts, leader)
```

정리하면:

- `SolanaClient`: Solana RPC 읽기/쓰기 담당
- 리더 키페어: 트랜잭션 서명 담당

둘은 함께 있어야 Track B가 “조회 + 검증 + 트랜잭션 제출”까지 끝낼 수 있습니다.

## 1-1. `Config`의 핵심 필드 4개

Track B를 이해할 때 자주 헷갈리는 설정이 [config.rs](../src/config.rs) 의 아래 4개입니다.

```rust
pub program_id: Pubkey,
pub leader_keypair_path: String,
pub leader_pubkey: Pubkey,
pub switchboard_queue: Pubkey,
```

이 값들은 모두 `Config::from_env()`에서 환경변수로 읽습니다.

- `program_id`: 우리 온체인 프로그램 주소입니다.
  Track B는 이 주소를 기준으로 `get_program_accounts`를 호출해 `Policy` 계정을 찾고, 마지막에 `check_oracle_and_create_claim` instruction을 만들 때도 이 프로그램 ID를 사용합니다.
  쉽게 말하면 “어느 Solana 프로그램의 정책을 읽고 호출할 것인가”를 정하는 값입니다.

- `leader_keypair_path`: 리더 서명자 키페어 파일 경로입니다.
  스케줄러는 이 경로에서 실제 키페어 JSON 파일을 읽고, 그 비밀키로 트랜잭션에 서명합니다.
  즉 `leader_pubkey`가 공개 식별자라면, `leader_keypair_path`는 그 공개키에 대응하는 실제 서명 권한을 꺼내오는 위치입니다.

- `leader_pubkey`: 현재 이 백엔드가 담당하는 리더의 공개키입니다.
  Track B는 온체인에서 `Policy`를 전부 읽은 뒤, 각 정책의 `leader` 필드가 이 값과 같은지 검사해서 처리 대상을 걸러냅니다.
  즉 “이 서버가 어떤 리더 소속 정책만 담당할지”를 정하는 필터 기준입니다.

- `switchboard_queue`: Switchboard On-Demand queue 주소입니다.
  Track B는 오라클 업데이트를 받을 때 feed 주소만 넘기는 것이 아니라, 어떤 queue 기준으로 검증할지도 함께 넘깁니다.
  그리고 최종 `check_oracle_and_create_claim` instruction에서도 queue 계정을 계정 목록에 포함합니다.
  쉽게 말하면 “어느 Switchboard 큐에서 나온 오라클 업데이트를 신뢰할 것인가”를 지정하는 값입니다.

한 줄로 요약하면:

- `program_id`: 우리 프로그램 주소
- `leader_keypair_path`: 서명용 개인키 파일 위치
- `leader_pubkey`: 담당 리더 공개키
- `switchboard_queue`: 사용할 Switchboard 큐 주소

Track B는 이 네 값을 가지고:

1. `program_id`로 정책 계정을 찾고
2. `leader_pubkey`로 내 담당 정책만 고르고
3. `switchboard_queue`로 오라클 업데이트를 검증하고
4. `leader_keypair_path`에서 읽은 키페어로 최종 트랜잭션에 서명합니다.

## 1-2. `program`, `leader`, `정책`, `내 담당 정책`의 뜻

처음 보면 이 네 단어가 서로 비슷하게 보여서 헷갈리기 쉽습니다.  
Track B 문맥에서는 아래처럼 이해하면 됩니다.

- `program(id)`: 정책들을 관리하는 온체인 프로그램 자체
- `leader(pubkey)`: 여러 정책 중 어떤 리더 소속인지 구분하는 주체
- `정책(Policy)`: 실제 보험 가입 1건을 나타내는 온체인 계정
- `내 담당 정책`: 그중 `leader` 값이 내 `leader_pubkey`와 같은 정책

비유하면:

- `program`은 “보험 회사의 전산 시스템”
- `leader`는 “그 시스템 안에서 특정 고객군을 맡은 담당자”
- `정책(Policy)`은 “개별 보험 계약서 1장”
- `내 담당 정책`은 “그 담당자 이름이 적혀 있는 계약서들”

### `program_id`가 뜻하는 것

`program_id`는 Solana 상의 “우리 백엔드가 상대하는 스마트 컨트랙트 주소”입니다.

예를 들어:

- `program_id = Risk111111111111111111111111111111111111`

라고 해보겠습니다.

그러면 Track B는:

- “`Risk111...` 프로그램이 소유한 계정들을 읽어오고”
- 그중에서 `Policy` 타입 계정만 골라내고
- 마지막에도 다시 그 `Risk111...` 프로그램의 instruction을 호출합니다.

즉 `program_id`는 “어느 앱의 데이터와 로직을 볼 것인가”를 정합니다.

쉽게 말하면:

- `program_id`가 다르면
- 아예 다른 프로그램의 계정을 보게 되고
- 지금 보험 정책이라고 부르는 데이터도 찾지 못할 수 있습니다.

### `leader_pubkey`가 뜻하는 것

`leader_pubkey`는 “이 백엔드가 누구 소속 정책을 맡는가”를 나타내는 공개키입니다.

예를 들어:

- 내 `leader_pubkey = LeaderAAA111`

라고 해보겠습니다.

그러면 Track B는 `Policy`를 읽을 때 각 정책 안에 들어있는 `leader` 필드를 보고:

- `policy.leader == LeaderAAA111` 이면 처리 대상
- `policy.leader != LeaderAAA111` 이면 스킵

합니다.

즉 `leader_pubkey`는 “내 담당 범위”를 정하는 필터입니다.

### `정책(Policy)`이 뜻하는 것

정책은 보험 가입 한 건입니다.

예를 들어 아래 3개 정책이 있다고 해보겠습니다.

```text
Policy #101: leader=LeaderAAA111, flight=KE123, departure=2026-03-22 09:00
Policy #102: leader=LeaderBBB222, flight=OZ701, departure=2026-03-22 11:00
Policy #103: leader=LeaderAAA111, flight=LJ045, departure=2026-03-22 13:00
```

각 정책은 온체인에 따로 저장된 계정 1개입니다.  
즉 “정책”은 추상 개념이 아니라, Solana에 실제로 존재하는 `Policy account` 하나입니다.

### `내 담당 정책`이 뜻하는 것

위 예시에서 내 `leader_pubkey`가 `LeaderAAA111`이라면, 내 담당 정책은:

- `Policy #101`
- `Policy #103`

입니다.

반대로:

- `Policy #102`

는 `leader=LeaderBBB222` 이므로 내가 처리하지 않습니다.

즉 “내 담당 정책”이란 특별한 새로운 타입이 아니라:

- 전체 정책 목록 중에서
- `policy.leader == 내 leader_pubkey`

조건을 만족하는 정책만 따로 부르는 말입니다.

### 실제 Track B 흐름에 대입하면

Track B는 대략 아래 순서로 생각하면 됩니다.

1. `program_id`로 우리 프로그램의 계정들을 전부 읽는다.
2. 그중 `Policy` 계정만 찾는다.
3. 그 `Policy` 중에서 `leader == leader_pubkey` 인 것만 남긴다.
4. 그 남은 정책이 바로 “내 담당 정책”이다.
5. 출발 시간이 지난 내 담당 정책에 대해서만 오라클 조회와 claim 생성을 진행한다.

짧은 예시로 다시 쓰면:

```text
program_id = 보험 프로그램 주소
leader_pubkey = LeaderAAA111

온체인 전체 정책:
- Policy #101 (LeaderAAA111)
- Policy #102 (LeaderBBB222)
- Policy #103 (LeaderAAA111)

필터링 결과:
- 내 담당 정책 = #101, #103
- 남의 담당 정책 = #102
```

핵심은 이것입니다.

- `program_id`는 “어느 프로그램을 볼지”
- `leader_pubkey`는 “그 안에서 누구 몫만 처리할지”
- `Policy`는 “보험 가입 1건”
- `내 담당 정책`은 “그 보험 가입들 중 내 리더 주소가 적힌 것”

## 2. 파일의 큰 역할

[track_b.rs](../src/oracle/track_b.rs)는 크게 4가지 책임을 가집니다.

1. 온체인에서 Track B용 `Policy` 계정을 찾기
2. 계정 바이트를 읽어서 필요한 필드를 파싱하기
3. Switchboard Crossbar에서 오라클 업데이트를 받아오기
4. 온체인 프로그램 호출용 instruction을 만들어 트랜잭션으로 전송하기

## 3. 파일 상단 주석의 의미

파일 첫머리 주석 [track_b.rs](../src/oracle/track_b.rs#L1)는 전체 로직을 아주 압축해서 적어둔 것입니다.

```rust
/// 흐름:
///   1. getProgramAccounts로 Active(state=3) Policy 목록 조회
///   2. Switchboard Crossbar API에서 오라클 업데이트(Ed25519 서명) 수신
///   3. [Ed25519 ix, verified_update ix, check_oracle_and_create_claim ix] 트랜잭션 전송
```

이 주석이 사실상 Track B 전체입니다.

## 4. `PolicyInfo` 구조체

[track_b.rs](../src/oracle/track_b.rs#L22)의 `PolicyInfo`는 온체인 `Policy` 계정 전체를 다 들고 있지 않고, Track B 실행에 필요한 최소 정보만 뽑아서 저장합니다.

```rust
pub struct PolicyInfo {
    pub pubkey: Pubkey,
    pub policy_id: u64,
    pub leader: Pubkey,
    pub flight_no: String,
    pub departure_date: i64,
    pub oracle_feed: Pubkey,
    pub state: u8,
}
```

각 필드 의미:

- `pubkey`: Policy 계정 주소
- `policy_id`: 정책 ID
- `leader`: 이 정책을 관리하는 리더 주소
- `flight_no`: 로그 출력과 식별에 쓰는 항공편 번호
- `departure_date`: 출발 예정 시각 Unix timestamp
- `oracle_feed`: Switchboard feed 주소
- `state`: Policy 상태 값

중요한 점은 이 구조체가 “온체인 계정의 일부를 읽어온 파생 데이터”라는 점입니다.  
즉, 실제 원본은 Solana account data이고, `PolicyInfo`는 그 바이트를 해석한 결과입니다.

## 5. `scan_active_policies()`: 처리 대상 찾기

[track_b.rs](../src/oracle/track_b.rs#L35)의 `scan_active_policies()`는 Track B 처리 대상을 수집하는 함수입니다.

시그니처:

```rust
pub fn scan_active_policies(
    client: &SolanaClient,
    program_id: &Pubkey,
    leader_pubkey: &Pubkey,
) -> Result<Vec<PolicyInfo>>
```

입력:

- `client`: Solana RPC 호출용 클라이언트
- `program_id`: 우리 온체인 프로그램 ID
- `leader_pubkey`: 현재 백엔드가 담당하는 리더 주소

출력:

- 조건에 맞는 `PolicyInfo` 목록

### 5-1. `getProgramAccounts`로 프로그램 계정 전체 조회

```rust
let accounts = client
    .rpc
    .get_program_accounts(program_id)
    .context("Policy getProgramAccounts 실패")?;
```

이 코드는 해당 프로그램이 소유한 모든 계정을 가져옵니다.

여기서는 `SolanaClient`의 래퍼 메서드를 쓰지 않고 내부의 `client.rpc`를 직접 사용하고 있습니다.  
즉 “program_id 소유 계정 전체를 긁어온 뒤, Rust 코드에서 직접 선별하겠다”는 방식입니다.

### 5-2. discriminator 검사

```rust
if account.data.len() < 8 {
    continue;
}

let disc = crate::oracle::track_a::anchor_account_discriminator("Policy");
if account.data[..8] != disc {
    continue;
}
```

Anchor 계정은 앞 8바이트에 account discriminator가 들어갑니다.  
여기서는 “이 계정이 정말 `Policy` 타입인가?”를 먼저 검사합니다.

즉 같은 프로그램 소유 계정이어도:

- `Policy`가 아닌 계정
- 데이터 길이가 너무 짧은 계정

은 전부 건너뜁니다.

### 5-3. `parse_policy()`로 바이트 파싱

discriminator를 통과한 계정은 `parse_policy()`로 넘깁니다.

```rust
match parse_policy(&pubkey, &account.data) {
    Ok(info)
        if info.state == POLICY_STATE_ACTIVE
            && info.leader == *leader_pubkey =>
    {
        result.push(info);
    }
    Ok(_) => {}
    Err(e) => {
        tracing::warn!("[track_b] Policy 파싱 실패 {pubkey}: {e}");
    }
}
```

여기서 최종 필터링 조건은 두 가지입니다.

- `state == POLICY_STATE_ACTIVE`
- `leader == leader_pubkey`

즉 Track B는 “활성 상태이면서 현재 백엔드 리더가 담당하는 Policy만” 대상으로 삼습니다.

## 6. `parse_policy()`: 온체인 바이트를 구조체로 해석

[track_b.rs](../src/oracle/track_b.rs#L77)의 `parse_policy()`는 raw bytes를 `PolicyInfo`로 바꾸는 함수입니다.

```rust
fn parse_policy(pubkey: &Pubkey, data: &[u8]) -> Result<PolicyInfo>
```

이 함수는 Borsh 레이아웃을 “수동으로” 읽습니다.  
즉 `borsh::try_from_slice()` 같은 자동 역직렬화 대신, 바이트 오프셋을 직접 전진시키며 필요한 필드를 읽습니다.

### 6-1. 왜 수동 파싱을 하나

Track B의 `Policy` 구조에는 문자열처럼 길이가 가변인 필드가 있습니다.

주석에도 적혀 있듯이:

```rust
/// discriminator[8], policy_id[8], leader[32], route[4+len], flight_no[4+len],
/// departure_date[8], delay_threshold_min[2], payout_amount[8],
/// currency_mint[32], oracle_feed[32], state[1], ...
```

`route`, `flight_no`가 가변 길이라 fixed offset으로 읽기 어렵습니다.  
그래서 offset을 움직이며 순서대로 읽는 방식이 필요합니다.

### 6-2. 실제 읽는 순서

```rust
let mut offset = 8usize; // skip discriminator

let policy_id = read_u64(data, &mut offset)?;
let leader = read_pubkey(data, &mut offset)?;
let _route = read_string(data, &mut offset)?;
let flight_no = read_string(data, &mut offset)?;
let departure_date = read_i64(data, &mut offset)?;
let _delay_threshold = read_u16(data, &mut offset)?;
let _payout_amount = read_u64(data, &mut offset)?;
let _currency_mint = read_pubkey(data, &mut offset)?;
let oracle_feed = read_pubkey(data, &mut offset)?;
let state = read_u8(data, &mut offset)?;
```

여기서 `_route`, `_delay_threshold`, `_payout_amount`, `_currency_mint`처럼 `_`로 시작하는 변수는 읽긴 하지만 이후 로직에서 쓰지 않는 값입니다.

즉 이 함수의 목적은 “계정 전체를 완벽히 모델링”하는 게 아니라, Track B 실행에 필요한 필드만 확보하는 것입니다.

## 7. `run()`: Policy 1개 실제 처리

[track_b.rs](../src/oracle/track_b.rs#L106)의 `run()`은 `PolicyInfo` 하나를 받아 실제 오라클 처리까지 수행합니다.

시그니처:

```rust
pub async fn run(
    config: &Config,
    client: &SolanaClient,
    leader: &solana_sdk::signature::Keypair,
    policy: &PolicyInfo,
) -> Result<()>
```

입력:

- `config`: 환경설정
- `client`: Solana RPC 클라이언트
- `leader`: 트랜잭션 서명자 키페어
- `policy`: 처리 대상 Policy

### 7-1. 출발 전이면 스킵

```rust
let now = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)?
    .as_secs() as i64;

if now < policy.departure_date {
    tracing::info!(
        "[track_b] {} 아직 출발 전 (departure_ts={}), 스킵",
        policy.flight_no,
        policy.departure_date
    );
    return Ok(());
}
```

Track B는 출발 시각이 지나기 전에는 오라클을 실행하지 않습니다.  
즉 “비행이 아직 출발도 안 했는데 결과를 확정하지 않겠다”는 보호 로직입니다.

### 7-2. Switchboard Crossbar에서 업데이트 수신

```rust
let oracle_update =
    switchboard::fetch_oracle_update(&config.switchboard_queue, &policy.oracle_feed, &client.rpc)
        .await
        .context("Switchboard oracle update 수신 실패")?;
```

이 부분은 당시 `backend/src/switchboard.rs` 구현으로 넘어가서 Crossbar HTTP API를 호출했습니다. 현재 Track B 구현에서는 이 파일을 제거했고, `contract/scripts/05b-claim.ts`가 per-flight feed quote를 조회합니다.

받아오는 값은 `OracleUpdate`이며 주요 내용은:

- `ed25519_ix`
- `verified_update_ix`
- `luts`
- `value`

의미:

- `ed25519_ix`: 오라클 서명 검증 instruction
- `verified_update_ix`: feed 업데이트 반영 instruction
- `luts`: v0 트랜잭션용 Address Lookup Tables
- `value`: 오라클이 보고한 지연 분 값

즉 여기서 백엔드는 “지연 시간이 몇 분인지”만 받는 게 아니라, 온체인 검증에 필요한 instruction 세트까지 함께 받습니다.

### 7-3. 현재 슬롯으로 `oracle_round` 결정

```rust
let oracle_round = client.get_slot()?;
let (claim_key, _) = claim_pda(&config.program_id, &policy.pubkey, oracle_round);
```

여기서는 현재 슬롯을 `oracle_round`로 사용합니다.

이 값은 Claim PDA seed에도 들어갑니다.  
관련 PDA 정의는 [pda.rs](../src/solana/pda.rs#L11)에 있습니다.

```rust
["claim", policy, oracle_round_le8]
```

즉 같은 Policy라도 어떤 oracle round에서 생성된 claim인지에 따라 PDA가 달라집니다.

### 7-4. 우리 프로그램 instruction 생성

```rust
let our_ix = build_check_oracle_ix(
    &config.program_id,
    &policy.pubkey,
    &claim_key,
    &leader.pubkey(),
    &policy.oracle_feed,
    &config.switchboard_queue,
    oracle_round,
)?;
```

이 instruction은 우리 온체인 프로그램의 `check_oracle_and_create_claim` 호출입니다.

즉 Track B는 단순 조회가 아니라:

1. Switchboard가 준 증거를 트랜잭션에 포함하고
2. 우리 프로그램이 그것을 검증한 뒤
3. claim 생성까지 이어지게 하는 구조입니다

### 7-5. instruction 순서가 매우 중요

```rust
let instructions = vec![
    oracle_update.ed25519_ix,
    oracle_update.verified_update_ix,
    our_ix,
];
```

주석에도 적혀 있듯 이 순서는 필수입니다.

1. `Ed25519` 서명 검증
2. `verified_update`
3. `check_oracle_and_create_claim`

이 순서가 필요한 이유는 온체인 프로그램이 앞선 instruction들의 결과를 참조해 오라클 데이터의 유효성을 확인하기 때문입니다.  
순서가 바뀌면 검증 실패 가능성이 높습니다.

### 7-6. v0 트랜잭션 전송

```rust
let sig = client
    .send_v0_transaction(instructions, &oracle_update.luts, leader)
    .context("check_oracle_and_create_claim 트랜잭션 실패")?;
```

Track B는 LUT를 포함할 수 있기 때문에 legacy transaction이 아니라 v0 transaction을 사용합니다.  
이 부분은 [client.rs](../src/solana/client.rs#L65)의 `send_v0_transaction()`이 담당합니다.

## 8. `build_check_oracle_ix()`: Anchor instruction 수동 조립

[track_b.rs](../src/oracle/track_b.rs#L179)의 `build_check_oracle_ix()`는 우리 프로그램 호출용 `Instruction`을 직접 만듭니다.

### 8-1. discriminator 생성

```rust
let discriminator =
    anchor_instruction_discriminator("check_oracle_and_create_claim");
```

Anchor 프로그램 호출 시 instruction data의 앞 8바이트는 instruction discriminator입니다.

여기서는 `check_oracle_and_create_claim`의 discriminator를 구해서 data의 앞부분에 넣습니다.

### 8-2. args 직렬화

```rust
let mut data = discriminator.to_vec();
data.extend_from_slice(&oracle_round.to_le_bytes());
```

이 instruction의 인자는 `oracle_round: u64` 하나뿐이라서, discriminator 뒤에 little-endian 바이트를 붙입니다.

즉 이 함수는 Anchor client를 쓰지 않고, instruction data를 수동으로 조립하고 있습니다.

### 8-3. 계정 메타 구성

```rust
accounts: vec![
    AccountMeta::new(*policy, false),
    AccountMeta::new(*claim, false),
    AccountMeta::new(*payer, true),
    AccountMeta::new_readonly(*oracle_feed, false),
    AccountMeta::new_readonly(*queue, false),
    AccountMeta::new_readonly(slot_hashes_sysvar, false),
    AccountMeta::new_readonly(instructions_sysvar, false),
    AccountMeta::new_readonly(solana_sdk::system_program::id(), false),
],
```

각 계정 의미:

- `policy`: 대상 Policy 계정
- `claim`: 생성될 Claim PDA
- `payer`: 트랜잭션 수수료 및 생성 비용을 낼 서명자
- `oracle_feed`: Switchboard feed 계정
- `queue`: Switchboard queue 계정
- `slot_hashes_sysvar`: Switchboard 검증에 필요한 sysvar
- `instructions_sysvar`: 앞선 instruction 참조용 sysvar
- `system_program`: 계정 생성 등 시스템 호출용

특히 `instructions_sysvar`는 앞서 들어간 `Ed25519`, `verified_update` instruction을 온체인에서 검증할 때 중요합니다.

## 9. Track B 전체 흐름 요약

한 번의 정책 처리 흐름은 아래와 같습니다.

1. 프로그램 소유 계정 전체 조회
2. `Policy` discriminator 검사
3. Policy 바이트 파싱
4. `state == Active` 및 `leader` 일치 여부 검사
5. 출발 시각이 지났는지 검사
6. Switchboard Crossbar에서 오라클 업데이트 instruction 수신
7. 현재 슬롯으로 `oracle_round` 결정
8. Claim PDA 계산
9. `check_oracle_and_create_claim` instruction 수동 생성
10. `[ed25519, verified_update, our_ix]` 순서로 v0 트랜잭션 전송

## 10. 왜 Track B가 이렇게 복잡한가

Track B는 단순히 “API에서 숫자를 받아서 온체인에 쓰는” 구조가 아닙니다.

핵심은 오라클 값의 신뢰성입니다.

- 백엔드가 임의로 값을 넣는 게 아니라
- Switchboard가 서명한 업데이트를 받고
- 그 증거를 instruction 형태로 트랜잭션에 포함하고
- 온체인 프로그램이 그 증거를 검증한 뒤
- claim 생성 여부를 결정합니다

즉 백엔드는 “오라클 값을 직접 판정하는 주체”라기보다,  
“검증 가능한 오라클 업데이트를 가져와 온체인 프로그램이 처리하도록 전달하는 중개자”에 가깝습니다.

## 11. 읽을 때 특히 헷갈리기 쉬운 포인트

### `client.rpc.get_program_accounts(...)`를 직접 쓰는 이유

`SolanaClient`에 helper 메서드가 일부 있지만, 여기서는 프로그램 계정 전체 조회 후 수동 파싱이 필요해서 내부 `RpcClient`를 직접 사용합니다.

### 왜 `policy_id`를 읽는데 당장 안 쓰는가

현재 `run()` 안에서는 `policy.pubkey`와 `claim_pda()`가 더 중요해서 직접 쓰이지 않습니다.  
하지만 Policy 식별 정보로서 가치가 있고, PDA 계산이나 디버깅 확장 때 필요할 수 있습니다.

### 왜 `oracle_round`를 현재 슬롯으로 잡는가

Claim PDA seed를 round별로 구분하기 위한 용도입니다.  
즉 같은 Policy에서 여러 오라클 처리 시도나 라운드를 분리할 수 있게 합니다.

### 왜 `send_v0_transaction()`을 쓰는가

Switchboard Crossbar 응답에 LUT가 포함될 수 있기 때문입니다.  
Track B는 이 LUT를 써야 할 수 있으므로 v0 transaction 경로를 사용합니다.

## 12. 관련 파일 같이 보면 좋은 것

- [backend/src/oracle/track_b.rs](../src/oracle/track_b.rs)
- `backend/src/switchboard.rs` (legacy, removed)
- [backend/src/solana/client.rs](../src/solana/client.rs)
- [backend/src/solana/pda.rs](../src/solana/pda.rs)
- [backend/src/scheduler.rs](../src/scheduler.rs)

## 13. 한 줄 정리

`track_b.rs`는 “활성 Policy를 찾아, 출발 이후 Switchboard 오라클 증거를 받아, 이를 검증 가능한 v0 트랜잭션으로 온체인 프로그램에 전달하는 모듈”입니다.

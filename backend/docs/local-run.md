# Backend 로컬 실행 가이드

이 문서는 `riskmesh` 백엔드를 로컬에서 실행하는 가장 빠른 방법을 정리합니다.

현재 백엔드는 한 프로세스에서 아래 두 역할을 함께 수행합니다.

- 주기적으로 오라클 체크를 수행하는 스케줄러
- `/health` 엔드포인트를 제공하는 Axum 웹서버

## 1. 실행 위치

모든 명령은 이 저장소의 `riskmesh/backend` 디렉터리에서 실행합니다.

즉, 먼저 `riskmesh` 프로젝트 루트로 이동한 뒤 `backend`로 들어가면 됩니다.

```bash
cd riskmesh/backend
```

## 2. 실행 전 준비

Rust와 Cargo가 설치되어 있어야 합니다.

추가로 Solana 키페어 파일 경로가 필요합니다.

- 기본값: `~/.config/solana/id.json`
- 다른 키를 쓰고 싶으면 `.env`의 `LEADER_KEYPAIR_PATH`를 바꾸면 됩니다.

## 3. `.env` 파일 만들기

먼저 예제 파일을 복사합니다.

```bash
cp .env.example .env
```

그 다음 `.env`를 열어 값을 확인하거나 수정합니다.

예시:

```dotenv
# Solana
RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=BXxqMY3f9y7dzvoQWJjhX95GMEyuRjD61kgfgherhSX7
LEADER_KEYPAIR_PATH=~/.config/solana/id.json
LEADER_PUBKEY=여기에_리더_퍼블릭키

# AviationStack (Track A)
AVIATIONSTACK_API_KEY=

# Switchboard (Track B)
SWITCHBOARD_QUEUE=FDPU9SHFSBCXNFHtY3DW8EkFQjeBH6vZwqHqFfxNWZkM

# 스케줄러 실행 간격
ORACLE_CHECK_CRON=0 */15 * * * *

# 웹서버 바인드 주소
WEB_BIND_ADDR=0.0.0.0:3000
```

### 필수 값

아래 값이 없으면 실행 초기에 실패합니다.

- `PROGRAM_ID`
- `LEADER_PUBKEY`
- `SWITCHBOARD_QUEUE`

### 선택 값

- `RPC_URL`
  기본값은 `https://api.devnet.solana.com`
- `LEADER_KEYPAIR_PATH`
  기본값은 `~/.config/solana/id.json`
- `AVIATIONSTACK_API_KEY`
  Track A를 사용할 때 필요합니다
- `ORACLE_CHECK_CRON`
  기본값은 `0 */15 * * * *`
- `WEB_BIND_ADDR`
  기본값은 `0.0.0.0:3000`

테스트를 빨리 보고 싶다면 cron을 1분 주기로 바꿔도 됩니다.

```dotenv
ORACLE_CHECK_CRON=0 * * * * *
```

## 4. 개발 모드로 실행

가장 간단한 실행 방법입니다.

```bash
RUST_LOG=info cargo run --bin oracle-daemon
```

설명:

- `RUST_LOG=info`: 기본 로그 레벨 설정
- `cargo run --bin oracle-daemon`: 현재 백엔드 바이너리 실행

로그를 더 자세히 보고 싶다면:

```bash
RUST_LOG=debug cargo run --bin oracle-daemon
```

## 5. 릴리즈 모드로 실행

성능에 더 가까운 형태로 실행하려면:

```bash
cargo build --release
RUST_LOG=info ./target/release/oracle-daemon
```

## 6. 실행 후 확인 방법

정상적으로 실행되면 콘솔에 다음과 비슷한 로그가 보입니다.

- 백엔드 시작 로그
- 웹서버 listen 로그
- 스케줄러 시작 로그

웹서버 확인:

```bash
curl http://localhost:3000/health
```

정상 응답 예시:

```json
{
  "status": "ok",
  "service": "riskmesh-backend",
  "rpc_url": "https://api.devnet.solana.com",
  "leader_pubkey": "..."
}
```

포트를 바꿨다면 `WEB_BIND_ADDR`에 맞춰 요청하면 됩니다.

예:

```bash
curl http://localhost:4000/health
```

## 7. 자주 발생하는 오류

### `PROGRAM_ID 환경변수 필요`

원인:

- `.env`가 없거나
- `PROGRAM_ID`가 비어 있음

해결:

- `cp .env.example .env`
- `.env`에 `PROGRAM_ID` 입력

### `LEADER_PUBKEY 환경변수 필요`

원인:

- `LEADER_PUBKEY`가 비어 있음

해결:

- 사용하는 키페어의 pubkey를 넣습니다
- 필요하면 `solana-keygen pubkey ~/.config/solana/id.json`로 확인합니다

### `키페어 파일 읽기 실패`

원인:

- `LEADER_KEYPAIR_PATH` 경로가 틀렸거나 파일이 없음

해결:

- 실제 키페어 파일 경로로 수정합니다

### `WEB_BIND_ADDR 파싱 실패`

원인:

- `WEB_BIND_ADDR` 형식이 잘못됨

해결:

- `0.0.0.0:3000`처럼 `호스트:포트` 형식으로 입력합니다

### `/health` 접속 실패

원인:

- 서버가 아직 뜨지 않았거나
- 포트가 다르거나
- 프로세스가 시작 중 에러로 종료됨

해결:

- 실행 로그 확인
- `WEB_BIND_ADDR` 확인
- `curl http://localhost:3000/health` 재시도

## 8. 빠른 실행 요약

처음부터 빠르게 실행하려면 아래 순서대로 하면 됩니다.

```bash
cd riskmesh/backend
cp .env.example .env
RUST_LOG=info cargo run --bin oracle-daemon
```

그리고 다른 터미널에서:

```bash
curl http://localhost:3000/health
```

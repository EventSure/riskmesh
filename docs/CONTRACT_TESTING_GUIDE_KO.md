# 컨트랙트 테스트 가이드 (단계별)

## 1. 목적
마스터 계약 + 개별 항공 지연 보험 구조 변경 작업을 단계별로 검증하기 위한 실행 가이드.

## 2. 현재 환경에서 즉시 실행 가능한 테스트

### 2.1 정산 수식/티어 검증 (Node 내장 테스트)
실행 명령:
```bash
node --test contract/tests/master_settlement_logic.test.mjs
```

검증 항목:
1. 출재 50%, 수수료 10%일 때 재보험 실질 비율 45%
2. Claim 정산 45:55 + 원수사 5:3:2 분배
3. Premium 분배 45:55 + 원수사 5:3:2 분배
4. 지연 티어(2h/3h/4-5h/6h+ 또는 결항) 판정

## 3. 테스트 유형 정리 (Solana/Anchor 관례)

### 3.1 Rust 단위 테스트
- 위치: `contract/programs/open_parametric/src/**` 내부
- 방식:
  - 동일 파일 내 `#[cfg(test)] mod tests { ... }`
  - 또는 별도 파일로 분리 (예: `.../instructions/settle_flight_claim_test.rs`)
- 목적: 순수 계산/검증 로직을 빠르게 검증
- 실행: `cargo test -p open_parametric --lib`

### 3.2 Rust 통합 테스트 (program-test)
- 위치: `contract/programs/open_parametric/tests/**`
- 방식: `solana-program-test` 기반 (Rust)
- 목적: 프로그램 계정/Instruction/CPI 등을 통합 검증

### 3.3 Anchor TypeScript 테스트
- 위치: `contract/tests/**`
- 방식: `anchor test` (TS 기반 E2E)
- 목적: 실제 계정/토큰/서명 흐름을 통합 검증

## 4. Anchor/Rust 테스트 실행 준비
현재 작업 환경에는 `anchor`, `cargo`가 없어 직접 실행이 불가하다.

오류 확인:
- `anchor test` -> `command not found: anchor`
- `cargo test -p open_parametric --lib` -> `command not found: cargo`

필수 설치:
1. Rust toolchain (`cargo`)
2. Solana CLI
3. Anchor CLI

## 5. 설치 후 권장 테스트 순서

### 5.1 Rust 단위 테스트
```bash
cd contract
cargo test -p open_parametric --lib
```

대상:
- 순수 계산/검증 로직 (예: 정산 분배 로직)
- 예시: `contract/programs/open_parametric/src/instructions/settle_flight_claim_test.rs`

### 5.2 Anchor 통합 테스트
```bash
cd contract
anchor test
```

권장 추가 테스트(다음 단계 구현):
1. 마스터 생성 -> 참여사 지갑 등록 -> 컨펌 -> Operator 활성화
2. Child 생성(리더/Operator 권한)
3. Resolve 후 Claim 정산(리더 deposit 집금)
4. Resolve 후 NoClaim 보험료 분배(재보험 몫 포함)
5. 권한 위반/중복 정산/계정 매칭 오류 실패 케이스

## 6. 작업 단계별 테스트 매핑
1. 1단계(수식/티어 모듈): `node --test ...master_settlement_logic.test.mjs` + `cargo test`(설치 환경)
2. 2단계(상태 확장): `cargo test`로 컴파일/직렬화 검증
3. 3단계(마스터 인스트럭션): `anchor test` 마스터 플로우 시나리오
4. 4단계(개별 인스트럭션): `anchor test` Claim/NoClaim 정산 시나리오

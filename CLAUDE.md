# Open Parametric (RiskMesh)

Solana 기반 파라메트릭 보험 인프라 프로토콜. 항공편 지연 보험 MVP.

## Tech Stack
- **Smart Contract**: Rust, Anchor 0.30, Solana
- **Oracle**: Switchboard On-Demand (항공 지연 데이터)
- **Frontend**: Static HTML/CSS (프리뷰 목업)
- **Test**: TypeScript, Mocha (@coral-xyz/anchor)

## Project Structure
```
contract/                    # Anchor workspace
  programs/open_parametric/
    src/lib.rs               # 메인 프로그램 (11 instructions, 721 lines)
  tests/open_parametric.ts   # 테스트 (placeholder)
  Anchor.toml                # Anchor config (localnet)
frontend/
  index.html                 # MVP 콘솔 프리뷰
  style.css
OpenParametric.md            # 상세 설계 문서 (PRD + 온체인 설계)
```

## Key Concepts
- **Policy**: 보험상품 (노선, 항공편, 지연 기준, 정액 지급)
- **Underwriting**: 공동 인수 (리더사 + 참여사, ratio_bps 합계 10000)
- **RiskPool**: SPL 토큰 예치 풀 (vault = ATA)
- **Claim**: 오라클 기반 청구 (지연 >= 120분 시 생성)
- **PolicyholderRegistry**: 보험계약자 등록부

## State Machine
Policy: Draft -> Open -> Funded -> Active -> Claimable -> Approved -> Settled | Expired

## Build & Test
```bash
cd contract
anchor build
anchor test
anchor keys list  # Program ID 발급
```

## Conventions
- 한국어 커밋 메시지 사용
- 오라클 값은 10분 단위 (delay_min % 10 == 0)
- 인수 비율은 BPS (basis points, 10000 = 100%)
- PDA seeds: policy=[b"policy", leader, policy_id], underwriting=[b"underwriting", policy], pool=[b"pool", policy], claim=[b"claim", policy, oracle_round], registry=[b"registry", policy]

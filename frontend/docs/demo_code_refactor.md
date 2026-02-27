# Demo Code Refactor Guide

프로덕션 전환 시 제거/수정해야 할 데모 전용 코드 목록.
코드 내 `demo:` 또는 `TODO.demo:` 주석으로 표기됨.

---

## 1. 모듈 전체 제거

### `src/lib/demo-keypairs.ts`
- **역할**: 데모용 참여사 A/B 인메모리 키페어 + PDA-owned pool wallet pubkey 저장
- **프로덕션**: 모듈 전체 삭제. 각 참여사가 자체 지갑(Phantom 등)으로 서명.
- **의존 파일**:
  - `MasterContractSetup.tsx` → `generateDemoKeypairs`, `setPoolWallet`
  - `ParticipantConfirm.tsx` → `getDemoKeypair`, `getPoolWallet`

---

## 2. `MasterContractSetup.tsx` (tab-contract)

### 제거 대상

| 라인 | 코드 | 프로덕션 대안 |
|------|------|--------------|
| 12 | `import { generateDemoKeypairs, setPoolWallet }` | 삭제 |
| 52-53 | `generateDemoKeypairs()` — partA/B 랜덤 키페어 생성 | UI에서 참여사 지갑 주소(PublicKey) 입력받기 |
| 65-66 | `operatorKey = leaderKey`, `reinsurerKey = leaderKey` | 각 역할별 별도 지갑 주소 사용 |
| 69-78 | `SystemProgram.transfer` — 데모 키페어에 SOL 전송 (가스비) | 삭제. 각 참여사가 자체 SOL 보유 |
| 81-89 | `createAssociatedTokenAccountInstruction` — 데모 키페어 ATA 생성 | 삭제. 각 참여사가 자체 ATA 보유 |
| 122 | `cededRatioBps: 5000` (고정값) | UI 입력으로 변경 |
| 125-129 | `participants` 배열에 `partAKp.publicKey` 사용 | UI에서 입력받은 실제 PublicKey 사용 |
| 183-184 | `setPoolWallet('partA', ...)` | 삭제. 프로덕션에서는 참여사가 자체 pool 계정 제공 또는 on-chain에서 조회 |

### "Demo: Fund Pool" 버튼 (line ~244-300, ~318)
- `handleFundPools` 함수 전체 + UI 버튼 제거
- **프로덕션**: 참여사가 자체적으로 pool 계정에 USDC 입금 (또는 별도 deposit 인스트럭션)

### TX 구조 변경
- 현재: TX1 (pool+fund+ATA) → TX2 (createMaster+regLeader+confirmLeader)
- **프로덕션**: TX1 불필요 (데모 계정 생성 로직). createMasterPolicy만 별도 TX로 전송.
  pool 계정은 각 참여사가 생성하거나, leader가 init 후 참여사에게 알림.

---

## 3. `ParticipantConfirm.tsx` (tab-contract)

### 제거/수정 대상

| 라인 | 코드 | 프로덕션 대안 |
|------|------|--------------|
| 14 | `import { getDemoKeypair, getPoolWallet }` | 삭제 |
| 86 | `leader=reinsurer` 주석 | 별도 reinsurer 지갑 연결 |
| 110-160 | partA/B 데모 키페어 서명 블록 전체 | 각 참여사가 자체 지갑(Phantom)으로 서명. `provider.sendAndConfirm` 사용 |
| 112 | `getDemoKeypair(key)` | 삭제 |
| 126 | `getPoolWallet(key)` | on-chain master 데이터에서 pool_wallet 조회 또는 참여사 입력 |
| 157 | `tx.feePayer = demoKp.publicKey` | 참여사 지갑이 feePayer |
| 160 | `tx.sign(demoKp)` | Phantom 서명 팝업으로 전환 |

### 프로덕션 서명 플로우 (partA/B)
```typescript
// 현재 (데모): 인메모리 키페어로 프로그래밍 서명
const demoKp = getDemoKeypair(key);
tx.sign(demoKp);
const sig = await connection.sendRawTransaction(tx.serialize());

// 프로덕션: 각 참여사가 자체 Phantom 지갑으로 서명
// → 역할별 UI 분리 필요 (참여사 A 전용 페이지 등)
// → 또는 multi-party signing 워크플로우 구현
const sig = await provider.sendAndConfirm(tx, []);
```

---

## 4. `ClaimApproval.tsx` (tab-oracle)

| 라인 | 코드 | 프로덕션 대안 |
|------|------|--------------|
| 56 | `demo: pool 지갑에 USDC 잔액이 없으면...` 주석 | 삭제. 프로덕션에서는 pool에 실제 자금 존재 |

---

## 5. 프로덕션 전환 시 아키텍처 변경 포인트

### 역할 분리
- 현재: leader = operator = reinsurer (1인 3역)
- **프로덕션**: 각 역할별 별도 지갑 주소. UI에서 입력 또는 초대 링크로 연결

### 참여사 onboarding 플로우
- 현재: leader가 참여사 키페어를 직접 생성 + 서명
- **프로덕션**:
  1. Leader가 마스터계약 생성 (참여사 PublicKey 지정)
  2. 참여사에게 알림 (이메일/링크)
  3. 참여사가 자체 지갑으로 접속 → `registerParticipantWallets` + `confirmMaster` 서명
  4. 각 참여사가 자체 pool 계정에 자금 입금

### Pool 계정 관리
- 현재: leader가 PDA-owned pool 계정 생성 + USDC 충전
- **프로덕션**: 참여사가 자체 PDA-owned pool 계정 생성하거나, 프로토콜이 자동 생성

### 데모 키페어 검색 패턴
```bash
# 코드베이스에서 데모 관련 코드 전체 검색
grep -rn "demo:" --include="*.ts" --include="*.tsx" src/
grep -rn "getDemoKeypair\|generateDemoKeypairs\|setPoolWallet\|getPoolWallet" src/
```

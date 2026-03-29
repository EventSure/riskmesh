// Pool wallet pubkey 캐시 — MasterContractSetup에서 생성한 PDA-owned pool 계정의 pubkey를
// ParticipantConfirm/Portal에서 registerParticipantWallets 시 참조하기 위한 인메모리 저장소
import { PublicKey } from '@solana/web3.js';

const poolWalletStore = new Map<string, PublicKey>();

/** PDA-owned pool wallet pubkey 저장 (handleSetTerms에서 생성 후 저장) */
export function setPoolWallet(role: string, pubkey: PublicKey): void {
  poolWalletStore.set(role, pubkey);
}

/** PDA-owned pool wallet pubkey 조회 */
export function getPoolWallet(role: string): PublicKey | undefined {
  return poolWalletStore.get(role);
}

export function clearPoolWallets(): void {
  poolWalletStore.clear();
}

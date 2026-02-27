// demo: 데모 전용 인메모리 키페어 저장소
// 프로덕션에서는 각 참여사가 자체 지갑(Phantom 등)으로 서명해야 하므로 이 모듈 전체 제거
import { Keypair, PublicKey } from '@solana/web3.js';

const store = new Map<string, Keypair>();
const poolWalletStore = new Map<string, PublicKey>();

/** 데모용 참여사 A, B 키페어 생성 (인메모리, 새로고침 시 소멸) */
export function generateDemoKeypairs(): { partA: Keypair; partB: Keypair } {
  const partA = Keypair.generate();
  const partB = Keypair.generate();
  store.set('partA', partA);
  store.set('partB', partB);
  return { partA, partB };
}

export function getDemoKeypair(role: 'partA' | 'partB'): Keypair | undefined {
  return store.get(role);
}

export function hasDemoKeypairs(): boolean {
  return store.has('partA') && store.has('partB');
}

/** PDA-owned pool wallet pubkey 저장 (handleSetTerms에서 생성 후 저장) */
export function setPoolWallet(role: string, pubkey: PublicKey): void {
  poolWalletStore.set(role, pubkey);
}

/** PDA-owned pool wallet pubkey 조회 (ParticipantConfirm에서 사용) */
export function getPoolWallet(role: string): PublicKey | undefined {
  return poolWalletStore.get(role);
}

export function clearDemoKeypairs(): void {
  store.clear();
  poolWalletStore.clear();
}

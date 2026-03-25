import { useEffect, useState, useCallback, useRef } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useProgram } from './useProgram';
import type { MasterPolicyAccount } from '@/lib/idl/open_parametric';

/**
 * Fetch and subscribe to a MasterPolicy account by its PDA address.
 */
export function useMasterPolicyAccount(masterPolicyPDA: PublicKey | null) {
  const { program, connection } = useProgram();
  const [account, setAccount] = useState<MasterPolicyAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // [FIX] PublicKey 객체는 매 렌더 새 인스턴스 → deps 불안정 → 무한 fetch 루프 (429)
  // string deps + ref로 안정화
  const pdaKey = masterPolicyPDA?.toBase58() ?? null;
  const pdaRef = useRef(masterPolicyPDA);
  pdaRef.current = masterPolicyPDA;

  const fetchAccount = useCallback(async () => {
    const pda = pdaRef.current;
    if (!program || !pda) {
      setAccount(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prog = program as any;
      const data = await prog.account.masterPolicy.fetch(pda);
      setAccount(data as MasterPolicyAccount);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('Account does not exist')) {
        setAccount(null);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [program, pdaKey]);

  // Initial fetch
  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  // [FIX] 기존: onAccountChange → fetchAccount() RPC 재호출 → 매 슬롯마다 요청 → 429
  // 수정: coder.decode()로 인라인 디코딩, RPC 호출 제거
  useEffect(() => {
    const pda = pdaRef.current;
    if (!connection || !program || !pda) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coder = (program as any).coder.accounts;
    const subscriptionId = connection.onAccountChange(
      pda,
      (accountInfo) => {
        try {
          const decoded = coder.decode('masterPolicy', accountInfo.data) as MasterPolicyAccount;
          setAccount(decoded);
        } catch {
          // Decode failed — ignore, polling/manual refetch will catch up
        }
      },
      'confirmed',
    );

    return () => {
      connection.removeAccountChangeListener(subscriptionId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, program, pdaKey]);

  return { account, loading, error, refetch: fetchAccount };
}

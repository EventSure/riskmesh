import { useMemo } from 'react';
import { useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import idl from '@/lib/idl/open_parametric.json';

export function useProgram() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const provider = useMemo(() => {
    if (!wallet) return null;
    return new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
    });
  }, [connection, wallet]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const program = useMemo<any>(() => {
    if (!provider) return null;
    try {
      return new Program(idl as never, provider);
    } catch {
      return null;
    }
  }, [provider]);

  return { program, provider, connection, wallet, connected: !!wallet };
}

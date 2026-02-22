import { useMemo } from 'react';
import { useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider } from '@coral-xyz/anchor';
import { PROGRAM_ID } from '@/lib/constants';

// TODO: Replace with generated IDL after `anchor build`
// import type { OpenParametric } from '@/lib/idl/open_parametric';
// import idl from '@/lib/idl/open_parametric.json';

export function useProgram() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const provider = useMemo(() => {
    if (!wallet) return null;
    return new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
    });
  }, [connection, wallet]);

  const program = useMemo(() => {
    if (!provider) return null;
    // TODO: Uncomment after IDL is generated
    // return new Program<OpenParametric>(idl as OpenParametric, PROGRAM_ID, provider);
    return { programId: PROGRAM_ID, provider };
  }, [provider]);

  return { program, provider, connected: !!wallet };
}

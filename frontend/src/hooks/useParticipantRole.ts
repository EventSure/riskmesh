import { useEffect, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useProgram } from './useProgram';
import type { MasterPolicyAccount, MasterParticipant } from '@/lib/idl/open_parametric';

export type ParticipantRole = 'leader' | 'partA' | 'partB' | 'rein' | null;

export interface ParticipantInfo {
  role: ParticipantRole;
  shareBps: number;
  confirmed: boolean;
  participantIndex: number;
}

/**
 * Detect all roles the connected wallet holds in a MasterPolicy.
 * A wallet may be leader + reinsurer, leader + participant, etc.
 * Returns an array of all matching roles.
 */
export function useParticipantRole(masterPolicyPDA: PublicKey | null) {
  const { program, wallet } = useProgram();
  const [roles, setRoles] = useState<ParticipantInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!program || !masterPolicyPDA || !wallet?.publicKey) {
      setRoles([]);
      return;
    }

    let cancelled = false;

    async function detect() {
      setLoading(true);
      setError(null);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prog = program as any;
        const account: MasterPolicyAccount = await prog.account.masterPolicy.fetch(masterPolicyPDA);
        const walletKey = wallet!.publicKey!;
        const found: ParticipantInfo[] = [];

        // Check leader
        if (account.leader.equals(walletKey)) {
          found.push({
            role: 'leader',
            shareBps: 10000,
            confirmed: true,
            participantIndex: -1,
          });
        }

        // Check reinsurer
        if (account.reinsurer.equals(walletKey)) {
          found.push({
            role: 'rein',
            shareBps: account.reinsurerEffectiveBps,
            confirmed: account.reinsurerConfirmed,
            participantIndex: -1,
          });
        }

        // Check participants array
        const participants: MasterParticipant[] = account.participants || [];
        for (let i = 0; i < participants.length; i++) {
          const p = participants[i];
          if (p && p.insurer.equals(walletKey)) {
            found.push({
              role: i === 0 ? 'partA' : 'partB',
              shareBps: p.shareBps,
              confirmed: p.confirmed,
              participantIndex: i,
            });
          }
        }

        if (!cancelled) {
          setRoles(found);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setRoles([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    detect();
    return () => { cancelled = true; };
  }, [program, masterPolicyPDA, wallet]);

  // Backward-compatible: primary role = first found (leader > rein > participant)
  const info = roles.length > 0 ? roles[0] : null;

  return { info, roles, loading, error };
}

import { useEffect } from 'react';
import { BACKEND_URL } from '@/lib/constants';

/**
 * Generic SSE hook that connects to /api/events for a given master pubkey.
 * Used by components that need raw SSE access outside of the policy hooks.
 * Policy-specific SSE is handled within useMasterPolicyAccount and useFlightPolicies.
 */
export function useBackendEvents(masterPubkey?: string | null) {
  useEffect(() => {
    if (!masterPubkey) return;

    const url = `${BACKEND_URL}/api/events?master=${masterPubkey}`;
    const es = new EventSource(url);

    es.addEventListener('heartbeat', () => {
      // Connection alive — no action needed
    });

    es.onerror = () => {
      // Auto-reconnects
    };

    return () => es.close();
  }, [masterPubkey]);
}

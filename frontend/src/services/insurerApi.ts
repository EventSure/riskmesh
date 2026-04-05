import { useProtocolStore } from '@/store/useProtocolStore';
import { FLIGHT_ROUTES } from '@/store/useProtocolStore';
import { BACKEND_URL } from '@/lib/constants';

/* ── Types ── */
export interface EnrollmentData {
  subscriberName: string;
  flightNo: string;
  departureDate: string;
  masterPolicyPDA?: string;
}

export interface EnrollmentResult {
  success: boolean;
  contractId: string;
  flightPolicyPubkey: string;
  premium: number;
  timestamp: string;
  error?: string;
}

interface CreateFlightPolicyResponse {
  program_id: string;
  master_policy_pubkey: string;
  child_policy_id: number;
  flight_policy_pubkey: string;
  tx_signature: string;
}

export interface MasterPolicyInfo {
  pubkey: string;
  status_label: string;
  coverage_end_ts: number;
}

export async function fetchActiveMasterPolicies(): Promise<MasterPolicyInfo[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/master-policies`);
    if (!res.ok) return [];
    const body = await res.json() as { master_policies: MasterPolicyInfo[] };
    return body.master_policies.filter(p => p.status_label === 'Active');
  } catch {
    return [];
  }
}

/* ── Helpers ── */

/** Store 또는 백엔드에서 활성 MasterPolicy PDA를 가져온다. */
async function resolveMasterPolicyPDA(): Promise<string | null> {
  const stored = useProtocolStore.getState().masterPolicyPDA;
  if (stored) return stored;

  // Store에 없으면 백엔드에서 Active 상태인 첫 번째 마스터 정책을 조회
  try {
    const res = await fetch(`${BACKEND_URL}/api/master-policies`);
    if (!res.ok) return null;
    const body = await res.json() as { master_policies: MasterPolicyInfo[] };
    const active = body.master_policies.find(p => p.status_label === 'Active');
    return active?.pubkey ?? null;
  } catch {
    return null;
  }
}

function nowTimestamp(): string {
  return new Date().toLocaleTimeString('ko-KR', { hour12: false });
}

/* ── Backend API ── */
export async function enrollPolicy(data: EnrollmentData): Promise<EnrollmentResult> {
  const store = useProtocolStore.getState();
  const premium = store.premiumPerPolicy;

  const masterPDA = data.masterPolicyPDA ?? await resolveMasterPolicyPDA();
  if (!masterPDA) {
    return {
      success: false,
      contractId: '',
      flightPolicyPubkey: '',
      premium,
      timestamp: nowTimestamp(),
      error: 'no_master_policy',
    };
  }

  // 출발일을 Unix timestamp(초)로 변환
  const departureTs = Math.floor(new Date(data.departureDate + 'T00:00:00Z').getTime() / 1000);

  try {
    const res = await fetch(
      `${BACKEND_URL}/api/master-policies/${masterPDA}/flight-policies`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriber_ref: data.subscriberName,
          flight_no: data.flightNo,
          route: FLIGHT_ROUTES[data.flightNo] ?? '',
          departure_ts: departureTs,
        }),
      },
    );

    if (!res.ok) {
      const errBody = await res.text();
      return {
        success: false,
        contractId: '',
        flightPolicyPubkey: '',
        premium,
        timestamp: nowTimestamp(),
        error: errBody || 'api_error',
      };
    }

    const body: CreateFlightPolicyResponse = await res.json();

    // 로컬 store에도 반영하여 대시보드와 동기화
    store.addContract(data.subscriberName, data.flightNo, data.departureDate);

    return {
      success: true,
      contractId: `FP-${body.child_policy_id}`,
      flightPolicyPubkey: body.flight_policy_pubkey,
      premium,
      timestamp: nowTimestamp(),
    };
  } catch (err) {
    return {
      success: false,
      contractId: '',
      flightPolicyPubkey: '',
      premium,
      timestamp: nowTimestamp(),
      error: err instanceof Error ? err.message : 'network_error',
    };
  }
}

import { useProtocolStore } from '@/store/useProtocolStore';

/* ── Types ── */
export interface EnrollmentData {
  subscriberName: string;
  flightNo: string;
  departureDate: string;
}

export interface EnrollmentResult {
  success: boolean;
  contractId: string;
  premium: number;
  timestamp: string;
}

/* ── Helpers ── */
function generateContractId(): string {
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 99999) + 1).padStart(5, '0');
  return `SGI-${year}-${seq}`;
}

function randomDelay(): Promise<void> {
  const ms = 300 + Math.random() * 500;
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* ── Mock Webhook API ── */
export async function enrollPolicy(data: EnrollmentData): Promise<EnrollmentResult> {
  // Simulate network latency (insurer → RiskMesh webhook POST)
  await randomDelay();

  const store = useProtocolStore.getState();
  const premium = store.premiumPerPolicy;

  // Guard: master policy must be active to accept contracts
  if (!store.masterActive) {
    return {
      success: false,
      contractId: '',
      premium,
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
    };
  }

  // Push contract into the protocol store (same effect as webhook → RiskMesh)
  store.addContract(data.subscriberName, data.flightNo, data.departureDate);

  return {
    success: true,
    contractId: generateContractId(),
    premium,
    timestamp: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
  };
}

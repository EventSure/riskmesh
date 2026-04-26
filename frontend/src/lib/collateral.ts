export interface PayoutTiersUsdc {
  delay2h: number;
  delay3h: number;
  delay4to5h: number;
  delay6hOrCancelled: number;
}

export type CollateralState = 'ready' | 'underfunded' | 'pending_confirm';

export interface CollateralPartyInput {
  label: string;
  confirmed: boolean;
  balance: number;
}

export interface CollateralParticipantInput extends CollateralPartyInput {
  id: string;
  shareBps: number;
}

export interface BuildCollateralStatusInput {
  payoutTiers: PayoutTiersUsdc;
  collateralClaimCount: number;
  reinsurerEffectiveBps: number;
  leaderShareBps: number;
  leader: CollateralPartyInput;
  participants: CollateralParticipantInput[];
  reinsurer?: CollateralPartyInput | null;
}

export interface CollateralPartyStatus {
  id: string;
  label: string;
  role: 'leader' | 'participant' | 'reinsurer';
  shareBps: number;
  required: number;
  balance: number;
  deficit: number;
  surplus: number;
  fundedPct: number;
  confirmed: boolean;
  state: CollateralState;
}

export interface CollateralStatus {
  totalRequired: number;
  totalFunded: number;
  totalDeficit: number;
  totalSurplus: number;
  totalHealthPct: number;
  aggregateReady: boolean;
  parties: CollateralPartyStatus[];
}

const MICRO_USDC_FACTOR = 1_000_000;
const MAX_BPS = 10_000;

export function maxPayoutTier(tiers: PayoutTiersUsdc): number {
  return Math.max(tiers.delay2h, tiers.delay3h, tiers.delay4to5h, tiers.delay6hOrCancelled);
}

export function collateralDeficit(required: number, balance: number): number {
  return fromMicroUsdc(collateralDeficitRaw(toMicroUsdc(required), toMicroUsdc(balance)));
}

function toMicroUsdc(amount: number): number {
  return Math.round(amount * MICRO_USDC_FACTOR);
}

function fromMicroUsdc(amountRaw: number): number {
  return amountRaw / MICRO_USDC_FACTOR;
}

function collateralDeficitRaw(requiredRaw: number, balanceRaw: number): number {
  return Math.max(0, requiredRaw - balanceRaw);
}

function validateNonNegativeFiniteNumber(value: number, fieldName: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldName} must be a finite non-negative number`);
  }
}

function validateBps(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value < 0 || value > MAX_BPS) {
    throw new Error(`${fieldName} must be an integer between 0 and 10000`);
  }
}

function validateBuildCollateralStatusInput(input: BuildCollateralStatusInput): void {
  if (!Number.isInteger(input.collateralClaimCount) || input.collateralClaimCount < 1 || input.collateralClaimCount > 100) {
    throw new Error('collateralClaimCount must be an integer between 1 and 100');
  }

  validateNonNegativeFiniteNumber(input.payoutTiers.delay2h, 'payoutTiers.delay2h');
  validateNonNegativeFiniteNumber(input.payoutTiers.delay3h, 'payoutTiers.delay3h');
  validateNonNegativeFiniteNumber(input.payoutTiers.delay4to5h, 'payoutTiers.delay4to5h');
  validateNonNegativeFiniteNumber(input.payoutTiers.delay6hOrCancelled, 'payoutTiers.delay6hOrCancelled');
  validateNonNegativeFiniteNumber(input.leader.balance, 'leader.balance');

  validateBps(input.reinsurerEffectiveBps, 'reinsurerEffectiveBps');
  validateBps(input.leaderShareBps, 'leaderShareBps');

  let insurerShareTotalBps = input.leaderShareBps;

  input.participants.forEach((participant, index) => {
    validateNonNegativeFiniteNumber(participant.balance, `participants[${index}].balance`);
    validateBps(participant.shareBps, `participants[${index}].shareBps`);
    insurerShareTotalBps += participant.shareBps;
  });

  if (insurerShareTotalBps !== MAX_BPS) {
    throw new Error('insurer share bps must sum to 10000');
  }

  if (input.reinsurer) {
    validateNonNegativeFiniteNumber(input.reinsurer.balance, 'reinsurer.balance');
  }
}

function allocateByShareBps(totalRaw: number, shareBpsList: number[]): number[] {
  const allocations = shareBpsList.map(shareBps => Math.floor((totalRaw * shareBps) / MAX_BPS));
  const remainderRaw = totalRaw - allocations.reduce((sum, allocation) => sum + allocation, 0);

  if (remainderRaw > 0) {
    const firstPositiveShareIndex = shareBpsList.findIndex(shareBps => shareBps > 0);
    if (firstPositiveShareIndex >= 0) {
      allocations[firstPositiveShareIndex] = (allocations[firstPositiveShareIndex] ?? 0) + remainderRaw;
    }
  }

  return allocations;
}

function partyState(requiredRaw: number, balanceRaw: number, confirmed: boolean): CollateralState {
  if (!confirmed) return 'pending_confirm';
  return balanceRaw >= requiredRaw ? 'ready' : 'underfunded';
}

function buildParty(args: {
  id: string;
  label: string;
  role: CollateralPartyStatus['role'];
  shareBps: number;
  requiredRaw: number;
  balanceRaw: number;
  confirmed: boolean;
}): CollateralPartyStatus {
  const deficitRaw = collateralDeficitRaw(args.requiredRaw, args.balanceRaw);
  const surplusRaw = Math.max(0, args.balanceRaw - args.requiredRaw);

  return {
    id: args.id,
    label: args.label,
    role: args.role,
    shareBps: args.shareBps,
    required: fromMicroUsdc(args.requiredRaw),
    balance: fromMicroUsdc(args.balanceRaw),
    deficit: fromMicroUsdc(deficitRaw),
    surplus: fromMicroUsdc(surplusRaw),
    fundedPct: args.requiredRaw > 0 ? Math.min(100, (args.balanceRaw / args.requiredRaw) * 100) : 100,
    confirmed: args.confirmed,
    state: partyState(args.requiredRaw, args.balanceRaw, args.confirmed),
  };
}

export function buildCollateralStatus(input: BuildCollateralStatusInput): CollateralStatus {
  validateBuildCollateralStatusInput(input);

  const maxPayoutRaw = toMicroUsdc(maxPayoutTier(input.payoutTiers));
  const totalRequiredRaw = maxPayoutRaw * input.collateralClaimCount;
  const reinsurerRequiredRaw = input.reinsurer
    ? Math.floor((totalRequiredRaw * input.reinsurerEffectiveBps) / MAX_BPS)
    : 0;
  const insurerTotalRequiredRaw = totalRequiredRaw - reinsurerRequiredRaw;
  const insurerShareBpsList = [input.leaderShareBps, ...input.participants.map(participant => participant.shareBps)];
  const insurerRequiredAllocationsRaw = allocateByShareBps(insurerTotalRequiredRaw, insurerShareBpsList);

  const parties: CollateralPartyStatus[] = [
    buildParty({
      id: 'leader',
      label: input.leader.label,
      role: 'leader',
      shareBps: input.leaderShareBps,
      requiredRaw: insurerRequiredAllocationsRaw[0] ?? 0,
      balanceRaw: toMicroUsdc(input.leader.balance),
      confirmed: input.leader.confirmed,
    }),
    ...input.participants.map((participant, index) => buildParty({
      id: participant.id,
      label: participant.label,
      role: 'participant',
      shareBps: participant.shareBps,
      requiredRaw: insurerRequiredAllocationsRaw[index + 1] ?? 0,
      balanceRaw: toMicroUsdc(participant.balance),
      confirmed: participant.confirmed,
    })),
  ];

  if (input.reinsurer) {
    parties.push(buildParty({
      id: 'reinsurer',
      label: input.reinsurer.label,
      role: 'reinsurer',
      shareBps: input.reinsurerEffectiveBps,
      requiredRaw: reinsurerRequiredRaw,
      balanceRaw: toMicroUsdc(input.reinsurer.balance),
      confirmed: input.reinsurer.confirmed,
    }));
  }

  const totalFundedRaw = parties.reduce((sum, party) => sum + toMicroUsdc(party.balance), 0);
  const totalDeficitRaw = parties.reduce((sum, party) => sum + toMicroUsdc(party.deficit), 0);
  const totalSurplusRaw = Math.max(0, totalFundedRaw - totalRequiredRaw);
  const aggregateReady = parties.every(party => party.state === 'ready') && totalDeficitRaw === 0;

  return {
    totalRequired: fromMicroUsdc(totalRequiredRaw),
    totalFunded: fromMicroUsdc(totalFundedRaw),
    totalDeficit: fromMicroUsdc(totalDeficitRaw),
    totalSurplus: fromMicroUsdc(totalSurplusRaw),
    totalHealthPct: totalRequiredRaw > 0 ? Math.min(100, (totalFundedRaw / totalRequiredRaw) * 100) : 100,
    aggregateReady,
    parties,
  };
}

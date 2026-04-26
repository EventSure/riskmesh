import { act, renderHook } from '@testing-library/react';
import { PublicKey } from '@solana/web3.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CURRENCY_MINT } from '@/lib/constants';
import { useCreateMasterAgreement } from '../useCreateMasterAgreement';

const APPROVED_MINT = 'A6ty3ZmdzFW9JS92QCc5n7XPUM2cfwKzdnPmyXP2hY8w';
const STALE_MINT = '5YsAiRYU3tTFc5B8aaGwVL1oC9DVxBEddnXCaHcQQg2k';

const {
  mockCreateMasterAgreement,
  mockAccounts,
  mockRpc,
  mockSendTx,
  mockUseProgram,
} = vi.hoisted(() => ({
  mockCreateMasterAgreement: vi.fn(),
  mockAccounts: vi.fn(),
  mockRpc: vi.fn(),
  mockSendTx: vi.fn(),
  mockUseProgram: vi.fn(),
}));

const walletPublicKey = new PublicKey('HfN5mNQ3uqqeB7hV5s5RZ7R1Sg6f6h2c5z9eZ7pG6w8');
const operator = new PublicKey('4vJ9JU1bJJE96FWSJLzdQwQKkF4o4gJqQj3Lk8gM7vd');
const reinsurer = new PublicKey('8qbHbw2BbbTHBW1sWKL9xV2b8Qm7u7v9M9u6GgF3oEn');
const leaderDepositWallet = new PublicKey('CktRuQ5D1YbQeKx8g4g6oW4g7D2bVjE6bW8rM2WzYz7');
const reinsurerPoolWallet = new PublicKey('Gk7mR6X3W1qV5mY9tL4dQ2nP8cJ6fH3rT1sB7wE9zQ4');
const reinsurerDepositWallet = new PublicKey('9hSR6S7WPtxmTojgo6GG3k4yDPecgJY292j7xrsUGWBu');
const participantInsurer = new PublicKey('6QWeT6FpJrm8AF1btu6WH2k2Xhq6t5vbheKVfQavmeoZ');

vi.mock('../useProgram', () => ({
  useProgram: () => mockUseProgram(),
}));

vi.mock('@/lib/tx', () => ({
  sendTx: (...args: unknown[]) => mockSendTx(...args),
}));

vi.mock('@/lib/pda', async () => {
  const { PublicKey } = await import('@solana/web3.js');

  return {
    getMasterAgreementPDA: () => [new PublicKey('11111111111111111111111111111111'), 255],
  };
});

describe('useCreateMasterAgreement', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockAccounts.mockReset();
    mockCreateMasterAgreement.mockReset();
    mockSendTx.mockReset();
    mockUseProgram.mockReset();
    mockAccounts.mockImplementation(() => ({ rpc: mockRpc }));
    mockCreateMasterAgreement.mockImplementation(() => ({ accounts: mockAccounts }));
    mockSendTx.mockImplementation(async (_provider, callback: () => Promise<string>) => {
      await callback();
      return { signature: 'sig-1', success: true };
    });
    mockUseProgram.mockReturnValue({
      program: {
        methods: {
          createMasterAgreement: mockCreateMasterAgreement,
        },
      },
      provider: { connection: {} },
      wallet: { publicKey: walletPublicKey },
    });
  });

  it('uses the approved currency mint for new master agreements', async () => {
    const { result } = renderHook(() => useCreateMasterAgreement());

    let response:
      | { signature: string; success: boolean; error?: string }
      | undefined;

    await act(async () => {
      response = await result.current.createMasterAgreement({
        masterId: 42,
        coverageStartTs: 1_700_000_000,
        coverageEndTs: 1_700_086_400,
        premiumPerPolicy: 1_000_000,
        payoutDelay2h: 5_000_000,
        payoutDelay3h: 8_000_000,
        payoutDelay4to5h: 12_000_000,
        payoutDelay6hOrCancelled: 15_000_000,
        collateralClaimCount: 3,
        leaderShareBps: 5_000,
        cededRatioBps: 5_000,
        reinsCommissionBps: 1_000,
        operator,
        reinsurer,
        currencyMint: new PublicKey(STALE_MINT),
        leaderDepositWallet,
        reinsurerPoolWallet,
        reinsurerDepositWallet,
        participants: [{ insurer: participantInsurer, shareBps: 2_000 }],
      });
    });

    expect(response).toEqual({ signature: 'sig-1', success: true });
    expect(CURRENCY_MINT.toBase58()).toBe(APPROVED_MINT);
    expect(mockAccounts).toHaveBeenCalledWith(
      expect.objectContaining({
        currencyMint: expect.objectContaining({
          toBase58: expect.any(Function),
        }),
      }),
    );

    const [{ currencyMint }] = mockAccounts.mock.calls[0] as [{ currencyMint: PublicKey }];
    expect(currencyMint.toBase58()).toBe(APPROVED_MINT);
  });
});

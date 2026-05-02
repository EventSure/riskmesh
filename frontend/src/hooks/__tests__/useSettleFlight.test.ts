import { act, renderHook } from '@testing-library/react';
import { PublicKey } from '@solana/web3.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettleFlight } from '../useSettleFlight';

const {
  mockAccounts,
  mockRemainingAccounts,
  mockRpc,
  mockSendTx,
  mockSettleFlightNoClaim,
  mockUseProgram,
} = vi.hoisted(() => ({
  mockAccounts: vi.fn(),
  mockRemainingAccounts: vi.fn(),
  mockRpc: vi.fn(),
  mockSendTx: vi.fn(),
  mockSettleFlightNoClaim: vi.fn(),
  mockUseProgram: vi.fn(),
}));

const walletPublicKey = new PublicKey('HfN5mNQ3uqqeB7hV5s5RZ7R1Sg6f6h2c5z9eZ7pG6w8');
const masterAgreement = new PublicKey('4vJ9JU1bJJE96FWSJLzdQwQKkF4o4gJqQj3Lk8gM7vd');
const flightPolicy = new PublicKey('8qbHbw2BbbTHBW1sWKL9xV2b8Qm7u7v9M9u6GgF3oEn');
const leaderPoolToken = new PublicKey('Gk7mR6X3W1qV5mY9tL4dQ2nP8cJ6fH3rT1sB7wE9zQ4');
const leaderDepositToken = new PublicKey('CktRuQ5D1YbQeKx8g4g6oW4g7D2bVjE6bW8rM2WzYz7');
const reinsurerDepositToken = new PublicKey('9hSR6S7WPtxmTojgo6GG3k4yDPecgJY292j7xrsUGWBu');
const participantDepositToken = new PublicKey('6QWeT6FpJrm8AF1btu6WH2k2Xhq6t5vbheKVfQavmeoZ');

vi.mock('../useProgram', () => ({
  useProgram: () => mockUseProgram(),
}));

vi.mock('@/lib/tx', () => ({
  sendTx: (...args: unknown[]) => mockSendTx(...args),
}));

describe('useSettleFlight', () => {
  beforeEach(() => {
    mockAccounts.mockReset();
    mockRemainingAccounts.mockReset();
    mockRpc.mockReset();
    mockSendTx.mockReset();
    mockSettleFlightNoClaim.mockReset();
    mockUseProgram.mockReset();

    mockRpc.mockResolvedValue('sig-1');
    mockRemainingAccounts.mockReturnValue({ rpc: mockRpc });
    mockAccounts.mockReturnValue({ remainingAccounts: mockRemainingAccounts });
    mockSettleFlightNoClaim.mockReturnValue({ accounts: mockAccounts });
    mockSendTx.mockImplementation(async (_provider, callback: () => Promise<string>) => {
      await callback();
      return { signature: 'sig-1', success: true };
    });
    mockUseProgram.mockReturnValue({
      program: {
        methods: {
          settleFlightNoClaim: mockSettleFlightNoClaim,
        },
      },
      provider: { connection: {} },
      wallet: { publicKey: walletPublicKey },
    });
  });

  it('provides the leader pool token when settling a no-claim policy', async () => {
    const { result } = renderHook(() => useSettleFlight());

    await act(async () => {
      await result.current.settleFlightNoClaim({
        masterAgreement,
        flightPolicy,
        leaderPoolToken,
        leaderDepositToken,
        reinsurerDepositToken,
        participantDepositWallets: [participantDepositToken],
      });
    });

    expect(mockAccounts).toHaveBeenCalledWith(
      expect.objectContaining({
        leaderPoolToken,
        leaderDepositToken,
        reinsurerDepositToken,
      }),
    );
  });
});

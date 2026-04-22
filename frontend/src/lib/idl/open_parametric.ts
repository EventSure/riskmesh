/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/open_parametric.json`.
 */
import { PublicKey } from '@solana/web3.js';
import type { BN } from '@coral-xyz/anchor';

// ── Enums ─────────────────────────────────────────────────────────────────────

export enum MasterAgreementStatus {
  Draft = 0,
  PendingConfirm = 1,
  Active = 2,
  Closed = 3,
  Cancelled = 4,
}

export enum ConfirmRole {
  Participant = 0,
  Reinsurer = 1,
}

export enum PolicyState {
  Draft = 0,
  Open = 1,
  Funded = 2,
  Active = 3,
  Claimable = 4,
  Approved = 5,
  Settled = 6,
  Expired = 7,
}

export enum FlightPolicyStatus {
  Issued = 0,
  AwaitingOracle = 1,
  Claimable = 2,
  Paid = 3,
  NoClaim = 4,
  Expired = 5,
}

export const MASTER_STATUS_LABELS: Record<number, string> = {
  [MasterAgreementStatus.Draft]: 'Draft',
  [MasterAgreementStatus.PendingConfirm]: 'PendingConfirm',
  [MasterAgreementStatus.Active]: 'Active',
  [MasterAgreementStatus.Closed]: 'Closed',
  [MasterAgreementStatus.Cancelled]: 'Cancelled',
};

export const POLICY_STATE_LABELS: Record<number, string> = {
  [PolicyState.Draft]: 'Draft',
  [PolicyState.Open]: 'Open',
  [PolicyState.Funded]: 'Funded',
  [PolicyState.Active]: 'Active',
  [PolicyState.Claimable]: 'Claimable',
  [PolicyState.Approved]: 'Approved',
  [PolicyState.Settled]: 'Settled',
  [PolicyState.Expired]: 'Expired',
};

export const FLIGHT_STATUS_LABELS: Record<number, string> = {
  [FlightPolicyStatus.Issued]: 'Issued',
  [FlightPolicyStatus.AwaitingOracle]: 'AwaitingOracle',
  [FlightPolicyStatus.Claimable]: 'Claimable',
  [FlightPolicyStatus.Paid]: 'Paid',
  [FlightPolicyStatus.NoClaim]: 'NoClaim',
  [FlightPolicyStatus.Expired]: 'Expired',
};

// ── Account Interfaces ────────────────────────────────────────────────────────

export interface MasterParticipant {
  insurer: PublicKey;
  shareBps: number;
  confirmed: boolean;
  poolWallet: PublicKey;
  depositWallet: PublicKey;
}

/** Mirrors the on-chain MasterAgreement account layout (state.rs). */
export interface MasterAgreementAccount {
  masterId: BN;
  leader: PublicKey;
  operator: PublicKey;
  currencyMint: PublicKey;
  coverageStartTs: BN;
  coverageEndTs: BN;
  premiumPerPolicy: BN;
  /** Anchor 0.31 camelCase: payout_delay_2h → payoutDelay2H */
  payoutDelay2H: BN;
  payoutDelay3H: BN;
  payoutDelay4To5H: BN;
  payoutDelay6HOrCancelled: BN;
  leaderShareBps: number;
  cededRatioBps: number;
  reinsCommissionBps: number;
  reinsurerEffectiveBps: number;
  reinsurer: PublicKey | null;
  reinsurerConfirmed: boolean;
  reinsurerPoolWallet: PublicKey | null;
  reinsurerDepositWallet: PublicKey | null;
  leaderPoolWallet: PublicKey;
  leaderDepositWallet: PublicKey;
  participants: MasterParticipant[];
  oracleFeed: PublicKey;
  status: number;
  createdAt: BN;
  bump: number;
}

export interface FlightPolicyAccount {
  childPolicyId: BN;
  master: PublicKey;
  creator: PublicKey;
  subscriberRef: string;
  flightNo: string;
  route: string;
  departureTs: BN;
  premiumPaid: BN;
  delayMinutes: number;
  cancelled: boolean;
  payoutAmount: BN;
  status: number;
  premiumDistributed: boolean;
  createdAt: BN;
  updatedAt: BN;
  bump: number;
}

// ── Instruction Param Types ───────────────────────────────────────────────────

export interface MasterParticipantInit {
  insurer: PublicKey;
  shareBps: number;
}

export interface CreateMasterAgreementParams {
  masterId: BN;
  coverageStartTs: BN;
  coverageEndTs: BN;
  premiumPerPolicy: BN;
  payoutDelay2H: BN;
  payoutDelay3H: BN;
  payoutDelay4To5H: BN;
  payoutDelay6HOrCancelled: BN;
  leaderShareBps: number;
  cededRatioBps: number;
  reinsCommissionBps: number;
  participants: MasterParticipantInit[];
  oracleFeed: PublicKey;
}

export interface CreateFlightPolicyParams {
  childPolicyId: BN;
  subscriberRef: string;
  flightNo: string;
  route: string;
  departureTs: BN;
}

// ── Legacy stub types (kept for compilation compatibility) ────────────────────

export interface PolicyAccount {
  policyId: BN;
  leader: PublicKey;
  route: string;
  flightNo: string;
  state: number;
  currencyMint: PublicKey;
  pool: PublicKey;
  payoutAmount: BN;
}

/** @deprecated Legacy Track B type stub. */
export interface CreatePolicyParams {
  policyId: BN;
  route: string;
  flightNo: string;
  departureDate: BN;
  delayThresholdMin: number;
  payoutAmount: BN;
  activeFrom: BN;
  activeTo: BN;
}

export interface RiskPoolAccount {
  policy: PublicKey;
  vault: PublicKey;
  totalEscrowed: BN;
}

export interface UnderwritingAccount {
  policy: PublicKey;
  participants: { insurer: PublicKey; ratioBps: number; status: number; escrow: PublicKey; escrowedAmount: BN }[];
  status: number;
}

export interface PolicyholderEntryInput {
  externalRef: string;
  flightNo: string;
  departureDate: BN;
  passengerCount: number;
  premiumPaid: BN;
  coverageAmount: BN;
}
export type OpenParametric = {
  "address": "ETEEEssGKAAQEGwz3ggDcy9vzPAPtBjtb2KocdyLBMjh",
  "metadata": {
    "name": "openParametric",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Open Parametric insurance protocol (MVP)"
  },
  "instructions": [
    {
      "name": "activateMaster",
      "discriminator": [
        186,
        209,
        49,
        84,
        196,
        147,
        195,
        144
      ],
      "accounts": [
        {
          "name": "operator",
          "signer": true
        },
        {
          "name": "masterAgreement",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "checkOracleAndResolveFlight",
      "docs": [
        "3-instruction 트랜잭션 필요: [Ed25519, verified_update, 이 instruction]"
      ],
      "discriminator": [
        14,
        109,
        207,
        236,
        176,
        191,
        35,
        50
      ],
      "accounts": [
        {
          "name": "payer",
          "docs": [
            "트랜잭션 수수료 부담자. 누구나 호출 가능."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "masterAgreement",
          "docs": [
            "oracle_feed 주소와 tiered payout 기준을 제공하는 마스터 계약."
          ]
        },
        {
          "name": "flightPolicy",
          "docs": [
            "지연 결과가 기록될 FlightPolicy."
          ],
          "writable": true
        },
        {
          "name": "oracleFeed"
        },
        {
          "name": "queue",
          "address": "A43DyUGA7s8eXPxqEjJY6EBu1KKbNgfxF8h17VAHn13w"
        },
        {
          "name": "slotHashes",
          "address": "SysvarS1otHashes111111111111111111111111111"
        },
        {
          "name": "instructions",
          "address": "Sysvar1nstructions1111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "confirmMaster",
      "discriminator": [
        102,
        86,
        120,
        70,
        27,
        68,
        145,
        204
      ],
      "accounts": [
        {
          "name": "actor",
          "signer": true
        },
        {
          "name": "masterAgreement",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "role",
          "type": "u8"
        }
      ]
    },
    {
      "name": "createFlightPolicyFromMaster",
      "discriminator": [
        57,
        160,
        23,
        116,
        253,
        159,
        170,
        101
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "masterAgreement",
          "writable": true
        },
        {
          "name": "flightPolicy",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  108,
                  105,
                  103,
                  104,
                  116,
                  95,
                  112,
                  111,
                  108,
                  105,
                  99,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "masterAgreement"
              },
              {
                "kind": "arg",
                "path": "params.child_policy_id"
              }
            ]
          }
        },
        {
          "name": "payerToken",
          "writable": true
        },
        {
          "name": "leaderPoolToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "createFlightPolicyParams"
            }
          }
        }
      ]
    },
    {
      "name": "createMasterAgreement",
      "discriminator": [
        60,
        218,
        158,
        201,
        93,
        156,
        126,
        51
      ],
      "accounts": [
        {
          "name": "leader",
          "writable": true,
          "signer": true
        },
        {
          "name": "operator"
        },
        {
          "name": "reinsurer"
        },
        {
          "name": "currencyMint"
        },
        {
          "name": "masterAgreement",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  115,
                  116,
                  101,
                  114,
                  95,
                  112,
                  111,
                  108,
                  105,
                  99,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "leader"
              },
              {
                "kind": "arg",
                "path": "params.master_id"
              }
            ]
          }
        },
        {
          "name": "leaderDepositWallet",
          "writable": true
        },
        {
          "name": "reinsurerPoolWallet",
          "writable": true
        },
        {
          "name": "reinsurerDepositWallet",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "createMasterAgreementParams"
            }
          }
        }
      ]
    },
    {
      "name": "registerParticipantWallets",
      "discriminator": [
        113,
        124,
        212,
        28,
        185,
        247,
        99,
        61
      ],
      "accounts": [
        {
          "name": "insurer",
          "writable": true,
          "signer": true
        },
        {
          "name": "masterAgreement",
          "writable": true
        },
        {
          "name": "poolWallet"
        },
        {
          "name": "depositWallet"
        }
      ],
      "args": []
    },
    {
      "name": "resolveFlightDelay",
      "discriminator": [
        174,
        62,
        167,
        140,
        160,
        0,
        8,
        92
      ],
      "accounts": [
        {
          "name": "resolver",
          "signer": true
        },
        {
          "name": "masterAgreement"
        },
        {
          "name": "flightPolicy",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "delayMinutes",
          "type": "u16"
        },
        {
          "name": "cancelled",
          "type": "bool"
        }
      ]
    },
    {
      "name": "settleFlightClaim",
      "discriminator": [
        45,
        3,
        78,
        243,
        150,
        162,
        141,
        201
      ],
      "accounts": [
        {
          "name": "executor",
          "signer": true
        },
        {
          "name": "masterAgreement"
        },
        {
          "name": "flightPolicy",
          "writable": true
        },
        {
          "name": "leaderDepositToken",
          "writable": true
        },
        {
          "name": "leaderPoolToken",
          "writable": true
        },
        {
          "name": "reinsurerPoolToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "settleFlightNoClaim",
      "discriminator": [
        10,
        213,
        166,
        180,
        15,
        38,
        236,
        11
      ],
      "accounts": [
        {
          "name": "executor",
          "signer": true
        },
        {
          "name": "masterAgreement"
        },
        {
          "name": "flightPolicy",
          "writable": true
        },
        {
          "name": "leaderPoolToken",
          "writable": true
        },
        {
          "name": "leaderDepositToken",
          "writable": true
        },
        {
          "name": "reinsurerDepositToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "flightPolicy",
      "discriminator": [
        53,
        42,
        54,
        221,
        74,
        119,
        109,
        25
      ]
    },
    {
      "name": "masterAgreement",
      "discriminator": [
        244,
        57,
        211,
        253,
        13,
        177,
        50,
        201
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "unauthorized"
    },
    {
      "code": 6001,
      "name": "invalidState",
      "msg": "Invalid state for this instruction"
    },
    {
      "code": 6002,
      "name": "invalidRatio",
      "msg": "Invalid ratio sum"
    },
    {
      "code": 6003,
      "name": "notFound",
      "msg": "Not found"
    },
    {
      "code": 6004,
      "name": "oracleStale",
      "msg": "Oracle value is stale"
    },
    {
      "code": 6005,
      "name": "oracleFormat",
      "msg": "Oracle value format is invalid"
    },
    {
      "code": 6006,
      "name": "invalidTimeWindow",
      "msg": "Invalid time window"
    },
    {
      "code": 6007,
      "name": "invalidInput",
      "msg": "Invalid input"
    },
    {
      "code": 6008,
      "name": "invalidAmount",
      "msg": "Invalid amount"
    },
    {
      "code": 6009,
      "name": "inputTooLong",
      "msg": "Input too long"
    },
    {
      "code": 6010,
      "name": "mathOverflow",
      "msg": "Math overflow"
    },
    {
      "code": 6011,
      "name": "masterNotActive",
      "msg": "Master policy is not active"
    },
    {
      "code": 6012,
      "name": "masterNotConfirmed",
      "msg": "Master policy confirmation is incomplete"
    },
    {
      "code": 6013,
      "name": "invalidRole",
      "msg": "Invalid role for confirmation"
    },
    {
      "code": 6014,
      "name": "invalidPayout",
      "msg": "Invalid payout amount"
    },
    {
      "code": 6015,
      "name": "alreadySettled",
      "msg": "Settlement already completed"
    },
    {
      "code": 6016,
      "name": "invalidSettlementTarget",
      "msg": "Invalid settlement target"
    },
    {
      "code": 6017,
      "name": "invalidAccountList",
      "msg": "Invalid account list"
    }
  ],
  "types": [
    {
      "name": "createFlightPolicyParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "childPolicyId",
            "type": "u64"
          },
          {
            "name": "subscriberRef",
            "type": "string"
          },
          {
            "name": "flightNo",
            "type": "string"
          },
          {
            "name": "route",
            "type": "string"
          },
          {
            "name": "departureTs",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "createMasterAgreementParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "masterId",
            "type": "u64"
          },
          {
            "name": "coverageStartTs",
            "type": "i64"
          },
          {
            "name": "coverageEndTs",
            "type": "i64"
          },
          {
            "name": "premiumPerPolicy",
            "type": "u64"
          },
          {
            "name": "payoutDelay2h",
            "type": "u64"
          },
          {
            "name": "payoutDelay3h",
            "type": "u64"
          },
          {
            "name": "payoutDelay4to5h",
            "type": "u64"
          },
          {
            "name": "payoutDelay6hOrCancelled",
            "type": "u64"
          },
          {
            "name": "leaderShareBps",
            "type": "u16"
          },
          {
            "name": "cededRatioBps",
            "type": "u16"
          },
          {
            "name": "reinsCommissionBps",
            "type": "u16"
          },
          {
            "name": "participants",
            "type": {
              "vec": {
                "defined": {
                  "name": "masterParticipantInit"
                }
              }
            }
          },
          {
            "name": "oracleFeed",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "flightPolicy",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "childPolicyId",
            "type": "u64"
          },
          {
            "name": "master",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "subscriberRef",
            "type": "string"
          },
          {
            "name": "flightNo",
            "type": "string"
          },
          {
            "name": "route",
            "type": "string"
          },
          {
            "name": "departureTs",
            "type": "i64"
          },
          {
            "name": "premiumPaid",
            "type": "u64"
          },
          {
            "name": "delayMinutes",
            "type": "u16"
          },
          {
            "name": "cancelled",
            "type": "bool"
          },
          {
            "name": "payoutAmount",
            "type": "u64"
          },
          {
            "name": "status",
            "type": "u8"
          },
          {
            "name": "premiumDistributed",
            "type": "bool"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "updatedAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "masterParticipant",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "insurer",
            "type": "pubkey"
          },
          {
            "name": "shareBps",
            "type": "u16"
          },
          {
            "name": "confirmed",
            "type": "bool"
          },
          {
            "name": "poolWallet",
            "type": "pubkey"
          },
          {
            "name": "depositWallet",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "masterParticipantInit",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "insurer",
            "type": "pubkey"
          },
          {
            "name": "shareBps",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "masterAgreement",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "masterId",
            "type": "u64"
          },
          {
            "name": "leader",
            "type": "pubkey"
          },
          {
            "name": "operator",
            "type": "pubkey"
          },
          {
            "name": "currencyMint",
            "type": "pubkey"
          },
          {
            "name": "coverageStartTs",
            "type": "i64"
          },
          {
            "name": "coverageEndTs",
            "type": "i64"
          },
          {
            "name": "premiumPerPolicy",
            "type": "u64"
          },
          {
            "name": "payoutDelay2h",
            "type": "u64"
          },
          {
            "name": "payoutDelay3h",
            "type": "u64"
          },
          {
            "name": "payoutDelay4to5h",
            "type": "u64"
          },
          {
            "name": "payoutDelay6hOrCancelled",
            "type": "u64"
          },
          {
            "name": "leaderShareBps",
            "type": "u16"
          },
          {
            "name": "cededRatioBps",
            "type": "u16"
          },
          {
            "name": "reinsCommissionBps",
            "type": "u16"
          },
          {
            "name": "reinsurerEffectiveBps",
            "type": "u16"
          },
          {
            "name": "reinsurer",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "reinsurerConfirmed",
            "type": "bool"
          },
          {
            "name": "reinsurerPoolWallet",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "reinsurerDepositWallet",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "leaderPoolWallet",
            "type": "pubkey"
          },
          {
            "name": "leaderDepositWallet",
            "type": "pubkey"
          },
          {
            "name": "participants",
            "type": {
              "vec": {
                "defined": {
                  "name": "masterParticipant"
                }
              }
            }
          },
          {
            "name": "oracleFeed",
            "type": "pubkey"
          },
          {
            "name": "status",
            "type": "u8"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};

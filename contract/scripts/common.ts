/**
 * scripts/common.ts — 공통 유틸리티
 * 로컬 상태(.state.json)를 읽고 써서 스크립트 간 데이터를 공유합니다.
 */
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, BN, Program, Wallet } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";

export const RPC_URL =
  process.env.ANCHOR_PROVIDER_URL ?? "http://localhost:8899";
export const PROGRAM_ID = new PublicKey(
  process.env.PROGRAM_ID ?? "BXxqMY3f9y7dzvoQWJjhX95GMEyuRjD61kgfgherhSX7"
);
export const PAYOUT = new BN(1_000_000); // 1 USDC (6 decimals)
export const STATE_PATH = path.join(__dirname, ".state.json");

/** 스크립트 간 공유 상태 (.state.json) */
export interface State {
  // Legacy Policy 플로우 (1-7번 스크립트)
  mint: string;
  leaderKey: number[];
  ins1Key: number[];
  ins2Key: number[];
  ins1Token: string;
  ins2Token: string;
  policyId: number;
  activeTo: number;
  // Master/Flight 플로우 (oracle-* 스크립트)
  masterId?: number;
  masterPda?: string;
  flightPolicies?: Array<{
    childId: number;
    pda: string;
    flightNo: string;
    departureTs: number;
  }>;
  // Switchboard feed (oracle-feed-create 스크립트가 저장)
  feedPubkey?: string;
}

export function loadState(): State {
  if (!fs.existsSync(STATE_PATH)) {
    throw new Error("상태 파일이 없습니다. 먼저 `anchor run setup`을 실행하세요.");
  }
  return JSON.parse(fs.readFileSync(STATE_PATH, "utf-8"));
}

export function saveState(s: State): void {
  fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
}

export function kp(secret: number[]): Keypair {
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function makeProgram(payer: Keypair): any {
  const conn = new Connection(RPC_URL, "confirmed");
  const provider = new AnchorProvider(conn, new Wallet(payer), { commitment: "confirmed" });
  anchor.setProvider(provider);
  const idl = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../target/idl/open_parametric.json"), "utf-8")
  );
  return new anchor.Program(idl, provider);
}

// ─── PDA 헬퍼 ──────────────────────────────────────────────────────────────────

export function policyPub(leader: PublicKey, policyId: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("policy"), leader.toBuffer(), new BN(policyId).toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  )[0];
}

export function uwPub(policy: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("underwriting"), policy.toBuffer()],
    PROGRAM_ID
  )[0];
}

export function poolPub(policy: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pool"), policy.toBuffer()],
    PROGRAM_ID
  )[0];
}

export function regPub(policy: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("registry"), policy.toBuffer()],
    PROGRAM_ID
  )[0];
}

export const STATE_NAMES: Record<number, string> = {
  0: "Draft", 1: "Open", 2: "Funded", 3: "Active",
  4: "Claimable", 5: "Approved", 6: "Settled", 7: "Expired",
};

// ─── Master/Flight PDA 헬퍼 ────────────────────────────────────────────────────

export function masterPolicyPub(leader: PublicKey, masterId: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("master_policy"),
      leader.toBuffer(),
      new BN(masterId).toArrayLike(Buffer, "le", 8),
    ],
    PROGRAM_ID
  )[0];
}

export function flightPolicyPub(
  masterPolicy: PublicKey,
  childPolicyId: number
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("flight_policy"),
      masterPolicy.toBuffer(),
      new BN(childPolicyId).toArrayLike(Buffer, "le", 8),
    ],
    PROGRAM_ID
  )[0];
}

export function claimPub(policy: PublicKey, oracleRound: bigint): PublicKey {
  const roundBuf = Buffer.alloc(8);
  roundBuf.writeBigUInt64LE(oracleRound);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("claim"), policy.toBuffer(), roundBuf],
    PROGRAM_ID
  )[0];
}

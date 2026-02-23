// Stub crate: re-exports solana-program 1.18.x API
// This resolves the solana-frozen-abi version conflict between
// switchboard-on-demand 0.8.0 (needs =1.16.3) and anchor-lang 0.30.0 (needs =1.18.x)
pub use solana_program::*;

# Contract Setup Notes

## Program ID
`declare_id!` is currently a placeholder.

To generate and set a real program id:
1. Install Solana + Anchor toolchain.
2. Run:
   - `anchor keys list`
3. Replace the `declare_id!` in:
   - `contract/programs/open_parametric/src/lib.rs`
4. Update `contract/Anchor.toml` with the same program id.

## Build/Test
- `anchor build`
- `anchor test`

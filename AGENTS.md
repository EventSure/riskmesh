# Repository Guidelines

## Project Structure & Module Organization

Riskmesh is split into three workspaces. `frontend/` contains the React 19 + Vite app, with source in `frontend/src`, shared UI in `src/components`, hooks in `src/hooks`, state in `src/store`, and Vitest tests in `__tests__`. `backend/` contains the Rust Axum oracle daemon/API under `backend/src` and SQLite data under `backend/data`. `contract/` contains the Anchor program in `contract/programs/open_parametric/src`, TypeScript integration tests in `contract/tests`, and scripts in `contract/scripts`. Cross-project docs live in `docs/`.

## Build, Test, and Development Commands

- `cd frontend && npm run dev`: start the Vite dashboard locally.
- `cd frontend && npm run build`: type-check and build the frontend.
- `cd frontend && npm run lint`: run ESLint for TypeScript/React.
- `cd frontend && npm run test` or `npm run test:coverage`: run Vitest tests.
- `cd backend && cargo run --bin oracle-daemon`: start the backend daemon/API.
- `cd backend && cargo test`: run Rust backend tests.
- `cd contract && anchor build`: build the Solana program.
- `cd contract && npm run test`: run TypeScript contract tests with `ts-mocha`.
- `cd contract && npm run test:anchor`: run Anchor tests.

## Coding Style & Naming Conventions

Frontend code uses TypeScript, Emotion, ESLint, and Prettier. Follow `frontend/.prettierrc`: 2-space indentation, semicolons, single quotes, trailing commas, and 100-character print width. React components use `PascalCase`, hooks use `useCamelCase`, and tests use `*.test.ts` or `*.test.tsx`. Rust code must be `rustfmt` clean; keep instruction handlers and tests paired by feature, such as `settle_flight_claim.rs` and `settle_flight_claim_test.rs`.

## Testing Guidelines

Place frontend tests near the relevant component, hook, store, or service in `__tests__`. Prefer Vitest for pure logic and React Testing Library for rendered behavior. For contracts, use Rust unit tests for deterministic logic and Anchor/TypeScript tests for account flows. Run the narrow test first, then the workspace command before opening a PR.

## Commit & Pull Request Guidelines

Recent commits use concise imperative messages, often prefixed with `feat:` for new capabilities, for example `feat: Track B oracle via TypeScript subprocess delegation`. Keep commits scoped to one concern and call out docs, mint/program ID, or staging changes. PRs should include a summary, test results, linked issue if available, and screenshots for UI changes.

## Security & Configuration Tips

Do not commit private keys, wallet seed material, or populated `.env` files. Treat devnet program IDs, approved mint constants, and Switchboard/AviationStack settings as environment-specific; update matching frontend, backend, and contract references together.

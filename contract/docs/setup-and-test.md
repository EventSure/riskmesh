# 개발 환경 설치 및 테스트 가이드

## 1) Cargo 설치 방법

Rust/Cargo는 `rustup`으로 설치하는 것이 표준입니다.

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
cargo --version
rustc --version
```

이미 설치되어 있으면 업데이트만 실행해도 됩니다.

```bash
rustup update
```

## 2) Anchor 설치 방법 (Solana 공식 설치 페이지 기준)

Solana 공식 문서(Installation)의 Quick Installation 명령으로 Rust, Solana CLI, Anchor CLI를 한 번에 설치할 수 있습니다.

```bash
curl --proto '=https' --tlsv1.2 -sSfL https://solana-install.solana.workers.dev | bash
```

설치 후 버전 확인:

```bash
rustc --version
solana --version
anchor --version
surfpool --version
node --version
yarn --version
```

참고:
- Quick Installation이 실패하면 Solana 문서의 `Install Dependencies` 섹션을 따라 개별 설치를 진행하세요.
- 이 프로젝트는 현재 `anchor-lang = 0.31.1`을 사용하므로, `anchor --version` 확인 후 필요 시 버전 호환성을 점검하세요.

## 3) 테스트 방법

### 3-1. Rust 단위 테스트 실행

```bash
cargo test
```

특정 테스트만 실행:

```bash
cargo test settle_flight_claim_test
```

### 3-2. Anchor/TypeScript 테스트 실행

프로젝트 루트(`contract/`)에서 실행합니다.

전체 테스트:

```bash
anchor test
```

특정 파일만 실행:

```bash
anchor run test -- tests/settle_flight_claim.ts
```

## 4) 참고

- `anchor` 명령어가 없으면 설치 후 쉘 재시작(또는 PATH 반영) 뒤 다시 확인하세요.
- Solana 로컬 테스트를 위해서는 `solana` CLI 설치 및 로컬 validator 환경이 필요할 수 있습니다.

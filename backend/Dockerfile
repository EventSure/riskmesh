FROM rust:1.78-bookworm AS builder

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends pkg-config libssl-dev ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock ./
COPY src ./src

RUN cargo build --release --locked --bin oracle-daemon

FROM debian:bookworm-slim AS runtime

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libssl3 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --create-home --home-dir /app appuser \
    && mkdir -p /run/secrets/firebase /run/secrets/solana \
    && chown -R appuser:appuser /app /run/secrets

COPY --from=builder /app/target/release/oracle-daemon /usr/local/bin/oracle-daemon

ENV RUST_LOG=info
ENV WEB_BIND_ADDR=0.0.0.0:3000
ENV LEADER_KEYPAIR_PATH=/run/secrets/solana/id.json
ENV FIREBASE_SERVICE_ACCOUNT_PATH=/run/secrets/firebase/service-account.json

USER appuser

EXPOSE 3000

CMD ["oracle-daemon"]

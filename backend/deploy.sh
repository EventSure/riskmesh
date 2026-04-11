#!/usr/bin/env bash
# 로컬에서 arm64 Docker 이미지 빌드 후 라즈베리파이(Cloudflare Tunnel)로 배포
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_ENV="$SCRIPT_DIR/.env.production"
IMAGE_NAME="riskmesh-oracle"
IMAGE_TAG="arm64"
TARBALL="/tmp/${IMAGE_NAME}.tar.gz"

# ── .env.production 로드 ──
if [[ ! -f "$DEPLOY_ENV" ]]; then
  cat >&2 <<MSG
❌ $DEPLOY_ENV 파일이 없습니다.
cp backend/.env.production.example backend/.env.production 후 값을 채우세요.
MSG
  exit 1
fi

# SSH 변수만 추출 (source하면 cron의 *, 괄호 등이 bash에서 오작동)
PI_SSH_HOST="$(grep -m1 '^PI_SSH_HOST=' "$DEPLOY_ENV" | cut -d= -f2-)"
PI_SSH_USER="$(grep -m1 '^PI_SSH_USER=' "$DEPLOY_ENV" | cut -d= -f2-)"
CF_ACCESS_CLIENT_ID="$(grep -m1 '^CF_ACCESS_CLIENT_ID=' "$DEPLOY_ENV" | cut -d= -f2-)"
CF_ACCESS_CLIENT_SECRET="$(grep -m1 '^CF_ACCESS_CLIENT_SECRET=' "$DEPLOY_ENV" | cut -d= -f2-)"

: "${PI_SSH_HOST:?PI_SSH_HOST 필수}"
: "${PI_SSH_USER:?PI_SSH_USER 필수}"

# ── SSH ProxyCommand 구성 ──
SSH_OPTS="-o StrictHostKeyChecking=no"
if [[ -n "${CF_ACCESS_CLIENT_ID:-}" && -n "${CF_ACCESS_CLIENT_SECRET:-}" ]]; then
  SSH_OPTS="$SSH_OPTS -o ProxyCommand=\"cloudflared access ssh --hostname %h --id ${CF_ACCESS_CLIENT_ID} --secret ${CF_ACCESS_CLIENT_SECRET}\""
else
  SSH_OPTS="$SSH_OPTS -o ProxyCommand=\"cloudflared access ssh --hostname %h\""
fi

ssh_cmd() {
  eval ssh $SSH_OPTS "${PI_SSH_USER}@${PI_SSH_HOST}" '"$@"'
}

scp_cmd() {
  eval scp $SSH_OPTS "$1" "${PI_SSH_USER}@${PI_SSH_HOST}:$2"
}

# ── 1. 로컬 빌드 ──
echo "🔨 Building linux/arm64 image..."
docker build \
  --platform linux/arm64 \
  -t "${IMAGE_NAME}:${IMAGE_TAG}" \
  "$SCRIPT_DIR"

# ── 2. tarball 저장 ──
echo "📦 Saving image to $TARBALL..."
docker save "${IMAGE_NAME}:${IMAGE_TAG}" | gzip > "$TARBALL"

echo "   Size: $(du -h "$TARBALL" | cut -f1)"

# ── 3. 전송 ──
echo "🚀 Transferring to ${PI_SSH_HOST}..."
scp_cmd "$TARBALL" "/tmp/image.tar.gz"

# 컨테이너 환경변수 파일 전송
echo "📋 Syncing .env.production → ~/riskmesh/.env"
ssh_cmd "mkdir -p ~/riskmesh"
scp_cmd "$DEPLOY_ENV" "~/riskmesh/.env"

# ── 4. 배포 ──
echo "🔄 Deploying on Raspberry Pi..."
ssh_cmd << 'DEPLOY'
set -e
echo "Loading image..."
docker load -i /tmp/image.tar.gz

echo "Restarting container..."
docker stop riskmesh-oracle 2>/dev/null || true
docker rm riskmesh-oracle 2>/dev/null || true

docker run -d \
  --name riskmesh-oracle \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file ~/riskmesh/.env \
  -v ~/riskmesh/secrets/firebase:/run/secrets/firebase:ro \
  -v ~/riskmesh/secrets/solana:/run/secrets/solana:ro \
  -v ~/riskmesh/data:/app/data \
  riskmesh-oracle:arm64

# Dozzle 로그 뷰어 (인증 포함)
mkdir -p ~/riskmesh/dozzle
cat > ~/riskmesh/dozzle/users.yml << 'USERS'
users:
  admin:
    password: "$2y$10$Xojw/SnQQNgGx51azXp7d.ye0rL39CAVfFhK9Rn7ipl7u4fH/gUMG"
    name: "Admin"
USERS

docker stop dozzle 2>/dev/null || true
docker rm dozzle 2>/dev/null || true
docker pull amir20/dozzle:latest
docker run -d \
  --name dozzle \
  --restart unless-stopped \
  -p 9090:8080 \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v ~/riskmesh/dozzle/users.yml:/data/users.yml:ro \
  -e DOZZLE_AUTH_PROVIDER=simple \
  amir20/dozzle:latest
echo "Dozzle started on :9090 (auth enabled)"

rm -f /tmp/image.tar.gz
docker image prune -f

sleep 3
if docker ps --format '{{.Names}}' | grep -q riskmesh-oracle; then
  echo "✅ Deployed successfully"
  docker logs riskmesh-oracle --tail 5
else
  echo "❌ Container failed"
  docker logs riskmesh-oracle --tail 20
  exit 1
fi
DEPLOY

rm -f "$TARBALL"
echo "✅ Done!"

# oracle-proxy — AviationStack HTTPS Proxy (Cloudflare Worker)

## 문제

Switchboard oracle 노드는 `httpTask`에서 HTTPS URL만 허용합니다.  
AviationStack 무료 플랜은 HTTP만 제공합니다.  
이 Worker가 중간에서 HTTPS → HTTP 변환을 처리합니다.

```
Switchboard oracle  →  HTTPS  →  Worker  →  HTTP  →  AviationStack
```

## 사전 조건

- [Cloudflare 계정](https://dash.cloudflare.com/sign-up) (무료)
- Wrangler CLI 설치: `npm install -g wrangler`
- `wrangler login`으로 인증

## 배포

```bash
cd contract/oracle-proxy

# API 키를 Worker secret으로 설정 (평문으로 wrangler.toml에 넣지 말 것)
wrangler secret put AVIATIONSTACK_API_KEY
# 프롬프트에 키 입력

# Worker 배포
wrangler deploy
```

배포 완료 후 출력되는 URL을 확인합니다:
```
https://riskmesh-aviation-proxy.<your-account>.workers.dev
```

## contract/.env 설정

```env
PROXY_URL=https://riskmesh-aviation-proxy.<your-account>.workers.dev
```

## 동작 확인

```bash
curl "https://riskmesh-aviation-proxy.<your-account>.workers.dev?flight_iata=KE017"
```

AviationStack JSON 응답이 반환되면 정상.

## Switchboard feed 재생성

PROXY_URL 설정 후 feed를 새로 만들어야 합니다 (job spec URL이 바뀌므로):

```bash
cd contract
yarn demo:2-feed-create
```

새 `feedPubkey`가 `.state.json`에 저장됩니다.  
이후 새 oracle_feed로 MasterAgreement를 재생성합니다:

```bash
# 기존 MASTER_ID=2가 이미 Active라면 MASTER_ID=3 등 다음 ID 사용
MASTER_ID=3 yarn demo:3-master-setup
```

## 로컬 테스트 (배포 전)

```bash
cd contract/oracle-proxy
AVIATIONSTACK_API_KEY=<your-key> wrangler dev
# 로컬: http://localhost:8787?flight_iata=KE017
```

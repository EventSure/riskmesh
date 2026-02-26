# Riskmesh 파일별 State/Logic 설명서 (비전문가용)

이 문서는 저장소의 모든 파일을 대상으로, 각 파일이 무엇을 저장(`state`)하고 어떤 동작을 수행(`logic`)하는지 설명합니다.

## 0) 먼저 읽는 용어 풀이
- Solana: 블록체인 네트워크 이름.
- 프로그램(Program): 블록체인 위에서 실행되는 백엔드 코드(여기서는 Rust/Anchor).
- 계정(Account): 프로그램이 데이터를 저장하는 저장소 레코드.
- PDA: 프로그램이 규칙적으로 만들어내는 "계정 주소".
- SPL Token: Solana의 토큰 표준(이 프로젝트에서는 USDC 같은 결제 단위로 사용).
- Oracle: 외부 데이터(항공 지연 시간)를 블록체인에 전달하는 모듈.

---

## 1) 루트 문서/가이드

### `README.md`
- state: 프로젝트 전체 구조(`contract`, `frontend`, `docs`)와 실행 방법.
- logic: 시작 절차(프론트 실행, Anchor 빌드/테스트), 아키텍처/상태머신 개요 제공.

### `OpenParametric.md`
- state: MVP 설계 초안(계정 모델, 상태 정의, 권한 정책, 오라클/정산 규칙).
- logic: 구현 전에 어떤 비즈니스 규칙으로 코드를 만들지 상세하게 정의.

### `CLAUDE.md`
- state: 개발 에이전트용 작업 가이드(빌드/테스트/아키텍처 요약).
- logic: 자동화 에이전트가 프로젝트에서 작업할 때 지켜야 할 운영 규칙 설명.

### `docs/CONTRACT_GUIDE.md`
- state: 스마트컨트랙트의 사실상 상세 스펙(계정 필드, 인스트럭션, 에러코드, 시퀀스).
- logic: 컨트랙트 동작을 문서 기준으로 검증/운영할 수 있도록 흐름 설명.

### `docs/emotion-migration-handoff.md`
- state: 프론트 CSS→Emotion 마이그레이션 완료 내역과 남은 개선 항목.
- logic: 디자인/스타일링 기술 부채를 추적하는 핸드오프 문서.

### `docs/FILE_STATE_LOGIC_FULL_KO.md`
- state: 현재 문서 자체.
- logic: 파일별 state/logic 설명 제공.

---

## 2) 스마트컨트랙트(온체인) 영역: `contract/`

### `contract/Anchor.toml`
- state: localnet 프로그램 ID, 테스트 스크립트, 지갑 경로.
- logic: Anchor CLI가 어떤 네트워크/프로그램 설정으로 실행될지 결정.

### `contract/Cargo.toml`
- state: Rust 워크스페이스 구성(`programs/open_parametric`)과 릴리즈 최적화 옵션.
- logic: 빌드 시스템이 프로그램을 어떻게 컴파일할지 지정.

### `contract/Cargo.lock`
- state: Rust 의존성의 정확한 버전 스냅샷(재현 가능한 빌드용, 약 4k 라인).
- logic: 실행 로직은 없음. 의존성 고정 파일.

### `contract/README.md`
- state: Program ID placeholder 교체 절차와 빌드/테스트 메모.
- logic: 배포 전 필수 수동 단계 안내.

### `contract/tests/open_parametric.ts`
- state: Anchor 테스트 스캐폴드(현재 placeholder 테스트 1개).
- logic: 프로그램 ID가 연결되는지만 최소 검증.

### `contract/programs/open_parametric/Cargo.toml`
- state: 온체인 프로그램 크레이트 의존성(`anchor-lang`, `anchor-spl`, `switchboard-on-demand`).
- logic: 오라클/토큰/앵커 기능을 컴파일 시 연결.

### `contract/programs/open_parametric/src/lib.rs`
- state: 프로그램 진입점과 공개 인스트럭션 목록.
- logic: 각 공개 함수가 실제 핸들러 파일로 라우팅.

### `contract/programs/open_parametric/src/constants.rs`
- state: 지연 임계값(120분), 최대 참여자 수, 문자열 길이 제한, 계정 공간 상수.
- logic: 모든 인스트럭션 검증 기준의 공통 상수 소스.

### `contract/programs/open_parametric/src/errors.rs`
- state: 도메인 에러 코드(`Unauthorized`, `InvalidState`, `OracleStale` 등).
- logic: 잘못된 호출/상태를 명확한 코드로 실패시킴.

### `contract/programs/open_parametric/src/state.rs`
- state: 핵심 데이터 모델 전부.
  - enum: `PolicyState`, `UnderwritingStatus`, `ClaimStatus`, `ParticipantStatus`
  - input: `CreatePolicyParams`, `PolicyholderEntryInput`, `ParticipantInit`
  - account: `Policy`, `Underwriting`, `RiskPool`, `Claim`, `PolicyholderRegistry`
- logic: 인스트럭션이 읽고/수정하는 온체인 데이터 구조 정의.

### `contract/programs/open_parametric/src/instructions/mod.rs`
- state: 인스트럭션 모듈 연결/재노출 목록.
- logic: 각 핸들러를 `lib.rs`에서 쉽게 import 하도록 구성.

### `contract/programs/open_parametric/src/instructions/create_policy.rs`
- state: 새 보험 생성 시 초기 상태값 설정.
  - Policy=`Draft`, Underwriting=`Proposed`, Pool 잔액=0, Registry 빈 배열
- logic:
  - 입력 검증(기간, 금액, 임계값, 길이, 참여자 수)
  - 참여자 비율 합 10000(bps) 검증
  - Policy/Underwriting/RiskPool/Registry/Vault 계정 초기화

### `contract/programs/open_parametric/src/instructions/open_underwriting.rs`
- state: 보험 상태 `Draft→Open`, 인수상태 `Proposed→Open`.
- logic: 리더 권한과 상태 일치성 확인 후 모집 단계 시작.

### `contract/programs/open_parametric/src/instructions/accept_share.rs`
- state: 참여자 상태 `Pending→Accepted`, 예치액 증가, 풀 잔액 증가.
- logic:
  - 참여자 권한/토큰 mint/계정 일치 검증
  - 최소 필요 예치금 계산(`payout * ratio / 10000`) 후 SPL 전송
  - 수락 비율 합이 100%면 `Underwriting=Finalized`, `Policy=Funded`

### `contract/programs/open_parametric/src/instructions/reject_share.rs`
- state: 참여자 상태 `Pending→Rejected`.
- logic: 모집 중(Open)이고 본인 슬롯일 때만 거절 허용.

### `contract/programs/open_parametric/src/instructions/activate_policy.rs`
- state: `PolicyState Funded→Active`.
- logic: 리더만 호출 가능, `now >= active_from` 시간 조건 필수.

### `contract/programs/open_parametric/src/instructions/check_oracle.rs`
- state: 조건 충족 시 `Claim` 계정 생성 + `Policy=Claimable`.
- logic:
  - Switchboard 검증(큐/슬롯/ix sysvar + 최신성)
  - oracle 값 포맷 검증(음수 금지, scale=0, 10분 단위)
  - `delay >= threshold`면 청구 상태를 `Claimable`로 기록

### `contract/programs/open_parametric/src/instructions/approve_settle_claim.rs`
- state:
  - approve: `Claimable→Approved`, `Policy=Approved`
  - settle: `Approved→Settled`, 풀 가용잔액 차감
- logic:
  - approve는 리더 승인 기록(`approved_by`)
  - settle은 RiskPool PDA 서명으로 Vault→수익자 토큰 전송

### `contract/programs/open_parametric/src/instructions/expire_refund.rs`
- state:
  - expire: `Policy Active→Expired`
  - refund: 참여자 예치금 환급 후 `escrowed_amount=0`
- logic:
  - 만기 시간(`now > active_to`) 검사
  - 환급은 본인 참여 슬롯/상태/잔액 검증 후 PDA 서명 전송

### `contract/programs/open_parametric/src/instructions/register_policyholder.rs`
- state: `PolicyholderRegistry.entries`에 계약자 엔트리 추가.
- logic: 리더 권한, 문자열 길이, 최대 엔트리 수 제한을 검증.

### `contract/vendor/solana-program-ed25519-dalek-bump/Cargo.toml`
- state: 충돌 회피용 벤더 크레이트 메타데이터.
- logic: 특정 `solana-program` 버전을 강제해 의존성 충돌을 완화.

### `contract/vendor/solana-program-ed25519-dalek-bump/src/lib.rs`
- state: `solana_program` 재-export만 수행.
- logic: 기능 로직 없음(호환성 스텁).

---

## 3) 프론트엔드 설정: `frontend/`

### `frontend/package.json`
- state: 스크립트(dev/build/lint/deploy)와 의존성 목록.
- logic: 앱 실행/빌드/배포 명령의 진입점.

### `frontend/package-lock.json`
- state: npm 의존성 버전 스냅샷(lockfile v3, 1410 패키지).
- logic: 실행 로직 없음. 재현 가능한 설치 보장.

### `frontend/tsconfig.json`
- state: 앱 TypeScript 컴파일 옵션(엄격모드, 경로 alias `@/*`).
- logic: 타입 검사를 강하게 적용해 런타임 오류를 줄임.

### `frontend/tsconfig.node.json`
- state: Vite 설정 파일용 TS 옵션.
- logic: 노드 측 구성 파일의 타입 안전성 보장.

### `frontend/vite.config.ts`
- state: 배포 base(`/riskmesh/`), React/Emotion 플러그인, node polyfill, alias.
- logic: 빌드 도구가 라우팅/번들/JSX 처리를 어떻게 할지 결정.

### `frontend/eslint.config.js`
- state: 린트 규칙 세트(TS/React hooks/refresh/prettier).
- logic: 코드 품질 규칙 자동 적용.

### `frontend/index.html`
- state: 루트 DOM, 웹폰트, SPA fallback 스크립트.
- logic: 새로고침 시 GitHub Pages 경로 복구.

### `frontend/public/404.html`
- state: GitHub Pages용 404 리다이렉트 로직.
- logic: 딥링크 URL을 query에 인코딩해 index.html로 우회.

### `frontend/vite-env.d.ts`
- state: Vite 타입 참조 선언.
- logic: TS가 Vite 전역 타입을 인식.

---

## 4) 프론트엔드 앱 엔트리/플랫폼

### `frontend/src/main.tsx`
- state: React 앱 마운트.
- logic: `App`를 DOM `#root`에 렌더.

### `frontend/src/App.tsx`
- state: 전역 Provider 체인(Query/Solana/Theme/Toast/Router)과 초기 로그 상태.
- logic:
  - 언어 변경 시 초기 로그 문구 동기화
  - `/dashboard` 라우팅 및 기본 리다이렉트 처리

### `frontend/src/pages/Dashboard.tsx`
- state: 현재 활성 탭(`tab-contract` 등).
- logic: 탭별 화면 컴포넌트를 조건 렌더링.

### `frontend/src/providers/QueryProvider.tsx`
- state: React Query 클라이언트(staleTime/retry 옵션).
- logic: 비동기 데이터 캐시 인프라 제공.

### `frontend/src/providers/SolanaProvider.tsx`
- state: Solana RPC endpoint, 지갑 어댑터 목록(Phantom/Solflare).
- logic: 지갑 연결 컨텍스트를 앱 전체에 제공.

### `frontend/src/hooks/useProgram.ts`
- state: wallet 연결 여부, Anchor provider/program 객체(현재 mock 반환).
- logic: 지갑이 연결되면 프로그램 호출 준비 객체를 생성.

### `frontend/src/lib/constants.ts`
- state: RPC/Program ID, 정책 상태 라벨 배열.
- logic: 온체인/프론트 공통 상수 참조점.

---

## 5) 전역 상태 저장소

### `frontend/src/store/useProtocolStore.ts`
- state: 데모의 핵심 비즈니스 상태 전부.
  - 역할, 계약 진행단계, 폴리시 상태 인덱스, 참여사 컨펌, 지분율
  - 풀 잔액/누적 보험료/누적 보험금
  - 계약 목록, 클레임 목록, 누적 정산값, 로그, 차트 히스토리
- logic:
  - `setTerms`: 약관 세팅 및 초기 단계 전환
  - `confirmParty`: 참여사/재보험사 컨펌 처리
  - `activateMaster`: 전체 컨펌 완료 후 마스터 활성화
  - `addContract`: 계약 1건 추가 + 보험료 분배 계산
  - `runOracle`: 지연/신선도 검증 후 클레임 생성
  - `approveClaims`/`settleClaims`: 상태 일괄 전환
  - `addLog`/`resetAll`: 감사로그 기록 및 전체 리셋

---

## 6) i18n(다국어)

### `frontend/src/i18n/index.ts`
- state: ko/en 리소스 등록, 현재 언어(localStorage) 상태.
- logic: 언어 변경 시 localStorage와 `document.lang` 동기화.

### `frontend/src/i18n/locales/ko.ts`
- state: 한국어 UI 문구 전체 키-값 사전.
- logic: 화면 컴포넌트가 `t('키')`로 읽는 문구 원천.

### `frontend/src/i18n/locales/en.ts`
- state: 영어 UI 문구 전체 키-값 사전.
- logic: 동일 키 체계를 영어로 제공.

---

## 7) 스타일 시스템

### `frontend/src/styles/theme.ts`
- state: 색상/글로우/폰트/radius/spacing 디자인 토큰.
- logic: Emotion styled 컴포넌트가 일관된 테마 값을 사용.

### `frontend/src/styles/globalStyles.ts`
- state: CSS 변수, reset, 배경 noise, 스크롤바, 외부 지갑 버튼 오버라이드.
- logic: 앱 전체 공통 시각 스타일 초기화.

### `frontend/src/styles/emotion.d.ts`
- state: Emotion Theme 타입 확장 선언.
- logic: `p.theme` 접근 시 타입 추론 지원.

---

## 8) 공통 UI 컴포넌트: `frontend/src/components/common/`

### `Button.tsx`
- state: `variant/size/fullWidth` 스타일 상태.
- logic: 버튼 시각 변형과 disabled 동작 제공.

### `Card.tsx`
- state: 카드 컨테이너/헤더/바디 스타일.
- logic: 탭 내 섹션 UI 뼈대 통일.

### `Divider.tsx`
- state: 구분선 스타일.
- logic: 섹션 경계 시각화.

### `FlowDiagram.tsx`
- state: 정산 흐름 노드 타입(leader/accent/warning/info/danger).
- logic: 보험료/보험금 흐름을 다이어그램으로 설명.

### `Form.tsx`
- state: 공통 폼 요소 스타일(FormGroup/Input/Select/Row).
- logic: 입력 UI 일관성 유지.

### `Mono.tsx`
- state: 모노스페이스 텍스트 스타일.
- logic: 숫자/식별자 표시 가독성 향상.

### `SummaryRow.tsx`
- state: 키-값 요약 행 레이아웃.
- logic: KPI/합계 수치 표시 재사용.

### `Table.tsx`
- state: 일반 테이블/정산 테이블 스타일 + row animation.
- logic: 데이터 표 렌더링 베이스.

### `Tag.tsx`
- state: 상태 라벨 색상 variant.
- logic: `Active/Pending` 같은 상태 강조.

### `TierItem.tsx`
- state: 지연 구간 라벨/값/색상 props.
- logic: 티어 목록 반복 렌더링.

### `Toast.tsx`
- state: 현재 토스트 메시지, 타입, 표시 여부, 자동 종료 타이머.
- logic: `useToast().toast()` 호출로 전역 알림 표시.

### `index.ts`
- state: 공통 컴포넌트 export 집합.
- logic: import 경로 단순화.

---

## 9) 레이아웃 컴포넌트: `frontend/src/components/layout/`

### `Layout.tsx`
- state: 헤더 + 라우트 아웃렛 구조.
- logic: 공통 페이지 골격 제공.

### `Header.tsx`
- state: 역할, 마스터 상태, KPI(계약수/보험료/클레임/풀 잔액) 표시 상태.
- logic:
  - 역할 변경 시 스토어 업데이트 + 토스트
  - 언어 셀렉터로 i18n 전환
  - 상단 실시간 운영 지표 표시

### `TabBar.tsx`
- state: 탭 ID 목록 및 현재 활성 탭.
- logic: 탭 클릭 시 부모 상태 변경.

---

## 10) 탭: 계약 체결 `tab-contract/`

### `TabContract.tsx`
- state: 3열 레이아웃 구성 상태.
- logic: 계약 관련 하위 패널 조합.

### `MasterContractSetup.tsx`
- state: 마스터 활성 상태, 진행 단계.
- logic: 약관 세팅 버튼으로 `setTerms` 호출.

### `ShareStructure.tsx`
- state: leader/partA/partB 지분율 입력값.
- logic: 합계 100% 검증 표시, 스토어 지분 업데이트.

### `ContractProcess.tsx`
- state: 현재 프로세스 단계(`processStep`).
- logic: 단계별 완료/현재 상태 렌더링, 전체 reset 수행.

### `ParticipantConfirm.tsx`
- state: 각 참여사 컨펌 여부, 현재 역할, 활성화 가능 여부.
- logic: 권한 맞는 역할만 컨펌/활성화 실행.

### `SettlementFlow.tsx`
- state: 없음(표현 전용).
- logic: 공통 다이어그램 컴포넌트 렌더.

### `StateMachine.tsx`
- state: 정책 상태 인덱스(`policyStateIdx`).
- logic: 상태별 원형 노드 색/애니메이션으로 현재 위치 표시.

### `PoolStatus.tsx`
- state: poolBalance/totalClaim/poolHist.
- logic: 잔액/지급준비율 계산 + line chart 렌더.

### `EventLog.tsx`
- state: 스토어 로그 배열.
- logic: 최신 로그를 실시간 감사 형태로 표시.

---

## 11) 탭: 계약 피드 `tab-feed/`

### `TabFeed.tsx`
- state: 2열 레이아웃.
- logic: 입력/요약/차트/테이블 패널 결합.

### `ContractForm.tsx`
- state: 계약자명/항공편/날짜, 자동 피드 on/off 상태.
- logic: 수동 추가/1초 간격 자동 추가로 계약 데이터 생성.

### `ContractFeedTable.tsx`
- state: 계약 리스트.
- logic: 최근 계약을 표로 출력, clear 기능 제공.

### `AccumulatedSummary.tsx`
- state: 누적 보험료 및 참여자별 premium 정산 값.
- logic: 요약 카드로 누적치 표시.

### `PremiumPieChart.tsx`
- state: acc(리더/참여사/재보험 premium 몫).
- logic: 도넛 차트로 분배 비율 시각화.

### `PremiumLineChart.tsx`
- state: premHist 시간축 데이터.
- logic: 누적 보험료 추이 line chart 표시.

---

## 12) 탭: 오라클/클레임 `tab-oracle/`

### `TabOracle.tsx`
- state: 2열 레이아웃.
- logic: 오라클 콘솔과 클레임 패널 조합.

### `OracleConsole.tsx`
- state: 대상 계약, 지연분, 신선도, 실행 결과 메시지.
- logic: `runOracle` 호출, 에러/성공 결과와 토스트 처리.

### `ClaimApproval.tsx`
- state: claimable/approved/settled 개수.
- logic: 권한(role) 기반으로 승인/정산 일괄 실행.

### `ClaimTable.tsx`
- state: claims 배열.
- logic: 티어/분담/상태를 표로 표시.

### `ClaimSettlementSummary.tsx`
- state: 총 지급액과 재보험 부담 합계.
- logic: 원수사 부담 vs 재보험 부담 도넛 차트 출력.

---

## 13) 탭: 정산 `tab-settlement/`

### `TabSettlement.tsx`
- state: 메인/사이드 레이아웃.
- logic: 정산 표/차트/비교 패널 묶음.

### `PremiumSettlementTable.tsx`
- state: totalPremium, share 비율.
- logic: 보험료의 원수/출재/수수료/순정산 계산 테이블.

### `ClaimSettlementTable.tsx`
- state: totalClaim, share 비율.
- logic: 보험금의 총부담/재보험분담/수수료/순정산 계산.

### `FinalSettlementTable.tsx`
- state: 누적 premium/claim 정산값(acc)과 재보험 순효과.
- logic: 참여자별 최종 P/L 계산 결과 표시.

### `SettlementChart.tsx`
- state: 참여자별 순손익 배열.
- logic: 손익 양수/음수 색상을 달리한 bar chart 렌더.

### `ComparisonPanel.tsx`
- state: 없음(설명형 텍스트).
- logic: 전통 방식 vs 온체인 방식 장단점 비교 표시.

---

## 14) 탭: 인스펙터 `tab-inspector/`

### `TabInspector.tsx`
- state: 2열 레이아웃.
- logic: Inspector + AuditTrail 결합.

### `InspectorPanel.tsx`
- state: 마스터 활성 여부, 상태 인덱스, 정산 누적치, pseudo PDA 문자열.
- logic: 온체인 계정처럼 보이는 카드(MasterContract/RiskPool/Ledger) 구성.

### `AuditTrail.tsx`
- state: logs 배열.
- logic: 이벤트 로그를 긴 세로 목록으로 표시.

---

## 15) 기타/스킬 파일

### `skills/git-commit/SKILL.md`
- state: 커밋 시 권장 워크플로우(상태 확인→stage→메시지→commit).
- logic: 에이전트가 일관된 커밋 절차를 따르도록 규정.

---

## 16) 전체 시스템 상태 흐름 요약
- 계약 생성: `create_policy`에서 Policy/Underwriting/RiskPool/Registry 상태를 초기화.
- 인수 모집/수락: 참여자 예치가 누적되어 100% 도달 시 `Funded`.
- 보험 활성화: 시간 조건 충족 시 `Active`.
- 오라클 트리거: 지연 시간 임계값 이상이면 `Claimable`.
- 승인/정산: 리더 승인 후 Vault에서 지급, `Settled`.
- 만기/환급: 트리거 없으면 `Expired` 후 참여자 환급.

프론트 데모는 이 온체인 흐름을 `zustand` 상태머신으로 시각적으로 재현합니다.

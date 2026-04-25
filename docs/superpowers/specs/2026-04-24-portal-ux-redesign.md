# Portal UX Redesign — Design Spec

**Date:** 2026-04-24  
**Scope:** `/portal` 전체 UI/UX 개선  
**Goal:** 역할별 전문 포탈 — 전문적이고 한눈에 검토 가능한 인터페이스

---

## 1. 핵심 방향

- **역할별 완전 분리 페이지**: 한 지갑 = 한 역할. `LeaderPortal`, `ParticipantPortal`, `ReinPortal`, `OperatorPortal` 로 분리.
- **사이드바 + 메인 레이아웃**: Bloomberg 터미널 스타일. 좌측 사이드바에 역할 KPI 고정, 우측 메인에 상세 콘텐츠.
- **역할별 액션 알림**: 각 역할 Overview 상단에 즉시 조치가 필요한 사항을 배너로 표시.
- **다크/라이트 테마**: 기존 테마 시스템(`src/styles/theme.ts`) 활용, 토글 추가.

---

## 2. 레이아웃 구조

```
┌─────────────────────────────────────────────────────────┐
│ Header: [Logo] [정책 선택기 ▾] [Status] ... [지갑]       │
├──────────────┬──────────────────────────────────────────┤
│              │ [액션 배너 — 조건부]                      │
│   Sidebar    │                                          │
│              │ KPI Grid (역할별)                        │
│  역할 배지   │                                          │
│  역할별 KPI  │ 역할 전용 섹션                           │
│              │  - 리더사: 참여사 현황 (체크리스트)       │
│  Navigation  │  - 참여사: 내 지분 + 확정 상태           │
│              │  - 재보험사: 리스크 지표                  │
└──────────────┴──────────────────────────────────────────┘
```

### Header
- **정책 선택기**: `useMyPolicies`로 내 정책 목록 조회, 드롭다운으로 전환. 선택 시 `?master=<PDA>` 쿼리 파라미터 업데이트.
- **상태 배지**: 현재 선택된 MasterPolicy 상태 (Active / PendingConfirm 등)
- **테마 토글**: 다크/라이트 전환 버튼 (기존 언어 선택기 옆)
- **지갑 버튼**: 기존 `WalletMultiButton` 유지

### Sidebar (width: 200px)
- **역할 배지**: 역할색 배경 + 역할명. 역할별 색상 유지 (리더 `#9945FF`, 참여사 `#22C55E`, 재보험사 `#38BDF8`)
- **역할별 KPI** (사이드바에 항상 노출):
  - 리더사: Pool Health, Active Flights, Pending Claims
  - 참여사: My Share (%), My Pool Balance, Confirmed 상태
  - 재보험사: Ceded Ratio, Commission Rate, Max Exposure
- **Navigation**: 역할에 따라 탭 목록 다름 (아래 섹션 참조)

### Main Content
- 상단: `ActionBanner` 컴포넌트 (조건 충족 시만 표시)
- 중단: KPI Grid (3열, 역할별 다른 지표)
- 하단: 역할 전용 섹션

---

## 3. 역할별 페이지 구성

### LeaderPortal
**네비게이션:** Overview · Contracts · Risk Dashboard · Settlement · Confirm (≈ 기존 탭 유지)

**Overview KPI Grid:**
| 카드 | 색상 | 지표 |
|------|------|------|
| Pool Balance | `primary (#9945FF)` | 전체 pool 잔액 USDC |
| Total Premium | `success` | 누적 프리미엄 USDC |
| Total Claims | `danger` | 누적 지급 USDC |

**역할 전용 섹션 — 참여사 현황 (체크리스트 스타일):**
- 각 참여사/재보험사 행: 원형 아이콘(✓ 확정 / ⏳ 대기) + 이름 + 지분%
- 하단: "N/M 확정" 요약
- 미확정 인원 있을 시 `ActionBanner` (경고색) 표시

**ActionBanner 트리거 (리더사):**
- 참여사 미확정 인원 존재
- Pool 잔액 부족 (기준 TBD)

---

### ParticipantPortal
**네비게이션:** Overview · Contracts · Confirm · Settlement

**Overview KPI Grid:**
| 카드 | 색상 | 지표 |
|------|------|------|
| My Share | `success` | 내 지분 % |
| My Premium | `success` | 내 프리미엄 지분 USDC |
| My Claim Liability | `danger` | 내 클레임 부담 USDC |

**역할 전용 섹션:** 내 Pool 잔액 + Fund My Pool 입금 폼 (기존 `PortalOverview` 로직 이동)

**ActionBanner 트리거:**
- 미확정 상태 (`confirmed === false`)

---

### ReinPortal (재보험사)
**네비게이션:** Overview · Risk Dashboard · Settlement · Confirm

**Overview KPI Grid:**
| 카드 | 색상 | 지표 |
|------|------|------|
| Ceded Ratio | `info` | 출재 비율 % |
| Commission Income | `accent` | 커미션 수입 USDC |
| Max Exposure | `danger` | 최대 손실 노출 USDC |

**역할 전용 섹션:** 리스크 요약 (Risk Dashboard 축약판)

**ActionBanner 트리거:**
- 미확정 상태

---

### OperatorPortal
**네비게이션:** Overview · Contracts

**Overview:** 정책 목록 + 오라클 상태 요약 (운영사는 read-only 뷰 위주)

---

## 4. ActionBanner 컴포넌트

```
┌─────────────────────────────────────────────────────────┐
│ ⚠  [제목]  [설명 텍스트]                    [CTA 버튼] │
└─────────────────────────────────────────────────────────┘
```

- `severity`: `warning` (노랑) / `danger` (빨강) / `info` (파랑)
- `title`, `description`, `action?: { label, onClick }`
- 여러 배너가 있을 경우 스택으로 표시 (최대 2개)
- 해당 조건이 없으면 렌더링 안 함

---

## 5. 참여사 현황 UI (체크리스트 스타일)

각 행 구조:
```
[●  ✓ / ⏳]  [역할명]  [지분%]
```
- 확정: 초록 원형 아이콘 + "✓"
- 대기: 테두리만 있는 원형 + "…" (노랑)
- 재보험사는 역할색(`#38BDF8`)으로 이름 강조
- 하단 "N/M 확정" 요약 행

---

## 6. 테마 전환

- `ThemeProvider`에 `mode: 'dark' | 'light'` 상태 추가
- 토글 버튼 헤더 우측에 배치 (🌙 / ☀️ 아이콘)
- `theme.ts`의 색상 토큰을 mode에 따라 분기 (이미 있는 구조 확장)
- localStorage에 선호 테마 저장

---

## 7. 파일 구조 변경

```
src/pages/
  PortalPage.tsx          — 역할 감지 후 분기 라우터 역할만 담당
  portal/
    LeaderPortal.tsx
    ParticipantPortal.tsx
    ReinPortal.tsx
    OperatorPortal.tsx

src/components/layout/
  PortalShell.tsx         — 사이드바 + 메인 레이아웃 공통 래퍼
  PortalHeader.tsx        — 정책 선택기 + 테마 토글 추가 (기존 수정)
  PortalSidebar.tsx       — 역할 배지 + KPI + 네비 (신규)

src/components/portal/
  ActionBanner.tsx        — 액션 배너 (신규)
  ParticipantChecklist.tsx — 체크리스트 현황 (신규)
  KpiCard.tsx             — 역할별 KPI 카드 (기존 Card 확장)

src/components/tabs/tab-portal/
  (기존 컴포넌트 유지, 각 Portal 페이지에서 import)
```

---

## 8. 유지되는 것 (변경 없음)

- 모든 온체인 훅 (`useParticipantRole`, `useMyPolicies`, `useProgram`, `useSettleFlight` 등)
- 기존 탭 컴포넌트 (`PortalOverview`, `PortalContracts`, `PortalConfirm`, `PortalRiskDashboard`, `PortalSettlement`)
- IDL, PDA 유틸리티
- i18n 키 (새 키 추가만)

---

## 9. 미결 사항

- Pool 잔액 부족 기준값 (ActionBanner 트리거) — 백엔드/기획 확인 필요
- OperatorPortal 상세 기능 범위

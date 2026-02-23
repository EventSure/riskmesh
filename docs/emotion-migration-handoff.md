# Emotion Migration Handoff

> Date: 2026-02-24
> Scope: Global CSS -> Emotion styled-components (Phase 0~4)
> Status: **Complete** (all phases done, build passing)

---

## 1. Migration Summary

| Phase | 내용 | 파일 수 | 상태 |
|-------|------|---------|------|
| Phase 0 | Theme 인프라 (`theme.ts`, `emotion.d.ts`, `ThemeProvider`) | 3 | Done |
| Phase 1 | Common 컴포넌트 (`Card`, `Button`, `Tag`, `Form`, `SummaryRow`, `Divider`, `Mono`) | 8 | Done |
| Phase 2 | Header/Layout (16개 styled components + `blink` keyframes) | 1 | Done |
| Phase 3 | Dashboard 컴포넌트 9개 (StateMachine, InstructionRunner, Participants, RiskPoolAccount, OracleConsole, RiskTokenToggle, EventLog, OnChainInspector, Dashboard page) | 9 | Done |
| Phase 4 | `globalStyles.ts` 정리 (152줄 -> 32줄) | 1 | Done |

**총 제거된 글로벌 CSS 클래스: ~120개**
**`className=` 잔존 사용: 0건**

---

## 2. 현재 아키텍처

### globalStyles.ts (32줄, 유지 대상만 남음)
- `:root` CSS 변수 (16개 컬러 토큰)
- `*` reset, `html`, `body` 기본 스타일
- `body::after` noise overlay
- `::-webkit-scrollbar` 커스텀 스크롤바
- `.sub` 유틸리티 클래스
- `.wallet-adapter-button` 외부 라이브러리 오버라이드

### Theme (src/styles/theme.ts)
- `colors`, `glow`, `fonts`, `radii`, `spacing` 토큰
- `as const` 타입 추론
- `emotion.d.ts`로 `p.theme.colors.*` 타입 안전 접근

### Common Components (src/components/common/)
- `Card` (Card, CardHeader, CardTitle, CardBody)
- `Button` (variant: primary/accent/outline/danger/warning, size: sm/md, fullWidth)
- `Tag` (variant: default/subtle)
- `Form` (FormGroup, FormLabel, FormInput, FormSelect, Row2)
- `SummaryRow`, `Divider`, `Mono`

---

## 3. Code Review Findings (CCG/Codex)

### MEDIUM (3건) — 기능 개발 시 점진적 해결 권장

#### M1. RiskTokenToggle 접근성 부재
- **파일**: `src/components/dashboard/RiskTokenToggle.tsx:60`
- **현상**: 토글이 정적 `<div>`로만 구현. 키보드/스크린리더 접근 불가
- **권장**: `<button aria-pressed>` 또는 `<input type="checkbox" role="switch">` + `useState`로 교체
- **시점**: Phase 2 기능 구현 시 (현재 "Phase 2 Preview" 라벨로 비활성 상태)

#### M2. OnChainInspector 미사용 styled components
- **파일**: `src/components/dashboard/OnChainInspector.tsx`
- **현상**: `InspectorAccount`, `IaHeader`, `IaIcon`, `IaName`, `IaPda`, `IaField`, `IaKey`, `IaVal`, `PdaSeed`, `SeedChip` — 10개 컴포넌트가 정의만 되고 렌더 미사용 (placeholder)
- **권장**: 온체인 데이터 연동 시 실제 렌더로 교체. 그 전까지는 현상 유지 가능
- **시점**: 온체인 계정 조회 기능 구현 시

#### M3. Theme 토큰 vs CSS 변수 혼재
- **파일**: `StateMachine.tsx`, `InstructionRunner.tsx`, `Participants.tsx`, `Form.tsx` 등
- **현상**: 일부 컴포넌트는 `p.theme.colors.border` 사용, 일부는 `var(--border)` 직접 사용
- **권장**: 점진적으로 `theme.colors.*`로 통일. 우선순위 낮음 — 둘 다 동일 값을 참조하므로 기능상 문제 없음
- **시점**: 각 컴포넌트 수정 시 기회적으로 교체

### LOW (3건) — 정리 시 함께 처리

| # | 파일 | 이슈 | 권장 |
|---|------|------|------|
| L1 | `globalStyles.ts:24` | `.sub` 클래스 잔존, 사용처 없음 | 삭제 |
| L2 | `Form.tsx` | `FormSelect`, `Row2` export되나 미사용 | 사용 시까지 유지 또는 삭제 |
| L3 | `EventLog.tsx` | 내부 styled components 불필요 export | export 제거 |

---

## 4. Build Verification

```
TypeScript: 0 errors (npx tsc -b --noEmit)
Vite Build:  success (5.94s)
  - index.css    4.86 kB (gzip 1.36 kB)
  - index.js    17.67 kB (gzip 5.51 kB)
  - index.js    34.38 kB (gzip 7.82 kB)
  - index.js   748.36 kB (gzip 233.15 kB) ← Solana deps, chunk split 권장
```

---

## 5. 후속 작업 체크리스트

- [ ] M1: RiskTokenToggle에 실제 toggle 인터랙션 + 접근성 추가
- [ ] M2: OnChainInspector에 실제 온체인 계정 데이터 렌더링
- [ ] M3: `var(--*)` -> `theme.colors.*` 점진 통일 (기회적)
- [ ] L1: `.sub` 글로벌 클래스 삭제
- [ ] L2/L3: 미사용 export 정리
- [ ] Vite chunk splitting (manualChunks로 Solana 의존성 분리)
- [ ] InstructionRunner 미사용 변수 정리 (StepChecks, CheckItem)

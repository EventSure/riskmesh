import React, { useState } from 'react';
import styled from '@emotion/styled';

/* ── ActionPanel shell ── */

export const ActionPanel = styled.div`
  width: 288px;
  flex-shrink: 0;
  border-right: 1px solid ${p => p.theme.colors.border};
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: ${p => p.theme.colors.bg};
  /* 높이 제약 — flex chain이 정상이면 height:100% 만으로 충분. 그래도 안전차원에서
     viewport 기준 max-height(헤더 ~140px 추정)도 같이 걸어둔다. align-self:stretch를 명시하여
     row flex 부모에서 cross-axis가 컨텐츠 크기로 부풀지 않게 한다. */
  align-self: stretch;
  height: 100%;
  max-height: calc(100vh - 140px);
  min-height: 0;
`;

export const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 13px 15px;
  border-bottom: 1px solid ${p => p.theme.colors.border};
  flex-shrink: 0;
`;

export const PanelTitle = styled.div`
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: ${p => p.theme.colors.sub};
`;

export const PanelStatusBadge = styled.span<{ variant?: 'warning' | 'accent' | 'primary' }>`
  font-size: 9px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
  border: 1px solid;
  ${p => {
    switch (p.variant) {
      case 'accent':
        return `background: rgba(20,241,149,0.08); color: ${p.theme.colors.accent}; border-color: rgba(20,241,149,0.25);`;
      case 'warning':
        return `background: rgba(245,158,11,0.08); color: ${p.theme.colors.warning}; border-color: rgba(245,158,11,0.25);`;
      default:
        return `background: rgba(153,69,255,0.08); color: ${p.theme.colors.primary}; border-color: rgba(153,69,255,0.25);`;
    }
  }}
`;

export const StepsScroll = styled.div`
  flex: 1;
  /* min-height: 0 — flex column 안에서 overflow-y: auto가 실제로 작동하려면 필수.
     없으면 자식 컨텐츠의 내재 높이만큼 확장되어 스크롤이 활성화되지 않는다. */
  min-height: 0;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  /* 자식 Card들이 flex-shrink:1 기본값으로 줄어들어 컨텐츠를 잘라먹는 걸 방지.
     이게 빠지면 Card의 overflow:hidden이 CardBody 하단을 클립해 버튼이 사라진다. */
  > * { flex-shrink: 0; }
  /* 스크롤 가능 여부를 사용자가 인지할 수 있도록 스크롤바를 충분히 보이게 */
  scrollbar-width: thin;
  scrollbar-color: ${p => p.theme.colors.border2} transparent;

  &::-webkit-scrollbar { width: 8px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb {
    background: ${p => p.theme.colors.border2};
    border-radius: 4px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: ${p => p.theme.colors.sub};
    background-clip: padding-box;
    border: 2px solid transparent;
  }
`;

export const ContentArea = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;

  &::-webkit-scrollbar { width: 3px; }
  &::-webkit-scrollbar-thumb { background: ${p => p.theme.colors.border2}; border-radius: 2px; }
`;

/* ── Step Progress Bar ── */

const ProgressWrap = styled.div`
  display: flex;
  align-items: center;
  padding: 12px 15px;
  border-bottom: 1px solid ${p => p.theme.colors.border};
  flex-shrink: 0;
`;

const StepNode = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
`;

const StepCircle = styled.div<{ status: 'done' | 'active' | 'locked' }>`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 700;
  ${p => {
    switch (p.status) {
      case 'done':
        return `background: ${p.theme.colors.accent}; color: ${p.theme.colors.bg};`;
      case 'active':
        return `background: ${p.theme.colors.primary}; color: #fff; box-shadow: 0 0 0 3px rgba(153,69,255,0.15);`;
      case 'locked':
        return `background: ${p.theme.colors.surface2}; border: 1px solid ${p.theme.colors.border2}; color: ${p.theme.colors.sub};`;
    }
  }}
`;

const StepLabel = styled.div<{ status: 'done' | 'active' | 'locked' }>`
  font-size: 8px;
  font-weight: 600;
  color: ${p => {
    switch (p.status) {
      case 'done': return p.theme.colors.accent;
      case 'active': return p.theme.colors.primary;
      case 'locked': return '#374151';
    }
  }};
`;

const StepLine = styled.div<{ done?: boolean }>`
  flex: 1;
  height: 1px;
  margin: 0 4px;
  margin-bottom: 17px;
  background: ${p => p.done
    ? `linear-gradient(90deg, rgba(20,241,149,0.35), rgba(153,69,255,0.3))`
    : p.theme.colors.border};
`;

export interface StepDef {
  label: string;
  status: 'done' | 'active' | 'locked';
}

export function StepProgressBar({ steps }: { steps: StepDef[] }) {
  return (
    <ProgressWrap>
      {steps.map((step, i) => (
        <React.Fragment key={step.label}>
          <StepNode>
            <StepCircle status={step.status}>
              {step.status === 'done' ? '✓' : i + 1}
            </StepCircle>
            <StepLabel status={step.status}>{step.label}</StepLabel>
          </StepNode>
          {i < steps.length - 1 && <StepLine done={step.status === 'done'} />}
        </React.Fragment>
      ))}
    </ProgressWrap>
  );
}

/* ── Step Card (accordion) ── */

const CardWrap = styled.div<{ status: 'done' | 'active' | 'locked' }>`
  border-radius: 8px;
  border: 1px solid;
  overflow: hidden;
  ${p => {
    switch (p.status) {
      case 'done':
        return `border-color: rgba(20,241,149,0.13); background: rgba(20,241,149,0.04);`;
      case 'active':
        return `border-color: rgba(153,69,255,0.27); background: rgba(153,69,255,0.05); box-shadow: 0 0 0 1px rgba(153,69,255,0.1);`;
      case 'locked':
        return `border-color: ${p.theme.colors.border}; opacity: 0.4;`;
    }
  }}
`;

const CardHeader = styled.div<{ clickable: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 11px;
  cursor: ${p => (p.clickable ? 'pointer' : 'default')};
  user-select: none;

  &:hover {
    ${p => p.clickable && `background: rgba(255,255,255,0.02);`}
  }
`;

const CardLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const CardBadge = styled.div<{ status: 'done' | 'active' | 'locked' }>`
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  font-weight: 700;
  flex-shrink: 0;
  ${p => {
    switch (p.status) {
      case 'done': return `background: ${p.theme.colors.accent}; color: ${p.theme.colors.bg};`;
      case 'active': return `background: ${p.theme.colors.primary}; color: #fff;`;
      case 'locked': return `background: ${p.theme.colors.surface2}; color: #374151;`;
    }
  }}
`;

const CardTitle = styled.div<{ status: 'done' | 'active' | 'locked' }>`
  font-size: 10px;
  font-weight: 600;
  color: ${p => {
    switch (p.status) {
      case 'done': return p.theme.colors.sub;
      case 'active': return p.theme.colors.text;
      case 'locked': return '#374151';
    }
  }};
`;

const Chevron = styled.span<{ open: boolean }>`
  font-size: 9px;
  color: #374151;
  transition: transform 0.2s;
  transform: ${p => (p.open ? 'rotate(180deg)' : 'none')};
`;

const CardBody = styled.div`
  padding: 2px 11px 11px;
`;

interface StepCardProps {
  index: number;
  title: string;
  status: 'done' | 'active' | 'locked';
  meta?: string;
  children?: React.ReactNode;
}

export function StepCard({ index, title, status, meta, children }: StepCardProps) {
  const [open, setOpen] = useState(status === 'done');

  const isOpen = status === 'active' || (status === 'done' && open);
  const clickable = status === 'done';

  const handleClick = () => {
    if (clickable) setOpen(prev => !prev);
  };

  return (
    <CardWrap status={status}>
      <CardHeader clickable={clickable} onClick={handleClick}>
        <CardLeft>
          <CardBadge status={status}>
            {status === 'done' ? '✓' : index + 1}
          </CardBadge>
          <CardTitle status={status}>{title}</CardTitle>
        </CardLeft>
        {status === 'locked'
          ? <span style={{ fontSize: 9, color: '#374151' }}>{meta ?? '이전 단계 완료 후'}</span>
          : <Chevron open={isOpen}>▾</Chevron>
        }
      </CardHeader>
      {isOpen && children && <CardBody>{children}</CardBody>}
    </CardWrap>
  );
}

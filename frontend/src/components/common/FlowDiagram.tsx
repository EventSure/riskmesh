import styled from '@emotion/styled';

type NodeVariant = 'leader' | 'accent' | 'warning' | 'info' | 'danger';

const FlowWrap = styled.div`
  padding: 12px;
`;

const FlowRow = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 7px;
`;

const FlowNode = styled.div<{ variant: NodeVariant }>`
  padding: 5px 8px;
  border-radius: 7px;
  border: 1px solid;
  font-size: 9px;
  font-weight: 600;
  text-align: center;
  flex: 1;

  ${p => p.variant === 'leader' && `border-color:rgba(153,69,255,.4);background:rgba(153,69,255,.07);color:${p.theme.colors.primary};`}
  ${p => p.variant === 'accent' && `border-color:rgba(20,241,149,.4);background:rgba(20,241,149,.07);color:${p.theme.colors.accent};`}
  ${p => p.variant === 'warning' && `border-color:rgba(245,158,11,.4);background:rgba(245,158,11,.07);color:${p.theme.colors.warning};`}
  ${p => p.variant === 'info' && `border-color:rgba(56,189,248,.4);background:rgba(56,189,248,.07);color:${p.theme.colors.info};`}
  ${p => p.variant === 'danger' && `border-color:rgba(239,68,68,.4);background:rgba(239,68,68,.07);color:${p.theme.colors.danger};`}
`;

const FlowAmount = styled.div`
  font-size: 8px;
  font-family: ${p => p.theme.fonts.mono};
  margin-top: 1px;
  opacity: 0.8;
`;

const FlowArrow = styled.div`
  font-size: 13px;
  color: ${p => p.theme.colors.sub};
  flex-shrink: 0;
`;

const FlowTitle = styled.div`
  font-size: 9px;
  color: ${p => p.theme.colors.sub};
  font-weight: 700;
  margin-bottom: 6px;
`;

const FlowNote = styled.div`
  font-size: 8px;
  color: ${p => p.theme.colors.sub};
  margin-top: 2px;
`;

export function SettlementFlowDiagram() {
  return (
    <FlowWrap>
      <FlowTitle>💰 보험료 흐름 (계약 즉시)</FlowTitle>
      <FlowRow>
        <FlowNode variant="danger">계약자<FlowAmount>1 USDC</FlowAmount></FlowNode>
        <FlowArrow>→</FlowArrow>
        <FlowNode variant="leader">원수사<FlowAmount>지분별 배분</FlowAmount></FlowNode>
        <FlowArrow>→</FlowArrow>
        <FlowNode variant="info">재보험사<FlowAmount>각 지분의 50%</FlowAmount></FlowNode>
      </FlowRow>
      <FlowNote>※ 재보험사→원수사 수수료 10% 환급</FlowNote>

      <FlowTitle style={{ marginTop: 8 }}>💸 보험금 흐름 (오라클 트리거 즉시)</FlowTitle>
      <FlowRow>
        <FlowNode variant="info">재보험사<FlowAmount>50% 분담</FlowAmount></FlowNode>
        <FlowArrow>+</FlowArrow>
        <FlowNode variant="leader">원수사Pool<FlowAmount>50% 분담</FlowAmount></FlowNode>
        <FlowArrow>→</FlowArrow>
        <FlowNode variant="danger">계약자<FlowAmount>구간별 지급</FlowAmount></FlowNode>
      </FlowRow>
      <FlowNote>※ 원수사→재보험사 수수료 10% (보험금 기준)</FlowNote>
    </FlowWrap>
  );
}

export { FlowWrap, FlowRow, FlowNode, FlowAmount, FlowArrow, FlowTitle, FlowNote };

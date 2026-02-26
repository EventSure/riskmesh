import styled from '@emotion/styled';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();

  return (
    <FlowWrap>
      <FlowTitle>{t('flow.premiumTitle')}</FlowTitle>
      <FlowRow>
        <FlowNode variant="danger">{t('flow.policyholder')}<FlowAmount>1 USDC</FlowAmount></FlowNode>
        <FlowArrow>→</FlowArrow>
        <FlowNode variant="leader">{t('flow.primaryIns')}<FlowAmount>{t('flow.shareBasedSplit')}</FlowAmount></FlowNode>
        <FlowArrow>→</FlowArrow>
        <FlowNode variant="info">{t('flow.reinsurer')}<FlowAmount>{t('flow.eachShare50')}</FlowAmount></FlowNode>
      </FlowRow>
      <FlowNote>{t('flow.premiumNote')}</FlowNote>

      <FlowTitle style={{ marginTop: 8 }}>{t('flow.claimTitle')}</FlowTitle>
      <FlowRow>
        <FlowNode variant="info">{t('flow.reinsurer')}<FlowAmount>{t('flow.rein50Share')}</FlowAmount></FlowNode>
        <FlowArrow>+</FlowArrow>
        <FlowNode variant="leader">{t('flow.primaryPool')}<FlowAmount>{t('flow.rein50Share')}</FlowAmount></FlowNode>
        <FlowArrow>→</FlowArrow>
        <FlowNode variant="danger">{t('flow.policyholder')}<FlowAmount>{t('flow.tierPayout')}</FlowAmount></FlowNode>
      </FlowRow>
      <FlowNote>{t('flow.claimNote')}</FlowNote>
    </FlowWrap>
  );
}

export { FlowWrap, FlowRow, FlowNode, FlowAmount, FlowArrow, FlowTitle, FlowNote };

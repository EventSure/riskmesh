import styled from '@emotion/styled';
import { useTranslation } from 'react-i18next';
import { PoolStatus } from '../tab-contract/PoolStatus';
import { SettlementFlow } from '../tab-contract/SettlementFlow';
import { StateMachine } from '../tab-contract/StateMachine';
import { InspectorPanel } from './InspectorPanel';
import { AuditTrail } from './AuditTrail';

const Shell = styled.section`
  flex: 1;
  min-width: 0;
  overflow: auto;
  padding: 20px;
  background: ${p => p.theme.colors.bg};
`;

const Intro = styled.header`
  margin-bottom: 18px;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: ${p => p.theme.colors.text};
`;

const Subtitle = styled.p`
  margin: 6px 0 0;
  max-width: 760px;
  font-size: 13px;
  line-height: 1.6;
  color: ${p => p.theme.colors.sub};
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.9fr);
  gap: 16px;
  align-items: start;

  @media (max-width: 1198px) {
    grid-template-columns: 1fr;
  }
`;

const Column = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
`;

export function TabInspector() {
  const { t } = useTranslation();

  return (
    <Shell>
      <Intro>
        <Title>{t('help.title')}</Title>
        <Subtitle>{t('help.subtitle')}</Subtitle>
      </Intro>
      <Grid>
        <Column>
          <StateMachine />
          <SettlementFlow />
          <AuditTrail />
        </Column>
        <Column>
          <PoolStatus />
          <InspectorPanel />
        </Column>
      </Grid>
    </Shell>
  );
}

import styled from '@emotion/styled';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardBody, Tag } from '@/components/common';
import type { CollateralPartyStatus, CollateralState, CollateralStatus } from '@/lib/collateral';
import { formatNum } from '@/store/useProtocolStore';

interface PoolHealthVisualProps {
  title: string;
  status: CollateralStatus;
  activePartyId?: string;
}

type StateMeta = {
  label: string;
  tagVariant: 'accent' | 'warning' | 'danger';
  colorKey: 'accent' | 'warning' | 'danger';
};

type Translate = ReturnType<typeof useTranslation>['t'];

function getStateMeta(state: CollateralState, t: Translate): StateMeta {
  if (state === 'ready') {
    return { label: t('pool.healthStateReady'), tagVariant: 'accent', colorKey: 'accent' };
  }

  if (state === 'pending_confirm') {
    return { label: t('pool.healthStatePending'), tagVariant: 'warning', colorKey: 'warning' };
  }

  return { label: t('pool.healthStateUnderfunded'), tagVariant: 'danger', colorKey: 'danger' };
}

function getAggregateMeta(status: CollateralStatus, t: Translate): StateMeta {
  if (status.aggregateReady) {
    return { label: t('pool.healthAggregateReady'), tagVariant: 'accent', colorKey: 'accent' };
  }

  if (status.parties.some(party => party.state === 'pending_confirm')) {
    return { label: t('pool.healthStatePending'), tagVariant: 'warning', colorKey: 'warning' };
  }

  if (status.parties.some(party => party.state === 'underfunded') || status.totalDeficit > 0) {
    return { label: t('pool.healthStateUnderfunded'), tagVariant: 'danger', colorKey: 'danger' };
  }

  return { label: t('pool.healthAggregateActionNeeded'), tagVariant: 'warning', colorKey: 'warning' };
}

function getRoleLabel(party: CollateralPartyStatus, t: Translate): string {
  if (party.role === 'leader') return t('pool.healthRoleLeader');
  if (party.role === 'reinsurer') return t('pool.healthRoleReinsurer');
  return t('pool.healthRoleParticipant');
}

function getPartyDisplayName(party: CollateralPartyStatus, t: Translate): string {
  if (party.role === 'leader') return t('pool.healthRoleLeader');
  if (party.role === 'reinsurer') return t('pool.healthRoleReinsurer');

  const participantNumber = party.id.startsWith('participant-')
    ? Number(party.id.replace('participant-', ''))
    : NaN;

  if (Number.isInteger(participantNumber) && participantNumber > 0) {
    return t('pool.healthParticipantName', { number: participantNumber });
  }

  return party.label;
}

export function PoolHealthVisual({ title, status, activePartyId }: PoolHealthVisualProps) {
  const { t } = useTranslation();
  const aggregateMeta = getAggregateMeta(status, t);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <Tag variant={aggregateMeta.tagVariant}>{aggregateMeta.label}</Tag>
      </CardHeader>
      <CardBody>
        <Content>
          <TopSection>
            <SummaryGrid>
              <MetricBlock>
                <MetricLabel>{t('pool.healthTotal')}</MetricLabel>
                <MetricValue>{formatNum(status.totalHealthPct, 1)}%</MetricValue>
              </MetricBlock>
              <MetricBlock>
                <MetricLabel>{t('pool.healthFunded')}</MetricLabel>
                <MetricValue>{formatNum(status.totalFunded, 2)} USDC</MetricValue>
              </MetricBlock>
              <MetricBlock>
                <MetricLabel>{t('pool.healthRequired')}</MetricLabel>
                <MetricValue>{formatNum(status.totalRequired, 2)} USDC</MetricValue>
              </MetricBlock>
              <MetricBlock>
                <MetricLabel>{t('pool.healthDeficit')}</MetricLabel>
                <MetricValue tone={status.totalDeficit > 0 ? 'danger' : 'sub'}>
                  {formatNum(status.totalDeficit, 2)} USDC
                </MetricValue>
              </MetricBlock>
            </SummaryGrid>
            <TotalBarSection>
              <TotalBarMeta>
                <TotalBarLabel>{t('pool.healthCoverage')}</TotalBarLabel>
                <TotalBarValue>{formatNum(status.totalFunded, 2)} / {formatNum(status.totalRequired, 2)} USDC</TotalBarValue>
              </TotalBarMeta>
              <BarTrack>
                <BarFill
                  colorKey={aggregateMeta.colorKey}
                  widthPct={status.totalHealthPct}
                />
              </BarTrack>
            </TotalBarSection>
          </TopSection>

          <PartyList>
            {status.parties.map((party) => {
              const stateMeta = getStateMeta(party.state, t);
              const isActive = activePartyId === party.id;
              const deltaLabel = party.deficit > 0
                ? t('pool.healthDeficit')
                : party.surplus > 0 ? t('pool.healthSurplus') : t('pool.healthBalanced');
              const deltaValue = party.deficit > 0 ? party.deficit : party.surplus;
              const deltaTone = party.deficit > 0 ? 'danger' : party.surplus > 0 ? 'accent' : 'sub';
              const displayName = getPartyDisplayName(party, t);

              return (
                <PartyRow key={party.id} active={isActive}>
                  <PartyHeader>
                    <PartyIdentity>
                      <PartyName title={displayName}>{displayName}</PartyName>
                      <PartyMeta>
                        <PartyMetaText>{getRoleLabel(party, t)}</PartyMetaText>
                        <PartyMetaDot aria-hidden="true" />
                        <PartyMetaText>{formatNum(party.shareBps / 100, 0)}%</PartyMetaText>
                        {isActive ? (
                          <>
                            <PartyMetaDot aria-hidden="true" />
                            <PartyMetaText tone="accent">{t('pool.healthActive')}</PartyMetaText>
                          </>
                        ) : null}
                      </PartyMeta>
                    </PartyIdentity>
                    <PartyTags>
                      <Tag variant={stateMeta.tagVariant}>{stateMeta.label}</Tag>
                      <PctValue>{formatNum(party.fundedPct, 1)}%</PctValue>
                    </PartyTags>
                  </PartyHeader>

                  <BarTrack>
                    <BarFill colorKey={stateMeta.colorKey} widthPct={party.fundedPct} />
                  </BarTrack>

                  <PartyMetrics>
                    <PartyMetric>
                      <PartyMetricLabel>{t('pool.healthFunded')}</PartyMetricLabel>
                      <PartyMetricValue>{formatNum(party.balance, 2)} USDC</PartyMetricValue>
                    </PartyMetric>
                    <PartyMetric>
                      <PartyMetricLabel>{t('pool.healthRequired')}</PartyMetricLabel>
                      <PartyMetricValue>{formatNum(party.required, 2)} USDC</PartyMetricValue>
                    </PartyMetric>
                    <PartyMetric>
                      <PartyMetricLabel>{deltaLabel}</PartyMetricLabel>
                      <PartyMetricValue tone={deltaTone}>
                        {formatNum(deltaValue, 2)} USDC
                      </PartyMetricValue>
                    </PartyMetric>
                  </PartyMetrics>
                </PartyRow>
              );
            })}
          </PartyList>
        </Content>
      </CardBody>
    </Card>
  );
}

const Content = styled.div`
  display: grid;
  gap: 14px;
`;

const TopSection = styled.div`
  display: grid;
  gap: 12px;
`;

const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
`;

const MetricBlock = styled.div`
  min-width: 0;
  padding: 10px;
  border: 1px solid ${p => p.theme.colors.border};
  border-radius: 12px;
  background: ${p => p.theme.colors.surface2};
  display: grid;
  gap: 4px;
`;

const MetricLabel = styled.span`
  font-size: 10px;
  color: ${p => p.theme.colors.sub};
  text-transform: uppercase;
  letter-spacing: 0.08em;
`;

const MetricValue = styled.span<{ tone?: 'text' | 'sub' | 'danger' | 'accent' }>`
  min-width: 0;
  font-family: ${p => p.theme.fonts.mono};
  font-size: 12px;
  font-weight: 700;
  color: ${p => {
    if (p.tone === 'danger') return p.theme.colors.danger;
    if (p.tone === 'accent') return p.theme.colors.accent;
    if (p.tone === 'sub') return p.theme.colors.sub;
    return p.theme.colors.text;
  }};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TotalBarSection = styled.div`
  display: grid;
  gap: 8px;
`;

const TotalBarMeta = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
`;

const TotalBarLabel = styled.span`
  font-size: 11px;
  font-weight: 600;
  color: ${p => p.theme.colors.text};
`;

const TotalBarValue = styled.span`
  font-family: ${p => p.theme.fonts.mono};
  font-size: 11px;
  color: ${p => p.theme.colors.sub};
`;

const PartyList = styled.div`
  display: grid;
  gap: 10px;
`;

const PartyRow = styled.div<{ active: boolean }>`
  min-width: 0;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid ${p => p.active ? p.theme.colors.border2 : p.theme.colors.border};
  background: ${p => p.active ? p.theme.colors.surface3 : p.theme.colors.surface2};
  box-shadow: ${p => p.active ? `inset 0 0 0 1px ${p.theme.glowSubtle.accent}` : 'none'};
  display: grid;
  gap: 10px;
`;

const PartyHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  flex-wrap: wrap;
`;

const PartyIdentity = styled.div`
  min-width: 0;
  display: grid;
  gap: 4px;
  flex: 1 1 180px;
`;

const PartyName = styled.span`
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: ${p => p.theme.colors.text};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PartyMeta = styled.div`
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
`;

const PartyMetaText = styled.span<{ tone?: 'sub' | 'accent' }>`
  font-size: 10px;
  color: ${p => p.tone === 'accent' ? p.theme.colors.accent : p.theme.colors.sub};
  text-transform: uppercase;
  letter-spacing: 0.08em;
`;

const PartyMetaDot = styled.span`
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: ${p => p.theme.colors.border2};
  flex: 0 0 auto;
`;

const PartyTags = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const PctValue = styled.span`
  font-family: ${p => p.theme.fonts.mono};
  font-size: 11px;
  font-weight: 700;
  color: ${p => p.theme.colors.text};
`;

const BarTrack = styled.div`
  position: relative;
  height: 10px;
  border-radius: 999px;
  background: ${p => p.theme.colors.surface1};
  border: 1px solid ${p => p.theme.colors.border};
  overflow: hidden;
`;

const BarFill = styled.div<{ colorKey: 'accent' | 'warning' | 'danger'; widthPct: number }>`
  height: 100%;
  width: ${p => Math.max(0, Math.min(100, p.widthPct))}%;
  border-radius: inherit;
  background: ${p => p.theme.colors[p.colorKey]};
  box-shadow: ${p => `0 0 18px ${p.theme.glowSubtle[p.colorKey]}`};
  transition: width 160ms ease;
`;

const PartyMetrics = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
`;

const PartyMetric = styled.div`
  min-width: 0;
  display: grid;
  gap: 2px;
`;

const PartyMetricLabel = styled.span`
  font-size: 10px;
  color: ${p => p.theme.colors.sub};
  text-transform: uppercase;
  letter-spacing: 0.08em;
`;

const PartyMetricValue = styled.span<{ tone?: 'sub' | 'danger' | 'accent' }>`
  min-width: 0;
  font-family: ${p => p.theme.fonts.mono};
  font-size: 11px;
  font-weight: 600;
  color: ${p => {
    if (p.tone === 'danger') return p.theme.colors.danger;
    if (p.tone === 'accent') return p.theme.colors.accent;
    if (p.tone === 'sub') return p.theme.colors.sub;
    return p.theme.colors.text;
  }};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

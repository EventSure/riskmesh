import styled from '@emotion/styled';
import { useEffect, useState } from 'react';
import { Button, FormInput } from '@/components/common';
import { MAX_PARTICIPANTS, PARTICIPANT_COLORS, REINSURER_COLOR, useProtocolStore, type ProtocolMode } from '@/store/useProtocolStore';
import { useTranslation } from 'react-i18next';

interface ParticipationStructureProps {
  mode: ProtocolMode;
  locked: boolean;
}

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const SectionTitle = styled.div`
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${p => p.theme.colors.sub};
`;

const Hint = styled.div`
  font-size: 10px;
  line-height: 1.45;
  color: ${p => p.theme.colors.sub};
`;

const TotalPill = styled.div<{ valid: boolean }>`
  flex: 0 0 auto;
  padding: 3px 7px;
  border-radius: 999px;
  border: 1px solid ${({ valid, theme }) => (valid ? theme.colors.success : theme.colors.danger)};
  color: ${({ valid, theme }) => (valid ? theme.colors.success : theme.colors.danger)};
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  font-weight: 700;
`;

const PartyCard = styled.div<{ accent: string }>`
  border: 1px solid ${p => p.theme.colors.border};
  border-left: 3px solid ${p => p.accent};
  border-radius: 8px;
  background: ${p => p.theme.colors.card2};
  padding: 9px;
`;

const PartyHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 7px;
`;

const PartyTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: ${p => p.theme.colors.text};
  font-size: 12px;
  font-weight: 700;
`;

const Swatch = styled.span<{ color: string }>`
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: ${p => p.color};
`;

const RemoveButton = styled.button`
  flex: 0 0 auto;
  background: transparent;
  border: 0;
  color: ${p => p.theme.colors.danger};
  cursor: pointer;
  font-size: 15px;
  line-height: 1;
  padding: 1px 4px;
`;

const FieldGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 96px;
  gap: 6px;

  @media (max-width: 767px) {
    grid-template-columns: 1fr;
  }
`;

const ShareField = styled.div`
  position: relative;
`;

const ShareInput = styled(FormInput)`
  padding-right: 22px;
`;

const ShareSuffix = styled.span`
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: ${p => p.theme.colors.sub};
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  pointer-events: none;
`;

const AddressRow = styled.div`
  margin-top: 6px;
`;

const MiniLabel = styled.label`
  display: block;
  margin-bottom: 3px;
  color: ${p => p.theme.colors.sub};
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
`;

const ReinsuranceGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin-top: 7px;

  @media (max-width: 767px) {
    grid-template-columns: 1fr;
  }
`;

const Metric = styled.div`
  border: 1px solid ${p => p.theme.colors.border};
  border-radius: 7px;
  padding: 6px;
`;

const MetricLabel = styled.div`
  color: ${p => p.theme.colors.sub};
  font-size: 9px;
  margin-bottom: 3px;
`;

const MetricValue = styled.div`
  color: ${p => p.theme.colors.accent};
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  font-weight: 700;
`;

const inputOpacity = (locked: boolean) => ({ opacity: locked ? 0.6 : 1 });
const digitsOnly = (value: string) => value.replace(/\D+/g, '');
const normalizeShareWhileTyping = (value: string) => {
  const digits = digitsOnly(value);
  if (!digits) return '';
  return String(Math.min(100, parseInt(digits, 10)));
};
const normalizeShare = (value: string) => {
  const digits = digitsOnly(value);
  if (!digits) return '0';
  return String(Math.min(100, parseInt(digits, 10)));
};

export function ParticipationStructure({ mode, locked }: ParticipationStructureProps) {
  const { leaderShare, setLeaderShare, participants, addParticipant, removeParticipant, updateParticipant, reinsurer, setReinsurer, toggleReinsurer } = useProtocolStore();
  const { t } = useTranslation();
  const [leaderShareInput, setLeaderShareInput] = useState(String(leaderShare));
  const [participantShareInputs, setParticipantShareInputs] = useState<Record<string, string>>(
    () => Object.fromEntries(participants.map(p => [p.id, String(p.share)])),
  );
  const total = leaderShare + participants.reduce((s, p) => s + p.share, 0);
  const valid = total === 100;

  useEffect(() => {
    setLeaderShareInput(String(leaderShare));
  }, [leaderShare]);

  useEffect(() => {
    setParticipantShareInputs(Object.fromEntries(participants.map(p => [p.id, String(p.share)])));
  }, [participants]);

  const handleLeaderShareChange = (value: string) => {
    const normalized = normalizeShareWhileTyping(value);
    setLeaderShareInput(normalized);
    if (normalized !== '') setLeaderShare(parseInt(normalized, 10));
  };

  const commitLeaderShare = () => {
    const normalized = normalizeShare(leaderShareInput);
    setLeaderShareInput(normalized);
    setLeaderShare(parseInt(normalized, 10));
  };

  const handleParticipantShareChange = (id: string, value: string) => {
    const normalized = normalizeShareWhileTyping(value);
    setParticipantShareInputs(prev => ({ ...prev, [id]: normalized }));
    if (normalized !== '') updateParticipant(id, { share: parseInt(normalized, 10) });
  };

  const commitParticipantShare = (id: string) => {
    const normalized = normalizeShare(participantShareInputs[id] ?? '');
    setParticipantShareInputs(prev => ({ ...prev, [id]: normalized }));
    updateParticipant(id, { share: parseInt(normalized, 10) });
  };

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>{t('party.title')}</SectionTitle>
        <TotalPill valid={valid}>{t('common.total')}: {total}%</TotalPill>
      </SectionHeader>
      <Hint>{mode === 'onchain' ? t('party.onchainHint') : t('party.simulationHint')}</Hint>

      <PartyCard accent="#9945FF" data-testid="leader-party">
        <PartyHeader>
          <PartyTitle><Swatch color="#9945FF" />{t('party.leader')}</PartyTitle>
        </PartyHeader>
        <MiniLabel>{t('party.share')}</MiniLabel>
        <ShareField>
          <ShareInput
            type="text"
            inputMode="numeric"
            value={leaderShareInput}
            onChange={e => handleLeaderShareChange(e.target.value)}
            onBlur={commitLeaderShare}
            readOnly={locked}
            style={{ ...inputOpacity(locked), textAlign: 'right' }}
          />
          <ShareSuffix data-testid="share-suffix-leader">%</ShareSuffix>
        </ShareField>
      </PartyCard>

      {participants.map((p, i) => {
        const label = p.name || `${t('share.participant')} ${i + 1}`;
        const color = PARTICIPANT_COLORS[i] || PARTICIPANT_COLORS[0];
        return (
          <PartyCard key={p.id} accent={color} data-testid={`participant-party-${p.id}`}>
            <PartyHeader>
              <PartyTitle><Swatch color={color} />{label}</PartyTitle>
              {!locked && participants.length > 1 && (
                <RemoveButton onClick={() => removeParticipant(p.id)} title={t('share.removeParticipant')}>-</RemoveButton>
              )}
            </PartyHeader>
            <FieldGrid>
              <div>
                <MiniLabel>{t('party.name')}</MiniLabel>
                <FormInput
                  placeholder={t('share.namePlaceholder')}
                  value={p.name}
                  onChange={e => updateParticipant(p.id, { name: e.target.value })}
                  readOnly={locked}
                  style={inputOpacity(locked)}
                />
              </div>
              <div>
                <MiniLabel>{t('party.share')}</MiniLabel>
                <ShareField>
                  <ShareInput
                    type="text"
                    inputMode="numeric"
                    value={participantShareInputs[p.id] ?? String(p.share)}
                    onChange={e => handleParticipantShareChange(p.id, e.target.value)}
                    onBlur={() => commitParticipantShare(p.id)}
                    readOnly={locked}
                    style={{ ...inputOpacity(locked), textAlign: 'right' }}
                  />
                  <ShareSuffix data-testid={`share-suffix-${p.id}`}>%</ShareSuffix>
                </ShareField>
              </div>
            </FieldGrid>
            {mode === 'onchain' && (
              <AddressRow>
                <MiniLabel>{t('party.walletAddress')}</MiniLabel>
                <FormInput
                  value={p.address}
                  onChange={e => updateParticipant(p.id, { address: e.target.value })}
                  placeholder={t('party.participantAddressPlaceholder', { name: label })}
                  readOnly={locked}
                  style={{ ...inputOpacity(locked), fontSize: 10 }}
                />
              </AddressRow>
            )}
          </PartyCard>
        );
      })}

      {!locked && participants.length < MAX_PARTICIPANTS && (
        <Button variant="outline" size="sm" fullWidth onClick={addParticipant}>
          + {t('share.addParticipant')}
        </Button>
      )}

      {reinsurer.enabled ? (
        <PartyCard accent={REINSURER_COLOR} data-testid="reinsurer-party">
          <PartyHeader>
            <PartyTitle><Swatch color={REINSURER_COLOR} />{reinsurer.name || t('party.reinsurer')}</PartyTitle>
            {!locked && <RemoveButton onClick={toggleReinsurer} title={t('master.removeReinsurer')}>-</RemoveButton>}
          </PartyHeader>
          <FieldGrid>
            <div>
              <MiniLabel>{t('party.name')}</MiniLabel>
              <FormInput
                placeholder={t('party.reinsurerNamePlaceholder')}
                value={reinsurer.name ?? ''}
                onChange={e => setReinsurer({ name: e.target.value })}
                readOnly={locked}
                style={inputOpacity(locked)}
              />
            </div>
            <div>
              <MiniLabel>{t('party.effectiveShare')}</MiniLabel>
              <FormInput value="45%" readOnly style={{ opacity: 0.6, textAlign: 'right' }} />
            </div>
          </FieldGrid>
          {mode === 'onchain' && (
            <AddressRow>
              <MiniLabel>{t('party.walletAddress')}</MiniLabel>
              <FormInput
                value={reinsurer.address}
                onChange={e => setReinsurer({ address: e.target.value })}
                placeholder={t('party.reinsurerAddressPlaceholder')}
                readOnly={locked}
                style={{ ...inputOpacity(locked), fontSize: 10 }}
              />
            </AddressRow>
          )}
          <ReinsuranceGrid>
            <Metric><MetricLabel>{t('party.cessionRate')}</MetricLabel><MetricValue>50%</MetricValue></Metric>
            <Metric><MetricLabel>{t('party.commission')}</MetricLabel><MetricValue>10%</MetricValue></Metric>
            <Metric><MetricLabel>{t('party.netCession')}</MetricLabel><MetricValue>45%</MetricValue></Metric>
          </ReinsuranceGrid>
        </PartyCard>
      ) : (
        !locked && (
          <Button variant="outline" size="sm" fullWidth onClick={toggleReinsurer}>
            + {t('master.addReinsurer')}
          </Button>
        )
      )}
    </Section>
  );
}

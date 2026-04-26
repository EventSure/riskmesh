import { useTranslation } from 'react-i18next';
import styled from '@emotion/styled';

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const CheckCircle = styled.div<{ confirmed: boolean }>`
  width: 18px;
  height: 18px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${p => p.confirmed ? p.theme.colors.success : 'transparent'};
  border: ${p => p.confirmed ? 'none' : `1.5px solid ${p.theme.colors.warning}`};
  font-size: 9px;
  font-weight: 700;
  color: ${p => p.confirmed ? '#fff' : p.theme.colors.warning};
`;

const Name = styled.span<{ roleColor?: string }>`
  font-size: 11px;
  color: ${p => p.roleColor ?? p.theme.colors.text};
  flex: 1;
`;

const ShareLabel = styled.span`
  font-family: ${p => p.theme.fonts.mono};
  font-size: 10px;
  color: ${p => p.theme.colors.sub};
`;

const Summary = styled.div`
  display: flex;
  justify-content: space-between;
  padding-top: 8px;
  margin-top: 4px;
  border-top: 1px solid ${p => p.theme.colors.border};
  font-size: 10px;
  color: ${p => p.theme.colors.sub};
`;

const SummaryCount = styled.span<{ allConfirmed: boolean }>`
  color: ${p => p.allConfirmed ? p.theme.colors.success : p.theme.colors.warning};
  font-weight: 700;
`;

export interface ChecklistEntry {
  name: string;
  shareBps: number;
  confirmed: boolean;
  roleColor?: string;
}

interface ParticipantChecklistProps {
  entries: ChecklistEntry[];
}

export function ParticipantChecklist({ entries }: ParticipantChecklistProps) {
  const { t } = useTranslation();
  const confirmedCount = entries.filter(e => e.confirmed).length;
  const allConfirmed = confirmedCount === entries.length;

  return (
    <>
      <List>
        {entries.map((e, i) => (
          <Row key={i}>
            <CheckCircle confirmed={e.confirmed}>
              {e.confirmed ? '✓' : '…'}
            </CheckCircle>
            <Name roleColor={e.roleColor}>{e.name}</Name>
            <ShareLabel>{(e.shareBps / 100).toFixed(1)}%</ShareLabel>
          </Row>
        ))}
      </List>
      <Summary>
        <span>{t('portal.checklist.confirmedShare')}</span>
        <SummaryCount allConfirmed={allConfirmed}>
          {t('portal.checklist.confirmedCount', { confirmed: confirmedCount, total: entries.length })}
        </SummaryCount>
      </Summary>
    </>
  );
}

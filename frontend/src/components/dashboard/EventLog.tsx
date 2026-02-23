import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';

const logIn = keyframes`
  from { opacity: 0; transform: translateX(-6px); }
  to   { opacity: 1; transform: translateX(0); }
`;

const BottomSection = styled.div`
  border-top: 1px solid ${p => p.theme.colors.border};
  height: 220px;
  display: flex;
  gap: 0;
`;

const LogCol = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px;
  border-right: 1px solid ${p => p.theme.colors.border};
  &:last-child {
    border-right: none;
  }
`;

const LogEntry = styled.div`
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 5px 0;
  border-bottom: 1px solid rgba(31, 41, 55, 0.4);
  animation: ${logIn} 0.3s ease;
`;

const LogDot = styled.div<{ color: string }>`
  width: 5px;
  height: 5px;
  border-radius: 50%;
  margin-top: 5px;
  flex-shrink: 0;
  background: ${p => p.color};
`;

const LogTime = styled.span`
  font-family: ${p => p.theme.fonts.mono};
  font-size: 9px;
  color: ${p => p.theme.colors.sub};
  white-space: nowrap;
  padding-top: 1px;
`;

const LogBody = styled.div<{ muted?: boolean }>`
  font-size: 11px;
  color: ${p => (p.muted ? p.theme.colors.sub : p.theme.colors.text)};
`;

const LogDetail = styled.div`
  font-size: 10px;
  color: ${p => p.theme.colors.sub};
  margin-top: 1px;
`;

const LogSectionTitle = styled.div<{ withDot?: boolean }>`
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: ${p => p.theme.colors.sub};
  margin-bottom: 8px;
  display: ${p => (p.withDot ? 'flex' : 'block')};
  align-items: ${p => (p.withDot ? 'center' : 'unset')};
  gap: ${p => (p.withDot ? '6px' : '0')};
`;

const StatusDot = styled.span<{ color: string }>`
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: ${p => p.color};
  display: inline-block;
  box-shadow: 0 0 6px ${p => p.color};
`;

export function EventLog() {
  return (
    <BottomSection>
      <LogCol>
        <LogSectionTitle withDot>
          <StatusDot color="#22C55E" />
          Protocol Event Log
        </LogSectionTitle>
        <LogEntry>
          <LogDot color="#94A3B8" />
          <LogTime>--:--:--</LogTime>
          <LogBody muted>Demo reset. Ready.</LogBody>
        </LogEntry>
      </LogCol>
      <LogCol style={{ maxWidth: '340px', flex: '0 0 340px' }}>
        <LogSectionTitle>Approval / Settlement Audit</LogSectionTitle>
        <LogDetail>No approval records yet.</LogDetail>
      </LogCol>
    </BottomSection>
  );
}

export { BottomSection, LogCol, LogEntry, LogDot, LogTime, LogBody, LogDetail, LogSectionTitle, StatusDot };

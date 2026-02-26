import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/common';
import { useProtocolStore } from '@/store/useProtocolStore';
import { useTranslation } from 'react-i18next';

const logIn = keyframes`
  from { opacity: 0; transform: translateX(-4px); }
  to   { opacity: 1; transform: translateX(0); }
`;

const LogWrap = styled.div`
  background: var(--card2);
  border-radius: 7px;
  padding: 8px;
  overflow-y: auto;
  border: 1px solid var(--border);
  height: 220px;
`;

const LogEntry = styled.div`
  display: flex;
  gap: 7px;
  align-items: flex-start;
  padding: 4px 0;
  border-bottom: 1px solid rgba(31, 41, 55, 0.35);
  animation: ${logIn} 0.3s ease;
`;

const LogDot = styled.div<{ color: string }>`
  width: 5px;
  height: 5px;
  border-radius: 50%;
  margin-top: 4px;
  flex-shrink: 0;
  background: ${p => p.color};
  box-shadow: 0 0 3px ${p => p.color};
`;

const LogTime = styled.span`
  font-family: 'DM Mono', monospace;
  font-size: 9px;
  color: var(--sub);
  white-space: nowrap;
`;

const LogMsg = styled.div`font-size: 10px;`;
const LogDetail = styled.div`font-size: 9px; color: var(--sub); margin-top: 1px;`;

export function EventLog() {
  const logs = useProtocolStore(s => s.logs);
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('log.title')}</CardTitle>
        <span style={{ fontSize: 9, color: 'var(--success)' }}>● {t('common.live')}</span>
      </CardHeader>
      <CardBody style={{ padding: 10 }}>
        <LogWrap>
          {logs.map(log => (
            <LogEntry key={log.id}>
              <LogDot color={log.color} />
              <LogTime>{log.time}</LogTime>
              <div>
                <LogMsg>
                  <strong style={{ fontFamily: "'DM Mono', monospace", color: log.color }}>{log.instruction}</strong>{' '}
                  {log.msg}
                </LogMsg>
                {log.detail && <LogDetail>{log.detail}</LogDetail>}
              </div>
            </LogEntry>
          ))}
        </LogWrap>
      </CardBody>
    </Card>
  );
}

export { LogWrap, LogEntry, LogDot, LogTime, LogMsg, LogDetail };

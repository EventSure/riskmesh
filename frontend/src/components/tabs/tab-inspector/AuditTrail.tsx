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
  height: calc(100vh - 210px);
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

export function AuditTrail() {
  const { t } = useTranslation();
  const logs = useProtocolStore(s => s.logs);

  return (
    <Card>
      <CardHeader><CardTitle>{t('inspector.auditTitle')}</CardTitle></CardHeader>
      <CardBody style={{ padding: 10 }}>
        <LogWrap>
          {logs.map(log => (
            <LogEntry key={log.id}>
              <LogDot color={log.color} />
              <LogTime>{log.time}</LogTime>
              <div>
                <div style={{ fontSize: 10 }}>
                  <strong style={{ fontFamily: "'DM Mono', monospace", color: log.color }}>{log.instruction}</strong>{' '}
                  {log.msg}
                </div>
                {log.detail && <div style={{ fontSize: 9, color: 'var(--sub)', marginTop: 1 }}>{log.detail}</div>}
              </div>
            </LogEntry>
          ))}
        </LogWrap>
      </CardBody>
    </Card>
  );
}

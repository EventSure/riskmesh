import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/common';
import { Mono } from '@/components/common';

const pulseP = keyframes`
  0%, 100% { box-shadow: 0 0 18px var(--gp); }
  50% { box-shadow: 0 0 32px rgba(153,69,255,.6); }
`;

const pulseW = keyframes`
  0%, 100% { box-shadow: 0 0 18px rgba(245,158,11,.3); }
  50% { box-shadow: 0 0 32px rgba(245,158,11,.6); }
`;

const SmWrap = styled.div`
  padding: 16px 14px 10px;
  overflow-x: auto;
`;

const SmTrack = styled.div<{ minWidth?: number }>`
  display: flex;
  align-items: flex-start;
  gap: 0;
  min-width: ${p => p.minWidth ?? 560}px;
`;

const SmNode = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  gap: 6px;
`;

type CircleState = 'done' | 'cur' | 'claimable' | 'settled' | 'expired' | 'default';

const SmCircle = styled.div<{ state?: CircleState }>`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid var(--border);
  background: var(--card2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--sub);
  transition: all .5s;
  z-index: 2;
  position: relative;

  ${p => p.state === 'done' && `
    border-color: var(--success);
    background: rgba(34,197,94,.12);
    color: var(--success);
    box-shadow: 0 0 12px rgba(34,197,94,.3);
  `}

  ${p => p.state === 'cur' && `
    border-color: var(--primary);
    background: rgba(153,69,255,.18);
    color: var(--primary);
    box-shadow: 0 0 18px var(--gp);
  `}

  ${p => p.state === 'claimable' && `
    border-color: var(--warning);
    background: rgba(245,158,11,.18);
    color: var(--warning);
    box-shadow: 0 0 18px rgba(245,158,11,.3);
  `}

  ${p => p.state === 'settled' && `
    border-color: var(--accent);
    background: rgba(20,241,149,.12);
    color: var(--accent);
    box-shadow: 0 0 18px var(--ga);
  `}

  ${p => p.state === 'expired' && `
    border-color: var(--sub);
    background: rgba(148,163,184,.08);
    color: var(--sub);
  `}

  animation: ${p =>
    p.state === 'cur'
      ? `${pulseP} 2s infinite`
      : p.state === 'claimable'
      ? `${pulseW} 1.5s infinite`
      : 'none'};
`;

type LabelState = 'cur' | 'done' | 'claimable' | 'settled' | 'default';

const SmLabel = styled.div<{ state?: LabelState }>`
  font-size: 9px;
  font-weight: 600;
  letter-spacing: .04em;
  color: var(--sub);
  text-align: center;
  transition: color .4s;

  ${p => p.state === 'cur' && `color: var(--primary);`}
  ${p => p.state === 'done' && `color: var(--success);`}
  ${p => p.state === 'claimable' && `color: var(--warning);`}
  ${p => p.state === 'settled' && `color: var(--accent);`}
`;

const SmConn = styled.div<{ done?: boolean }>`
  flex: 1;
  height: 2px;
  background: ${p => p.done ? 'var(--success)' : 'var(--border)'};
  margin-top: 17px;
  z-index: 1;
  transition: background .5s;
  min-width: 8px;
`;

const policyNodes = [
  { icon: '📄', label: 'Draft' },
  { icon: '📂', label: 'Open' },
  { icon: '💰', label: 'Funded' },
  { icon: '⚡', label: 'Active' },
  { icon: '🔔', label: 'Claimable' },
  { icon: '✅', label: 'Approved' },
  { icon: '💸', label: 'Settled' },
  { icon: '⏰', label: 'Expired' },
];
const underwritingNodes = [
  { icon: '💬', label: 'Proposed' },
  { icon: '📂', label: 'Open' },
  { icon: '✅', label: 'Finalized' },
];

export function StateMachine() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Policy State Machine</CardTitle>
        <Mono style={{ fontSize: '9px', color: 'var(--sub)' }}>PolicyState enum</Mono>
      </CardHeader>
      <CardBody>
        <SmWrap>
          <SmTrack>
            {policyNodes.map((node, i) => (
              <div key={node.label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <SmNode>
                  <SmCircle>{node.icon}</SmCircle>
                  <SmLabel>{node.label}</SmLabel>
                </SmNode>
                {i < policyNodes.length - 1 && <SmConn />}
              </div>
            ))}
          </SmTrack>
        </SmWrap>
        <Mono style={{ fontSize: '9px', color: 'var(--sub)', marginTop: 10, marginBottom: 6, display: 'block' }}>
          UnderwritingStatus
        </Mono>
        <SmWrap>
          <SmTrack minWidth={300}>
            {underwritingNodes.map((node, i) => (
              <div key={node.label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <SmNode>
                  <SmCircle>{node.icon}</SmCircle>
                  <SmLabel>{node.label}</SmLabel>
                </SmNode>
                {i < underwritingNodes.length - 1 && <SmConn />}
              </div>
            ))}
          </SmTrack>
        </SmWrap>
      </CardBody>
    </Card>
  );
}

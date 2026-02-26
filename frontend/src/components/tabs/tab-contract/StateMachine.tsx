import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import { Card, CardHeader, CardTitle } from '@/components/common';
import { useProtocolStore, POLICY_STATES, POLICY_STATE_ICONS } from '@/store/useProtocolStore';

const pulsePrimary = keyframes`
  0%, 100% { box-shadow: 0 0 16px rgba(153,69,255,.22); }
  50% { box-shadow: 0 0 28px rgba(153,69,255,.6); }
`;
const pulseWarning = keyframes`
  0%, 100% { box-shadow: 0 0 14px rgba(245,158,11,.3); }
  50% { box-shadow: 0 0 26px rgba(245,158,11,.6); }
`;

const StateTrack = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0;
  overflow-x: auto;
  padding: 12px 10px 8px;
`;

const StateNode = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  gap: 5px;
  min-width: 54px;
`;

type CircleState = 'done' | 'cur' | 'claimable' | 'settled' | 'default';

const StateCircle = styled.div<{ state?: CircleState }>`
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid var(--border);
  background: var(--card2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: var(--sub);
  transition: all 0.5s;

  ${p => p.state === 'done' && `border-color:var(--success);background:rgba(34,197,94,.1);color:var(--success);box-shadow:0 0 10px rgba(34,197,94,.3);`}
  ${p => p.state === 'cur' && `border-color:var(--primary);background:rgba(153,69,255,.15);color:var(--primary);box-shadow:0 0 16px rgba(153,69,255,.22);animation:${pulsePrimary} 2s infinite;`}
  ${p => p.state === 'claimable' && `border-color:var(--warning);background:rgba(245,158,11,.15);color:var(--warning);animation:${pulseWarning} 1.5s infinite;`}
  ${p => p.state === 'settled' && `border-color:var(--accent);background:rgba(20,241,149,.1);color:var(--accent);box-shadow:0 0 14px rgba(20,241,149,.22);`}
`;

const StateLabel = styled.div<{ state?: CircleState }>`
  font-size: 8px;
  font-weight: 600;
  color: var(--sub);
  text-align: center;
  ${p => p.state === 'cur' && `color:var(--primary);`}
  ${p => p.state === 'done' && `color:var(--success);`}
  ${p => p.state === 'claimable' && `color:var(--warning);`}
  ${p => p.state === 'settled' && `color:var(--accent);`}
`;

const StateConnector = styled.div<{ done?: boolean }>`
  flex: 1;
  height: 2px;
  background: ${p => p.done ? 'var(--success)' : 'var(--border)'};
  margin-top: 13px;
  transition: background 0.5s;
  min-width: 5px;
`;

function getCircleState(i: number, policyStateIdx: number): CircleState {
  if (i < policyStateIdx) return 'done';
  if (i === policyStateIdx) {
    const label = POLICY_STATES[i];
    if (label === 'Claimable') return 'claimable';
    if (label === 'Settled') return 'settled';
    return 'cur';
  }
  return 'default';
}

export function StateMachine() {
  const policyStateIdx = useProtocolStore(s => s.policyStateIdx);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Policy State Machine</CardTitle>
      </CardHeader>
      <StateTrack>
        {POLICY_STATES.map((s, i) => {
          const state = getCircleState(i, policyStateIdx);
          return (
            <div key={s} style={{ display: 'contents' }}>
              <StateNode>
                <StateCircle state={state}>{POLICY_STATE_ICONS[i]}</StateCircle>
                <StateLabel state={state}>{s}</StateLabel>
              </StateNode>
              {i < POLICY_STATES.length - 1 && <StateConnector done={i < policyStateIdx} />}
            </div>
          );
        })}
      </StateTrack>
    </Card>
  );
}

import styled from '@emotion/styled';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/common';
import { Tag } from '@/components/common';

const MonoStrong = styled.strong`
  font-family: 'DM Mono', monospace;
`;

type PtRowStatus = 'committed' | 'funded' | 'default';

const PtRow = styled.div<{ status?: PtRowStatus }>`
  background: var(--card2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 8px;
  transition: border-color .3s;

  ${p => p.status === 'committed' && `border-color: rgba(153,69,255,.35);`}
  ${p => p.status === 'funded' && `border-color: rgba(20,241,149,.35);`}
`;

const PtHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 7px;
`;

const PtName = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  font-weight: 600;
`;

const PtDot = styled.div`
  width: 7px;
  height: 7px;
  border-radius: 50%;
`;

const PtChip = styled.span`
  font-size: 9px;
  padding: 2px 7px;
  border-radius: 5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .04em;
  font-family: 'DM Mono', monospace;
`;

const participants = [
  { name: 'Leader', color: '#9945FF', bps: 4000 },
  { name: 'Participant A', color: '#14F195', bps: 3500 },
  { name: 'Participant B', color: '#F59E0B', bps: 2500 },
];

export function Participants() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Underwriting Participants</CardTitle>
        <Tag variant="subtle">PROPOSED</Tag>
      </CardHeader>
      <CardBody>
        {participants.map((p) => (
          <PtRow key={p.name}>
            <PtHeader>
              <PtName>
                <PtDot style={{ background: p.color, boxShadow: `0 0 5px ${p.color}` }} />
                {p.name}
              </PtName>
              <PtChip style={{ background: `${p.color}20`, color: p.color, border: `1px solid ${p.color}40` }}>
                PROPOSED
              </PtChip>
            </PtHeader>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', fontSize: '10px', color: 'var(--sub)', marginBottom: '6px' }}>
              <span>ratio_bps: <MonoStrong style={{ color: p.color }}>{p.bps}</MonoStrong></span>
              <span>escrow_req: <MonoStrong>0</MonoStrong></span>
              <span>escrow_dep: <MonoStrong style={{ color: 'var(--accent)' }}>0</MonoStrong></span>
              <span>max_loss: <MonoStrong>0</MonoStrong></span>
            </div>
          </PtRow>
        ))}
      </CardBody>
    </Card>
  );
}

import styled from '@emotion/styled';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/common';
import { useProtocolStore, formatNum, masterPDA, poolPDA, vaultPDA, ledgerPDA, POLICY_STATES } from '@/store/useProtocolStore';
import { useShallow } from 'zustand/shallow';

const AccountCard = styled.div`
  background: var(--card2);
  border: 1px solid var(--border);
  border-radius: 9px;
  padding: 9px 11px;
  margin-bottom: 7px;
`;

const AccountHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 7px;
`;

const AccountIcon = styled.div`
  width: 24px;
  height: 24px;
  border-radius: 5px;
  background: rgba(153,69,255,.12);
  border: 1px solid rgba(153,69,255,.25);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
`;

const AccountName = styled.div`
  font-size: 10px;
  font-weight: 700;
  font-family: 'DM Mono', monospace;
`;

const AccountAddr = styled.div`
  font-size: 8px;
  color: var(--sub);
  font-family: 'DM Mono', monospace;
  word-break: break-all;
  margin-top: 1px;
`;

const Seeds = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin: 4px 0 6px;
`;

const Seed = styled.span`
  padding: 1px 5px;
  background: rgba(153,69,255,.08);
  border: 1px solid rgba(153,69,255,.2);
  border-radius: 3px;
  font-size: 8px;
  font-family: 'DM Mono', monospace;
  color: var(--primary);
`;

const AccountField = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 2px 0;
  border-bottom: 1px solid rgba(31,41,55,.35);
  &:last-child { border-bottom: none; }
`;

const FieldKey = styled.div`
  font-size: 9px;
  color: var(--sub);
  font-family: 'DM Mono', monospace;
`;

const FieldValue = styled.div<{ variant?: string }>`
  font-size: 9px;
  font-family: 'DM Mono', monospace;
  color: ${p =>
    p.variant === 'ac' ? 'var(--accent)' :
    p.variant === 'wn' ? 'var(--warning)' :
    p.variant === 'dn' ? 'var(--danger)' :
    p.variant === 'in' ? 'var(--info)' :
    'var(--text)'};
`;

export function InspectorPanel() {
  const { masterActive, policyStateIdx, contracts, poolBalance, totalPremium, totalClaim, acc, shares } = useProtocolStore(
    useShallow(s => ({ masterActive: s.masterActive, policyStateIdx: s.policyStateIdx, contracts: s.contracts, poolBalance: s.poolBalance, totalPremium: s.totalPremium, totalClaim: s.totalClaim, acc: s.acc, shares: s.shares })),
  );

  if (!masterActive) {
    return (
      <Card>
        <CardHeader><CardTitle>On-chain Inspector (PDA)</CardTitle></CardHeader>
        <CardBody style={{ padding: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--sub)', textAlign: 'center', padding: 20 }}>
            마스터 계약 체결 후 표시됩니다.
          </div>
        </CardBody>
      </Card>
    );
  }

  const accounts = [
    {
      icon: '📋', name: 'MasterContract',
      seeds: ['master', '2026', 'flight_delay'], addr: masterPDA(),
      fields: [
        { k: 'coverage', v: '2026-01-01 ~ 2026-12-31', c: '' },
        { k: 'premium_per_contract', v: '1 USDC', c: 'ac' },
        { k: 'shares', v: `L${shares.leader}% / A${shares.partA}% / B${shares.partB}%`, c: 'ac' },
        { k: 'rein_share', v: '50%', c: 'in' },
        { k: 'comm_rate', v: '10%', c: '' },
        { k: 'state', v: POLICY_STATES[policyStateIdx] || '—', c: 'ac' },
        { k: 'total_contracts', v: String(contracts.length), c: 'ac' },
      ],
    },
    {
      icon: '🏦', name: 'RiskPool',
      seeds: ['pool', 'master_contract'], addr: poolPDA(),
      fields: [
        { k: 'vault', v: vaultPDA().substring(0, 14) + '...', c: '' },
        { k: 'pool_initial', v: '10,000 USDC', c: 'ac' },
        { k: 'available', v: formatNum(poolBalance, 2) + ' USDC', c: poolBalance < 5000 ? 'wn' : 'ac' },
        { k: 'paid_out', v: formatNum(totalClaim, 2) + ' USDC', c: 'dn' },
      ],
    },
    {
      icon: '📊', name: 'SettlementLedger',
      seeds: ['ledger', 'master_contract'], addr: ledgerPDA(),
      fields: [
        { k: 'total_premium', v: formatNum(totalPremium, 4) + ' USDC', c: 'ac' },
        { k: 'total_claims', v: formatNum(totalClaim, 2) + ' USDC', c: 'dn' },
        { k: 'leader_net', v: formatNum(acc.leaderPrem - acc.leaderClaim, 4) + ' USDC', c: acc.leaderPrem - acc.leaderClaim >= 0 ? 'ac' : 'dn' },
        { k: 'partA_net', v: formatNum(acc.partAPrem - acc.partAClaim, 4) + ' USDC', c: acc.partAPrem - acc.partAClaim >= 0 ? 'ac' : 'dn' },
        { k: 'partB_net', v: formatNum(acc.partBPrem - acc.partBClaim, 4) + ' USDC', c: acc.partBPrem - acc.partBClaim >= 0 ? 'ac' : 'dn' },
        { k: 'rein_net', v: formatNum(acc.reinPrem - acc.reinClaim, 4) + ' USDC', c: 'in' },
      ],
    },
  ];

  return (
    <Card>
      <CardHeader><CardTitle>On-chain Inspector (PDA)</CardTitle></CardHeader>
      <CardBody style={{ padding: 10 }}>
        {accounts.map(a => (
          <AccountCard key={a.name}>
            <AccountHeader>
              <AccountIcon>{a.icon}</AccountIcon>
              <div>
                <AccountName>{a.name}</AccountName>
                <AccountAddr>{a.addr}</AccountAddr>
              </div>
            </AccountHeader>
            <Seeds>{a.seeds.map(s => <Seed key={s}>{s}</Seed>)}</Seeds>
            {a.fields.map(f => (
              <AccountField key={f.k}>
                <FieldKey>{f.k}</FieldKey>
                <FieldValue variant={f.c}>{f.v}</FieldValue>
              </AccountField>
            ))}
          </AccountCard>
        ))}
      </CardBody>
    </Card>
  );
}

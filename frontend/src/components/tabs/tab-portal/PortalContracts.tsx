import { useMemo, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardBody, DataTable, Tag } from '@/components/common';
import { useFlightPolicies, type FlightPolicyWithKey } from '@/hooks/useFlightPolicies';
import { useToast } from '@/components/common';

const STATUS_NAMES: Record<number, string> = {
  0: 'Issued', 1: 'AwaitingOracle', 2: 'Claimable', 3: 'Paid', 4: 'NoClaim', 5: 'Expired',
};

const STATUS_COLORS: Record<number, string> = {
  0: '#94A3B8', 1: '#F59E0B', 2: '#EF4444', 3: '#22C55E', 4: '#64748B', 5: '#475569',
};

interface PortalContractsProps {
  masterPDA: PublicKey;
}

export function PortalContracts({ masterPDA }: PortalContractsProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const handleStatusChange = useCallback((fp: FlightPolicyWithKey, prev: number, next: number) => {
    const name = `#${fp.account.childPolicyId.toNumber()} ${fp.account.flightNo}`;
    toast(`${name}: ${STATUS_NAMES[prev]} → ${STATUS_NAMES[next]}`, next === 2 ? 'w' : 's');
  }, [toast]);

  const { policies, loading } = useFlightPolicies(masterPDA, { onStatusChange: handleStatusChange });

  const rows = useMemo(() => policies.map(fp => ({
    id: fp.account.childPolicyId.toNumber(),
    flight: fp.account.flightNo,
    route: fp.account.route,
    status: fp.account.status,
    delay: fp.account.delayMinutes,
    payout: fp.account.payoutAmount.toNumber() / 1e6,
    premium: fp.account.premiumPaid.toNumber() / 1e6,
  })), [policies]);

  return (
    <div style={{ padding: 14 }}>
      <Card>
        <CardHeader>
          <CardTitle>{t('portal.contracts')}</CardTitle>
          <Tag variant="subtle">{loading ? '...' : `${rows.length}`}</Tag>
        </CardHeader>
        <CardBody>
          <DataTable>
            <thead>
              <tr>
                <th>ID</th>
                <th>{t('portal.flight')}</th>
                <th>{t('portal.route')}</th>
                <th>{t('portal.status')}</th>
                <th>{t('portal.delay')}</th>
                <th>{t('portal.premium')}</th>
                <th>{t('portal.payout')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td>#{r.id}</td>
                  <td>{r.flight}</td>
                  <td>{r.route}</td>
                  <td>
                    <Tag variant="subtle" style={{ color: STATUS_COLORS[r.status] || '#94A3B8', fontSize: 9 }}>
                      {STATUS_NAMES[r.status] || 'Unknown'}
                    </Tag>
                  </td>
                  <td>{r.delay > 0 ? `${r.delay}min` : '—'}</td>
                  <td>{r.premium.toFixed(2)}</td>
                  <td>{r.payout > 0 ? r.payout.toFixed(2) : '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--sub)' }}>{t('portal.noContracts')}</td></tr>
              )}
            </tbody>
          </DataTable>
        </CardBody>
      </Card>
    </div>
  );
}

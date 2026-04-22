import { useMemo } from 'react';
import styled from '@emotion/styled';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardBody, DataTable, Mono, Tag } from '@/components/common';
import { KVRow } from './KVRow';
import { useProtocolStore, formatNum } from '@/store/useProtocolStore';
import type { ParticipantInfo } from '@/hooks/useParticipantRole';

const ExplorerLink = styled.a`
  color: ${p => p.theme.colors.info};
  font-size: 9px;
  font-family: ${p => p.theme.fonts.mono};
  text-decoration: none;
  &:hover { text-decoration: underline; }
`;

const STATUS_TAGS: Record<string, { label: string; color: string }> = {
  claimable: { label: 'Pending', color: '#F59E0B' },
  approved: { label: 'Approved', color: '#38BDF8' },
  settled: { label: 'Settled', color: '#22C55E' },
};

interface PortalSettlementProps {
  participantInfo: ParticipantInfo;
  allRoles?: ParticipantInfo[];
}

export function PortalSettlement({ participantInfo, allRoles }: PortalSettlementProps) {
  const { t } = useTranslation();
  const { claims } = useProtocolStore();

  const roles = allRoles && allRoles.length > 0 ? allRoles : [participantInfo];
  const rows = useMemo(() => {
    return claims.map(c => {
      // Sum myNet across all roles
      const myNet = roles.reduce((sum, r) => {
        if (r.role === 'participant') {
          // participantIndex is the on-chain participants[] index where 0 = leader.
          // store.participants excludes the leader, so storeIdx = participantIndex - 1.
          // Invariant: for role === 'participant', participantIndex must be >= 1.
          if (r.participantIndex < 1) return sum;
          const storeIdx = r.participantIndex - 1;
          return sum + (c.participantNets[storeIdx] ?? 0);
        }
        if (r.role === 'rein') return sum + c.rNet;
        return sum;
      }, 0);

      return {
        id: c.id,
        contractId: c.contractId,
        flight: c.flight,
        tier: c.tier,
        payout: c.payout,
        myNet,
        status: c.status,
        settledAt: c.settledAt,
      };
    });
  }, [claims, roles]);

  const totalMyNet = rows.reduce((sum, r) => sum + r.myNet, 0);

  return (
    <div style={{ padding: 14 }}>
      <Card>
        <CardHeader>
          <CardTitle>{t('portal.settlement')}</CardTitle>
          <Tag variant="subtle">{rows.length}</Tag>
        </CardHeader>
        <CardBody>
          <KVRow
            label={t('portal.myTotalSettlement')}
            value={<Mono style={{ color: 'var(--accent)', fontWeight: 700 }}>{formatNum(totalMyNet, 2)} USDC</Mono>}
          />

          <DataTable style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>{t('portal.flight')}</th>
                <th>{t('portal.tier')}</th>
                <th>{t('portal.payout')}</th>
                <th>{t('portal.myNet')}</th>
                <th>{t('portal.status')}</th>
                <th>Tx</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const tag = STATUS_TAGS[r.status];
                return (
                  <tr key={r.id}>
                    <td>#{r.contractId}</td>
                    <td>{r.flight}</td>
                    <td>{r.tier}</td>
                    <td>{formatNum(r.payout, 2)}</td>
                    <td style={{ color: r.myNet > 0 ? 'var(--danger)' : 'var(--text)' }}>
                      {formatNum(r.myNet, 2)}
                    </td>
                    <td>
                      {tag && (
                        <Tag variant="subtle" style={{ color: tag.color, fontSize: 9 }}>
                          {tag.label}
                        </Tag>
                      )}
                    </td>
                    <td>
                      {r.settledAt && (
                        <ExplorerLink
                          href={`https://explorer.solana.com/tx/${r.settledAt}?cluster=devnet`}
                          target="_blank"
                          rel="noopener"
                        >
                          {r.settledAt.slice(0, 8)}...
                        </ExplorerLink>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--sub)' }}>{t('portal.noSettlements')}</td></tr>
              )}
            </tbody>
          </DataTable>
        </CardBody>
      </Card>
    </div>
  );
}

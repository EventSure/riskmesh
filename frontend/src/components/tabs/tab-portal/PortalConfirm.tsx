import styled from '@emotion/styled';
import { useTranslation } from 'react-i18next';
import { PublicKey } from '@solana/web3.js';
import { Card, CardHeader, CardTitle, CardBody, Button, Tag } from '@/components/common';
import { useConfirmMaster } from '@/hooks/useConfirmMaster';
import { ConfirmRole } from '@/lib/idl/open_parametric';
import { KVRow } from './KVRow';
import { useToast } from '@/components/common';
import type { ParticipantInfo } from '@/hooks/useParticipantRole';

const ConfirmBadge = styled.div<{ confirmed: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid ${p => p.confirmed ? p.theme.colors.success : p.theme.colors.warning};
  background: ${p => p.confirmed ? 'rgba(34,197,94,.06)' : 'rgba(245,158,11,.06)'};
  color: ${p => p.confirmed ? p.theme.colors.success : p.theme.colors.warning};
  font-size: 11px;
  font-weight: 700;
  margin-bottom: 12px;
`;

interface PortalConfirmProps {
  masterPDA: PublicKey;
  participantInfo: ParticipantInfo;
  allRoles?: ParticipantInfo[];
}

export function PortalConfirm({ masterPDA, participantInfo, allRoles }: PortalConfirmProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { confirmMaster, loading } = useConfirmMaster();

  const sharePct = (participantInfo.shareBps / 100).toFixed(1);
  const roleLabels = (allRoles && allRoles.length > 0 ? allRoles : [participantInfo])
    .map(r => r.role ? t(`portal.role.${r.role}`) : '—')
    .join(' / ');

  const handleConfirm = async () => {
    const res = await confirmMaster({ masterPolicy: masterPDA, role: ConfirmRole.Participant });
    if (res.success) {
      toast(t('portal.confirmSuccess'), 's');
    } else {
      toast(res.error || t('portal.confirmFailed'), 'd');
    }
  };

  return (
    <div style={{ padding: 14 }}>
      <Card>
        <CardHeader>
          <CardTitle>{t('portal.confirm')}</CardTitle>
          <Tag variant={participantInfo.confirmed ? 'accent' : 'warning'}>
            {participantInfo.confirmed ? t('portal.confirmed') : t('portal.pendingConfirm')}
          </Tag>
        </CardHeader>
        <CardBody>
          <ConfirmBadge confirmed={participantInfo.confirmed}>
            {participantInfo.confirmed ? t('portal.alreadyConfirmed') : t('portal.awaitingConfirm')}
          </ConfirmBadge>

          <KVRow label={t('portal.myRole')} value={roleLabels} />
          <KVRow label={t('portal.myShare')} value={`${sharePct}% (${participantInfo.shareBps} bps)`} />
          <KVRow label={t('portal.participantIndex')} value={`#${participantInfo.participantIndex}`} />

          {!participantInfo.confirmed && (
            <Button
              variant="primary"
              fullWidth
              onClick={handleConfirm}
              disabled={loading}
              style={{ marginTop: 12 }}
            >
              {loading ? t('portal.confirming') : t('portal.confirmBtn')}
            </Button>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

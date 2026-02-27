import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardBody, Button, SummaryRow, Divider } from '@/components/common';
import { useProtocolStore } from '@/store/useProtocolStore';
import { useToast } from '@/components/common';
import { useSettleFlight } from '@/hooks/useSettleFlight';
import { useProgram } from '@/hooks/useProgram';
import { getFlightPolicyPDA } from '@/lib/pda';

export function ClaimApproval() {
  const { t } = useTranslation();
  const { mode, role, claims, masterPolicyPDA, approveClaims, settleClaims, onChainSettle } = useProtocolStore();
  const { toast } = useToast();
  const { settleFlightClaim, buildSettleAccounts, loading } = useSettleFlight();
  const { wallet, program } = useProgram();

  const pendCnt = claims.filter(c => c.status === 'claimable').length;
  const appCnt = claims.filter(c => c.status === 'approved').length;
  const setlCnt = claims.filter(c => c.status === 'settled').length;
  const canAct = role === 'leader' || role === 'operator';

  const handleApprove = () => {
    // In on-chain mode, resolve_flight_delay already sets the claim status
    // There's no separate approve step — claims go directly to settlement
    if (mode === 'onchain') {
      toast(t('claim.autoApproveMsg'), 'i');
      return;
    }
    const n = approveClaims();
    if (n === 0) { toast(t('toast.noClaimApprove'), 'w'); return; }
    toast(t('toast.approvedN', { count: n }), 's');
  };

  const handleSettle = async () => {
    if (mode === 'simulation') {
      const n = settleClaims();
      if (n === 0) { toast(t('toast.noClaimSettle'), 'w'); return; }
      toast(t('toast.settledN', { count: n }), 's');
      return;
    }

    // On-chain: settle each claimable flight policy
    if (!masterPolicyPDA || !wallet || !program) {
      toast(t('toast.walletNotAvailable'), 'd');
      return;
    }

    const claimable = claims.filter(c => c.status === 'claimable' || c.status === 'approved');
    if (claimable.length === 0) { toast(t('toast.noClaimSettle'), 'w'); return; }

    const masterPK = new PublicKey(masterPolicyPDA);

    // 온체인 master 데이터에서 등록된 pool/deposit 지갑 주소를 읽어 사용
    // (registerParticipantWallets로 저장된 PDA-owned pool 계정)
    // demo: pool 지갑에 USDC 잔액이 없으면 InsufficientFunds 에러 발생
    // (Step 4: 데모 풀 충전 기능 구현 후 해결)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const masterData = await (program as any).account.masterPolicy.fetch(masterPK);
    const { participantPoolWallets, reinsurerPoolWallet, leaderDepositWallet } = buildSettleAccounts(masterData);

    let settled = 0;

    for (const claim of claimable) {
      const [flightPolicyPDA] = getFlightPolicyPDA(masterPK, new BN(claim.contractId));
      const result = await settleFlightClaim({
        masterPolicy: masterPK,
        flightPolicy: flightPolicyPDA,
        leaderDepositToken: leaderDepositWallet,
        reinsurerPoolToken: reinsurerPoolWallet,
        participantPoolWallets,
      });

      if (result.success) {
        onChainSettle(claim.contractId, result.signature);
        settled++;
      }
    }

    toast(t('claim.settledOnchain', { settled, total: claimable.length }), settled > 0 ? 's' : 'w');
  };

  return (
    <Card>
      <CardHeader><CardTitle>{t('claim.approvalTitle')}</CardTitle></CardHeader>
      <CardBody>
        <SummaryRow>
          <span style={{ fontSize: 10, color: 'var(--sub)' }}>{t('claim.pending')}</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{t('common.count', { count: pendCnt })}</span>
        </SummaryRow>
        <SummaryRow>
          <span style={{ fontSize: 10, color: 'var(--sub)' }}>{t('claim.approved')}</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{t('common.count', { count: appCnt })}</span>
        </SummaryRow>
        <SummaryRow>
          <span style={{ fontSize: 10, color: 'var(--sub)' }}>{t('claim.settled')}</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{t('common.count', { count: setlCnt })}</span>
        </SummaryRow>
        <Divider />
        {mode !== 'onchain' && (
          <Button variant="warning" fullWidth onClick={handleApprove} disabled={!canAct || pendCnt === 0} style={{ marginBottom: 6 }}>
            {t('claim.approveBtn')}
          </Button>
        )}
        <Button variant="accent" fullWidth onClick={handleSettle} disabled={!canAct || (pendCnt === 0 && appCnt === 0) || loading} data-guide="settle-btn">
          {loading ? t('claim.settling') : t('claim.settleBtn')}
        </Button>
      </CardBody>
    </Card>
  );
}

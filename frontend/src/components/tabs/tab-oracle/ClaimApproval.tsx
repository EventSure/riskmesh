import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardBody, Button, SummaryRow, Divider } from '@/components/common';
import { useProtocolStore } from '@/store/useProtocolStore';
import { CURRENCY_MINT } from '@/lib/constants';
import { getDemoKeypair } from '@/lib/demo-keypairs';
import { useToast } from '@/components/common';
import { useSettleFlight } from '@/hooks/useSettleFlight';
import { useProgram } from '@/hooks/useProgram';
import { getFlightPolicyPDA } from '@/lib/pda';

export function ClaimApproval() {
  const { t } = useTranslation();
  const { mode, role, claims, masterPolicyPDA, approveClaims, settleClaims, onChainSettle } = useProtocolStore();
  const { toast } = useToast();
  const { settleFlightClaim, loading } = useSettleFlight();
  const { wallet } = useProgram();

  const pendCnt = claims.filter(c => c.status === 'claimable').length;
  const appCnt = claims.filter(c => c.status === 'approved').length;
  const setlCnt = claims.filter(c => c.status === 'settled').length;
  const canAct = role === 'leader' || role === 'operator';

  const handleApprove = () => {
    // In on-chain mode, resolve_flight_delay already sets the claim status
    // There's no separate approve step — claims go directly to settlement
    if (mode === 'onchain') {
      toast('On-chain: claims are auto-approved via resolve_flight_delay', 'i');
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
    if (!masterPolicyPDA || !wallet) {
      toast('Wallet or master policy not available', 'd');
      return;
    }

    const claimable = claims.filter(c => c.status === 'claimable' || c.status === 'approved');
    if (claimable.length === 0) { toast('No claims to settle', 'w'); return; }

    // TODO.demo: settle_flight_claim은 PDA 소유 풀 지갑에 USDC 잔액이 필요함
    // 현재 데모에서는 accept_share(입금) 단계가 미구현이므로 풀 지갑에 잔액 없음
    // → on-chain settle은 InsufficientFunds 에러 예상
    // 실제 환경: create_master 시 PDA 소유 vault 생성 → accept_share로 입금 → settle로 출금
    const masterPK = new PublicKey(masterPolicyPDA);
    const leaderATA = await getAssociatedTokenAddress(CURRENCY_MINT, wallet.publicKey);

    // TODO.demo: 데모 키페어의 ATA를 participant pool wallet로 사용
    const partAKp = getDemoKeypair('partA');
    const partBKp = getDemoKeypair('partB');
    const participantPoolWallets = [
      leaderATA,
      ...(partAKp ? [await getAssociatedTokenAddress(CURRENCY_MINT, partAKp.publicKey)] : []),
      ...(partBKp ? [await getAssociatedTokenAddress(CURRENCY_MINT, partBKp.publicKey)] : []),
    ];

    let settled = 0;

    for (const claim of claimable) {
      const [flightPolicyPDA] = getFlightPolicyPDA(masterPK, new BN(claim.contractId));
      const result = await settleFlightClaim({
        masterPolicy: masterPK,
        flightPolicy: flightPolicyPDA,
        leaderDepositToken: leaderATA,
        reinsurerPoolToken: leaderATA,
        participantPoolWallets,
      });

      if (result.success) {
        onChainSettle(claim.contractId, result.signature);
        settled++;
      }
    }

    toast(`Settled ${settled}/${claimable.length} claims on-chain`, settled > 0 ? 's' : 'w');
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
        <Button variant="warning" fullWidth onClick={handleApprove} disabled={!canAct || pendCnt === 0} style={{ marginBottom: 6 }}>
          {mode === 'onchain' ? 'Auto-approved (on-chain)' : t('claim.approveBtn')}
        </Button>
        <Button variant="accent" fullWidth onClick={handleSettle} disabled={!canAct || (pendCnt === 0 && appCnt === 0) || loading}>
          {loading ? 'Settling...' : t('claim.settleBtn')}
        </Button>
      </CardBody>
    </Card>
  );
}

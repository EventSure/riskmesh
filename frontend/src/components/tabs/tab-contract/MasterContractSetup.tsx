import { useState } from 'react';
import BN from 'bn.js';
import { Card, CardHeader, CardTitle, CardBody, Button, FormGroup, FormLabel, FormInput, Divider, Tag, TierItem } from '@/components/common';
import { useProtocolStore } from '@/store/useProtocolStore';
import { useToast } from '@/components/common';
import { useTranslation } from 'react-i18next';
import { useCreateMasterPolicy } from '@/hooks/useCreateMasterPolicy';
import { useProgram } from '@/hooks/useProgram';
import { getMasterPolicyPDA } from '@/lib/pda';
import { CURRENCY_MINT, DEFAULT_PAYOUT_TIERS } from '@/lib/constants';
import { getAssociatedTokenAddress } from '@solana/spl-token';

export function MasterContractSetup() {
  const { mode, masterActive, processStep, shares, setTerms, onChainSetTerms, setMasterPolicyPDA } = useProtocolStore();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { createMasterPolicy, loading } = useCreateMasterPolicy();
  const { wallet, connected } = useProgram();

  const [coverageStart, setCoverageStart] = useState('2026-01-01');
  const [coverageEnd, setCoverageEnd] = useState('2026-12-31');
  const [premium, setPremium] = useState(1);

  const handleSetTerms = async () => {
    if (mode === 'simulation') {
      const result = setTerms();
      if (!result.ok) { toast(result.msg!, 'd'); return; }
      toast(t('toast.termsSet'), 'i');
      return;
    }

    // On-chain mode
    if (!connected || !wallet) {
      toast('Please connect your wallet first', 'd');
      return;
    }
    if (shares.leader + shares.partA + shares.partB !== 100) {
      toast(t('store.shareSumError'), 'd');
      return;
    }

    const masterId = Date.now(); // Use timestamp as unique ID
    const leaderKey = wallet.publicKey;

    // TODO: 각 역할별 별도 지갑 주소를 UI 입력으로 받아야 함
    // 현재 데모에서는 leader 지갑이 operator/reinsurer 역할을 겸함
    const operatorKey = leaderKey;
    const reinsurerKey = leaderKey;

    // Derive ATAs for token accounts (SPL Token Program expects token accounts, not wallets)
    const leaderATA = await getAssociatedTokenAddress(CURRENCY_MINT, leaderKey);

    const result = await createMasterPolicy({
      masterId,
      coverageStartTs: Math.floor(new Date(coverageStart).getTime() / 1000),
      coverageEndTs: Math.floor(new Date(coverageEnd).getTime() / 1000),
      premiumPerPolicy: premium * 1_000_000, // USDC 6 decimals
      payoutDelay2h: DEFAULT_PAYOUT_TIERS.delay2h,
      payoutDelay3h: DEFAULT_PAYOUT_TIERS.delay3h,
      payoutDelay4to5h: DEFAULT_PAYOUT_TIERS.delay4to5h,
      payoutDelay6hOrCancelled: DEFAULT_PAYOUT_TIERS.delay6hOrCancelled,
      // TODO: UI 입력으로 받을 수 있도록 개선 필요 (현재 고정값)
      cededRatioBps: 5000, // 50% cession
      reinsCommissionBps: 1000, // 10% commission
      operator: operatorKey,
      reinsurer: reinsurerKey,
      currencyMint: CURRENCY_MINT,
      leaderDepositWallet: leaderATA,
      reinsurerPoolWallet: leaderATA,
      reinsurerDepositWallet: leaderATA,
      // TODO: 각 participant는 서로 다른 지갑이어야 함
      // 같은 키를 사용하면 register_participant_wallets에서 position() 매칭이
      // 항상 index 0만 반환하여 participant[1],[2]의 wallet이 미등록 상태로 남음
      // → confirm_master에서 InvalidInput 에러 발생
      participants: [
        { insurer: leaderKey, shareBps: shares.leader * 100 },
        { insurer: leaderKey, shareBps: shares.partA * 100 },
        { insurer: leaderKey, shareBps: shares.partB * 100 },
      ],
    });

    if (!result.success) {
      toast(`TX failed: ${result.error}`, 'd');
      return;
    }

    const [pda] = getMasterPolicyPDA(leaderKey, new BN(masterId));
    setMasterPolicyPDA(pda.toBase58());
    onChainSetTerms(result.signature, 5000, 1000);
    toast(`Master policy created! TX: ${result.signature.slice(0, 8)}...`, 's');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('master.title')}</CardTitle>
        <Tag variant={masterActive ? 'accent' : 'subtle'}>{masterActive ? t('common.active') : t('common.inactive')}</Tag>
      </CardHeader>
      <CardBody>
        <FormGroup>
          <FormLabel>{t('master.coverageStart')}</FormLabel>
          <FormInput
            value={coverageStart}
            onChange={e => setCoverageStart(e.target.value)}
            type="date"
          />
        </FormGroup>
        <FormGroup>
          <FormLabel>{t('master.coverageEnd')}</FormLabel>
          <FormInput
            value={coverageEnd}
            onChange={e => setCoverageEnd(e.target.value)}
            type="date"
          />
        </FormGroup>
        <FormGroup>
          <FormLabel>{t('master.coverageType')}</FormLabel>
          <FormInput value={t('master.coverageTypeValue')} readOnly style={{ opacity: 0.6 }} />
        </FormGroup>
        <FormGroup>
          <FormLabel>{t('master.premiumPerContract')}</FormLabel>
          <FormInput
            type="number"
            value={premium}
            onChange={e => setPremium(parseInt(e.target.value) || 1)}
            min={1}
            style={{ fontFamily: "'DM Mono', monospace" }}
          />
        </FormGroup>
        <Divider />
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--sub)', marginBottom: 6 }}>
          {t('master.payoutByTier')}
        </div>
        <TierItem label="2h~2h59m" value="40 USDC" color="#F59E0B" />
        <TierItem label="3h~3h59m" value="60 USDC" color="#f97316" />
        <TierItem label="4h~5h59m" value="80 USDC" color="#EF4444" />
        <TierItem label={t('master.tier.6h')} value="100 USDC" color="#fca5a5" />
        <Divider />
        {mode === 'onchain' && !connected && (
          <div style={{ fontSize: 9, color: 'var(--danger)', marginBottom: 6, textAlign: 'center' }}>
            Wallet not connected — connect to use on-chain mode
          </div>
        )}
        <Button variant="primary" fullWidth onClick={handleSetTerms} disabled={processStep >= 1 || loading}>
          {loading ? 'Sending TX...' : t('master.setTermsBtn')}
        </Button>
      </CardBody>
    </Card>
  );
}

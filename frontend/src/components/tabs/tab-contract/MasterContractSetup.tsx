import { useState } from 'react';
import BN from 'bn.js';
import { Transaction, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { Card, CardHeader, CardTitle, CardBody, Button, FormGroup, FormLabel, FormInput, Divider, Tag, TierItem } from '@/components/common';
import { useProtocolStore } from '@/store/useProtocolStore';
import { useToast } from '@/components/common';
import { useTranslation } from 'react-i18next';
import { useProgram } from '@/hooks/useProgram';
import { getMasterPolicyPDA } from '@/lib/pda';
import { CURRENCY_MINT, DEFAULT_PAYOUT_TIERS } from '@/lib/constants';
import { generateDemoKeypairs } from '@/lib/demo-keypairs';
import { ConfirmRole } from '@/lib/idl/open_parametric';

export function MasterContractSetup() {
  const { mode, masterActive, processStep, shares, setTerms, onChainSetTerms, onChainConfirm, setMasterPolicyPDA } = useProtocolStore();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { program, provider, wallet, connected } = useProgram();

  const [coverageStart, setCoverageStart] = useState('2026-01-01');
  const [coverageEnd, setCoverageEnd] = useState('2026-12-31');
  const [premium, setPremium] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleSetTerms = async () => {
    if (mode === 'simulation') {
      const result = setTerms();
      if (!result.ok) { toast(result.msg!, 'd'); return; }
      toast(t('toast.termsSet'), 'i');
      return;
    }

    // On-chain mode
    if (!connected || !wallet || !program || !provider) {
      toast('Please connect your wallet first', 'd');
      return;
    }
    if (shares.leader + shares.partA + shares.partB !== 100) {
      toast(t('store.shareSumError'), 'd');
      return;
    }

    setLoading(true);
    try {
      const leaderKey = wallet.publicKey;
      const leaderATA = await getAssociatedTokenAddress(CURRENCY_MINT, leaderKey);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prog = program as any;

      // TODO.demo: 데모용 인메모리 키페어 생성 — 프로덕션에서는 UI에서 참여사 지갑 주소 입력
      const { partA: partAKp, partB: partBKp } = generateDemoKeypairs();

      const masterId = Date.now();
      const masterIdBN = new BN(masterId);
      const [masterPolicyPDA] = getMasterPolicyPDA(leaderKey, masterIdBN);

      // TODO.demo: 각 역할별 별도 지갑이어야 함 — 현재 데모에서는 leader=operator=reinsurer
      const operatorKey = leaderKey;
      const reinsurerKey = leaderKey;

      // TODO.demo: 데모 키페어에 SOL 전송 (confirm TX 가스비용)
      const fundPartA = SystemProgram.transfer({
        fromPubkey: leaderKey,
        toPubkey: partAKp.publicKey,
        lamports: 10_000_000, // 0.01 SOL
      });
      const fundPartB = SystemProgram.transfer({
        fromPubkey: leaderKey,
        toPubkey: partBKp.publicKey,
        lamports: 10_000_000,
      });

      // TODO.demo: 데모 키페어의 ATA(SPL Token Account) 생성 — leader가 rent 비용 부담
      // 실제 환경에서는 각 참여사가 자체 ATA를 이미 보유
      const partAATA = await getAssociatedTokenAddress(CURRENCY_MINT, partAKp.publicKey);
      const partBATA = await getAssociatedTokenAddress(CURRENCY_MINT, partBKp.publicKey);
      const createPartAATAIx = createAssociatedTokenAccountInstruction(
        leaderKey, partAATA, partAKp.publicKey, CURRENCY_MINT,
      );
      const createPartBATAIx = createAssociatedTokenAccountInstruction(
        leaderKey, partBATA, partBKp.publicKey, CURRENCY_MINT,
      );

      const createMasterIx = await prog.methods
        .createMasterPolicy({
          masterId: masterIdBN,
          coverageStartTs: new BN(Math.floor(new Date(coverageStart).getTime() / 1000)),
          coverageEndTs: new BN(Math.floor(new Date(coverageEnd).getTime() / 1000)),
          premiumPerPolicy: new BN(premium * 1_000_000),
          payoutDelay2h: new BN(DEFAULT_PAYOUT_TIERS.delay2h),
          payoutDelay3h: new BN(DEFAULT_PAYOUT_TIERS.delay3h),
          payoutDelay4to5h: new BN(DEFAULT_PAYOUT_TIERS.delay4to5h),
          payoutDelay6hOrCancelled: new BN(DEFAULT_PAYOUT_TIERS.delay6hOrCancelled),
          // TODO.demo: UI 입력으로 받을 수 있도록 개선 필요 (현재 고정값)
          cededRatioBps: 5000,
          reinsCommissionBps: 1000,
          // TODO.demo: 데모에서는 3명 모두 다른 지갑 키페어 사용
          participants: [
            { insurer: leaderKey, shareBps: shares.leader * 100 },
            { insurer: partAKp.publicKey, shareBps: shares.partA * 100 },
            { insurer: partBKp.publicKey, shareBps: shares.partB * 100 },
          ],
        })
        .accounts({
          leader: leaderKey,
          operator: operatorKey,
          reinsurer: reinsurerKey,
          currencyMint: CURRENCY_MINT,
          masterPolicy: masterPolicyPDA,
          leaderDepositWallet: leaderATA,
          reinsurerPoolWallet: leaderATA,
          reinsurerDepositWallet: leaderATA,
        })
        .instruction();

      const regLeaderIx = await prog.methods
        .registerParticipantWallets()
        .accounts({
          insurer: leaderKey,
          masterPolicy: masterPolicyPDA,
          poolWallet: leaderATA,
          depositWallet: leaderATA,
        })
        .instruction();

      const confirmLeaderIx = await prog.methods
        .confirmMaster(ConfirmRole.Participant)
        .accounts({
          actor: leaderKey,
          masterPolicy: masterPolicyPDA,
        })
        .instruction();

      const confirmReinIx = await prog.methods
        .confirmMaster(ConfirmRole.Reinsurer)
        .accounts({
          actor: leaderKey,
          masterPolicy: masterPolicyPDA,
        })
        .instruction();

      // ── Single TX: fund + create ATAs + create master + register leader + confirm leader + confirm rein ──
      // TODO.demo: 1개 TX로 합쳐 Phantom 서명 1회만 요청 (TX 크기 초과 시 2개로 분리 필요)
      const tx = new Transaction().add(
        fundPartA, fundPartB,
        createPartAATAIx, createPartBATAIx,
        createMasterIx,
        regLeaderIx, confirmLeaderIx, confirmReinIx,
      );
      const sig = await provider.sendAndConfirm(tx);

      // ── Update store ──
      setMasterPolicyPDA(masterPolicyPDA.toBase58());
      onChainSetTerms(sig, 5000, 1000);
      // Leader (participant[0]) and reinsurer already confirmed
      onChainConfirm('rein', sig);

      toast(`Master policy created! TX: ${sig.slice(0, 8)}...`, 's');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast(`TX failed: ${message}`, 'd');
    } finally {
      setLoading(false);
    }
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

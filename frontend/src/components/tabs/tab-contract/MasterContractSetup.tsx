import { useState } from 'react';
import BN from 'bn.js';
import { Transaction, TransactionInstruction, SystemProgram, Keypair, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, createInitializeAccount3Instruction, createAssociatedTokenAccountIdempotentInstruction, ACCOUNT_SIZE, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Card, CardHeader, CardTitle, CardBody, Button, FormGroup, FormLabel, FormInput, Divider, Tag } from '@/components/common';
import { useProtocolStore } from '@/store/useProtocolStore';
import { useToast } from '@/components/common';
import { useTranslation } from 'react-i18next';
import { useProgram } from '@/hooks/useProgram';
import { getMasterPolicyPDA } from '@/lib/pda';
import { CURRENCY_MINT, DEFAULT_PAYOUT_TIERS } from '@/lib/constants';
import { setPoolWallet } from '@/lib/demo-keypairs';
import { ConfirmRole } from '@/lib/idl/open_parametric';

export function MasterContractSetup() {
  const { mode, masterActive, processStep, shares, setTerms, onChainSetTerms, setMasterAgreementPDA } = useProtocolStore();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { program, provider, wallet, connected } = useProgram();

  const [coverageStart, setCoverageStart] = useState('2026-01-01');
  const [coverageEnd, setCoverageEnd] = useState('2026-12-31');
  const [premium, setPremium] = useState(3);
  const [payout2h, setPayout2h] = useState(DEFAULT_PAYOUT_TIERS.delay2h);
  const [payout3h, setPayout3h] = useState(DEFAULT_PAYOUT_TIERS.delay3h);
  const [payout4to5h, setPayout4to5h] = useState(DEFAULT_PAYOUT_TIERS.delay4to5h);
  const [payout6h, setPayout6h] = useState(DEFAULT_PAYOUT_TIERS.delay6hOrCancelled);
  const [loading, setLoading] = useState(false);
  const [partAAddress, setPartAAddress] = useState('');
  const [partBAddress, setPartBAddress] = useState('');
  const [reinsurerAddress, setReinsurerAddress] = useState('');

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

    // 참여사 지갑 주소 검증 (setLoading 전에 수행)
    let partAPubkey: PublicKey, partBPubkey: PublicKey, reinsurerPubkey: PublicKey;
    try {
      partAPubkey = new PublicKey(partAAddress);
      partBPubkey = new PublicKey(partBAddress);
      reinsurerPubkey = new PublicKey(reinsurerAddress);
    } catch {
      toast('유효하지 않은 지갑 주소입니다', 'd');
      return;
    }

    setLoading(true);
    try {
      const leaderKey = wallet.publicKey;
      const leaderATA = await getAssociatedTokenAddress(CURRENCY_MINT, leaderKey);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prog = program as any;

      // PDA-owned pool 계정 키페어 (settle 시 MasterPolicy PDA가 서명하려면 SPL Token owner = PDA 필요)
      const leaderPoolKp = Keypair.generate();
      const partAPoolKp = Keypair.generate();
      const partBPoolKp = Keypair.generate();
      const reinsurerPoolKp = Keypair.generate();

      const masterId = Date.now();
      const masterIdBN = new BN(masterId);
      const [masterAgreementPDA] = getMasterPolicyPDA(leaderKey, masterIdBN);

      const operatorKey = leaderKey;
      const reinsurerKey = reinsurerPubkey;

      // ── PDA-owned pool 계정 생성 ──
      // settle_flight_claim.rs에서 pool_wallet.owner == master.key() 검증을 통과하려면
      // pool 계정의 SPL Token authority(owner)가 MasterPolicy PDA여야 함.
      // createInitializeAccount3Instruction: owner가 서명 없이도 PDA를 authority로 지정 가능.
      const poolRent = await provider.connection.getMinimumBalanceForRentExemption(ACCOUNT_SIZE);
      const makePoolIxs = (kp: Keypair): [TransactionInstruction, TransactionInstruction] => [
        SystemProgram.createAccount({
          fromPubkey: leaderKey,
          newAccountPubkey: kp.publicKey,
          lamports: poolRent,
          space: ACCOUNT_SIZE,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeAccount3Instruction(kp.publicKey, CURRENCY_MINT, masterAgreementPDA),
      ];
      const [createLeaderPoolIx, initLeaderPoolIx] = makePoolIxs(leaderPoolKp);
      const [createPartAPoolIx, initPartAPoolIx] = makePoolIxs(partAPoolKp);
      const [createPartBPoolIx, initPartBPoolIx] = makePoolIxs(partBPoolKp);
      const [createReinsurerPoolIx, initReinsurerPoolIx] = makePoolIxs(reinsurerPoolKp);

      const createMasterIx = await prog.methods
        .createMasterPolicy({
          masterId: masterIdBN,
          coverageStartTs: new BN(Math.floor(new Date(coverageStart).getTime() / 1000)),
          coverageEndTs: new BN(Math.floor(new Date(coverageEnd).getTime() / 1000)),
          premiumPerPolicy: new BN(premium * 1_000_000),
          payoutDelay2H: new BN(payout2h * 1_000_000),
          payoutDelay3H: new BN(payout3h * 1_000_000),
          payoutDelay4To5H: new BN(payout4to5h * 1_000_000),
          payoutDelay6HOrCancelled: new BN(payout6h * 1_000_000),
          cededRatioBps: 5000,
          reinsCommissionBps: 1000,
          participants: [
            { insurer: leaderKey, shareBps: shares.leader * 100 },
            { insurer: partAPubkey, shareBps: shares.partA * 100 },
            { insurer: partBPubkey, shareBps: shares.partB * 100 },
          ],
        })
        .accounts({
          leader: leaderKey,
          operator: operatorKey,
          reinsurer: reinsurerKey,
          currencyMint: CURRENCY_MINT,
          masterPolicy: masterAgreementPDA,
          leaderDepositWallet: leaderPoolKp.publicKey, // PDA-owned: settle 시 MasterPolicy PDA가 서명
          reinsurerPoolWallet: reinsurerPoolKp.publicKey, // PDA-owned
          reinsurerDepositWallet: await getAssociatedTokenAddress(CURRENCY_MINT, reinsurerPubkey),
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction();

      // leader pool wallet 등록 (poolWallet = PDA-owned, depositWallet = leader ATA)
      const regLeaderIx = await prog.methods
        .registerParticipantWallets()
        .accounts({
          insurer: leaderKey,
          masterPolicy: masterAgreementPDA,
          poolWallet: leaderPoolKp.publicKey,
          depositWallet: leaderATA,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction();

      const confirmLeaderIx = await prog.methods
        .confirmMaster(ConfirmRole.Participant)
        .accounts({ actor: leaderKey, masterPolicy: masterAgreementPDA })
        .instruction();

      // leader/reinsurer ATA가 없을 경우 idempotent하게 생성 (이미 있으면 no-op)
      const createLeaderATAIx = createAssociatedTokenAccountIdempotentInstruction(
        leaderKey, leaderATA, leaderKey, CURRENCY_MINT,
        TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
      );
      const reinsurerATA = await getAssociatedTokenAddress(CURRENCY_MINT, reinsurerPubkey);
      const createReinsurerATAIx = createAssociatedTokenAccountIdempotentInstruction(
        leaderKey, reinsurerATA, reinsurerPubkey, CURRENCY_MINT,
        TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
      );

      // ── TX1: ATA 생성 + pool 계정 생성 ──
      const tx1 = new Transaction().add(
        createLeaderATAIx,
        createReinsurerATAIx,
        createLeaderPoolIx, initLeaderPoolIx,
        createPartAPoolIx, initPartAPoolIx,
        createPartBPoolIx, initPartBPoolIx,
        createReinsurerPoolIx, initReinsurerPoolIx,
      );
      await provider.sendAndConfirm(tx1, [
        leaderPoolKp, partAPoolKp, partBPoolKp, reinsurerPoolKp,
      ]);

      // ── TX2: 마스터계약 생성 + leader 등록/확인 ──
      const tx2 = new Transaction().add(
        createMasterIx,
        regLeaderIx, confirmLeaderIx,
      );
      const sig = await provider.sendAndConfirm(tx2, []);

      // pool wallet pubkey 저장 (ParticipantConfirm에서 registerParticipantWallets 시 사용)
      setPoolWallet('partA', partAPoolKp.publicKey);
      setPoolWallet('partB', partBPoolKp.publicKey);

      // ── Update store (partA/B/rein 컨펌은 ParticipantConfirm에서 단계별로 처리) ──
      setMasterAgreementPDA(masterAgreementPDA.toBase58());
      onChainSetTerms(sig, 5000, 1000, premium, {
        delay2h: payout2h, delay3h: payout3h, delay4to5h: payout4to5h, delay6hOrCancelled: payout6h,
      });

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
        {([
          { label: '2h~2h59m', color: '#F59E0B', value: payout2h, set: setPayout2h },
          { label: '3h~3h59m', color: '#f97316', value: payout3h, set: setPayout3h },
          { label: '4h~5h59m', color: '#EF4444', value: payout4to5h, set: setPayout4to5h },
          { label: t('master.tier.6h'), color: '#fca5a5', value: payout6h, set: setPayout6h },
        ] as { label: string; color: string; value: number; set: (v: number) => void }[]).map(tier => (
          <div key={tier.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
            <span style={{ fontSize: 10, color: 'var(--sub)' }}>{tier.label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="number"
                value={tier.value}
                onChange={e => tier.set(parseInt(e.target.value) || 0)}
                min={0}
                style={{
                  width: 52, textAlign: 'right', fontFamily: "'DM Mono', monospace", fontSize: 10,
                  color: tier.color, background: 'var(--card2)', border: '1px solid var(--border)',
                  borderRadius: 5, padding: '2px 5px', outline: 'none',
                }}
              />
              <span style={{ fontSize: 9, color: 'var(--sub)' }}>USDC</span>
            </div>
          </div>
        ))}
        <Divider />
        {mode === 'onchain' && (
          <>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--sub)', marginBottom: 6 }}>
              {t('master.participantAddresses')}
            </div>
            <FormGroup>
              <FormLabel>{t('master.partAAddress')}</FormLabel>
              <FormInput
                value={partAAddress}
                onChange={e => setPartAAddress(e.target.value)}
                placeholder="Participant A wallet address"
                style={{ fontFamily: "'DM Mono', monospace", fontSize: 10 }}
              />
            </FormGroup>
            <FormGroup>
              <FormLabel>{t('master.partBAddress')}</FormLabel>
              <FormInput
                value={partBAddress}
                onChange={e => setPartBAddress(e.target.value)}
                placeholder="Participant B wallet address"
                style={{ fontFamily: "'DM Mono', monospace", fontSize: 10 }}
              />
            </FormGroup>
            <FormGroup>
              <FormLabel>{t('master.reinsurerAddress')}</FormLabel>
              <FormInput
                value={reinsurerAddress}
                onChange={e => setReinsurerAddress(e.target.value)}
                placeholder="Reinsurer wallet address"
                style={{ fontFamily: "'DM Mono', monospace", fontSize: 10 }}
              />
            </FormGroup>
          </>
        )}
        {mode === 'onchain' && !connected && (
          <div style={{ fontSize: 9, color: 'var(--danger)', marginBottom: 6, textAlign: 'center' }}>
            Wallet not connected — connect to use on-chain mode
          </div>
        )}
        <Button variant="primary" fullWidth onClick={handleSetTerms} disabled={processStep >= 1 || loading} data-guide="set-terms-btn">
          {loading ? 'Sending TX...' : t('master.setTermsBtn')}
        </Button>
      </CardBody>
    </Card>
  );
}

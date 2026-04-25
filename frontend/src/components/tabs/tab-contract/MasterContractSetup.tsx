import { useState } from 'react';
import BN from 'bn.js';
import { Transaction, TransactionInstruction, SystemProgram, Keypair, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, createInitializeAccount3Instruction, createTransferInstruction, createAssociatedTokenAccountIdempotentInstruction, ACCOUNT_SIZE, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Card, CardHeader, CardTitle, CardBody, Button, FormGroup, FormLabel, FormInput, Divider, Tag } from '@/components/common';
import { useProtocolStore, PARTICIPANT_COLORS, REINSURER_COLOR } from '@/store/useProtocolStore';
import { useToast } from '@/components/common';
import { useTranslation } from 'react-i18next';
import { useProgram } from '@/hooks/useProgram';
import { getMasterPolicyPDA } from '@/lib/pda';
import { CURRENCY_MINT } from '@/lib/constants';
import { setPoolWallet } from '@/lib/demo-keypairs';
import { ConfirmRole } from '@/lib/idl/open_parametric';

type MasterContractSetupProps = {
  onTermsSet?: () => void;
};

export function MasterContractSetup({ onTermsSet }: MasterContractSetupProps) {
  const store = useProtocolStore();
  const { mode, masterActive, processStep, leaderShare, participants, reinsurer, masterAgreementPDA, setTerms, onChainSetTerms, setMasterAgreementPDA, refreshPool, setCoverage } = store;
  const { toast } = useToast();
  const { t } = useTranslation();
  const { program, provider, wallet, connected } = useProgram();

  const locked = processStep >= 1;

  const [coverageStart, setCoverageStart] = useState(store.coverageStart);
  const [coverageEnd, setCoverageEnd] = useState(store.coverageEnd);
  const [premium, setPremium] = useState(store.premiumPerPolicy);
  const [payout2h, setPayout2h] = useState(store.payoutTiers.delay2h);
  const [payout3h, setPayout3h] = useState(store.payoutTiers.delay3h);
  const [payout4to5h, setPayout4to5h] = useState(store.payoutTiers.delay4to5h);
  const [payout6h, setPayout6h] = useState(store.payoutTiers.delay6hOrCancelled);
  const [loading, setLoading] = useState(false);
  const [fundLoading, setFundLoading] = useState(false);

  const handleSetTerms = async () => {
    if (mode === 'simulation') {
      setCoverage({ start: coverageStart, end: coverageEnd });
      const result = setTerms();
      if (!result.ok) { toast(result.msg!, 'd'); return; }
      toast(t('toast.termsSet'), 'i');
      onTermsSet?.();
      return;
    }

    // On-chain mode
    if (!connected || !wallet || !program || !provider) {
      toast('Please connect your wallet first', 'd');
      return;
    }
    const total = leaderShare + participants.reduce((s, p) => s + p.share, 0);
    if (total !== 100) {
      toast(t('store.shareSumError'), 'd');
      return;
    }

    // 참여사 지갑 주소 검증
    const participantPubkeys: PublicKey[] = [];
    try {
      for (const p of participants) {
        participantPubkeys.push(new PublicKey(p.address));
      }
    } catch {
      toast('유효하지 않은 참여사 지갑 주소입니다', 'd');
      return;
    }

    let reinsurerPubkey: PublicKey | null = null;
    if (reinsurer.enabled) {
      try {
        reinsurerPubkey = new PublicKey(reinsurer.address);
      } catch {
        toast('유효하지 않은 재보험사 지갑 주소입니다', 'd');
        return;
      }
    }

    setLoading(true);
    try {
      const leaderKey = wallet.publicKey;
      const leaderATA = await getAssociatedTokenAddress(CURRENCY_MINT, leaderKey);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prog = program as any;

      // PDA-owned pool 계정 키페어
      const leaderPoolKp = Keypair.generate();
      const participantPoolKps = participants.map(() => Keypair.generate());
      const reinsurerPoolKp = reinsurer.enabled ? Keypair.generate() : null;

      const masterId = Date.now();
      const masterIdBN = new BN(masterId);
      const [masterAgreementPDA] = getMasterPolicyPDA(leaderKey, masterIdBN);

      const operatorKey = leaderKey;

      // ── PDA-owned pool 계정 생성 ──
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

      const poolIxs: TransactionInstruction[] = [];
      const poolSigners: Keypair[] = [];

      // Leader pool
      const [createLeaderPoolIx, initLeaderPoolIx] = makePoolIxs(leaderPoolKp);
      poolIxs.push(createLeaderPoolIx, initLeaderPoolIx);
      poolSigners.push(leaderPoolKp);

      // Participant pools
      for (const kp of participantPoolKps) {
        const [createIx, initIx] = makePoolIxs(kp);
        poolIxs.push(createIx, initIx);
        poolSigners.push(kp);
      }

      // Reinsurer pool
      if (reinsurerPoolKp) {
        const [createIx, initIx] = makePoolIxs(reinsurerPoolKp);
        poolIxs.push(createIx, initIx);
        poolSigners.push(reinsurerPoolKp);
      }

      // Build non-leader participants array for instruction
      const instructionParticipants = participants.map((p, i) => ({
        insurer: participantPubkeys[i]!,
        shareBps: p.share * 100,
      }));

      const reinsurerKey = reinsurerPubkey ?? leaderKey; // fallback if no reinsurer
      const reinsurerDepositWallet = reinsurerPubkey
        ? await getAssociatedTokenAddress(CURRENCY_MINT, reinsurerPubkey)
        : leaderATA;

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
          leaderShareBps: leaderShare * 100,
          cededRatioBps: reinsurer.enabled ? 5000 : 0,
          reinsCommissionBps: reinsurer.enabled ? 1000 : 0,
          participants: instructionParticipants,
        })
        .accounts({
          leader: leaderKey,
          operator: operatorKey,
          reinsurer: reinsurerKey,
          currencyMint: CURRENCY_MINT,
          masterPolicy: masterAgreementPDA,
          leaderDepositWallet: leaderATA,
          reinsurerPoolWallet: reinsurerPoolKp?.publicKey ?? leaderPoolKp.publicKey,
          reinsurerDepositWallet,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction();

      // leader pool wallet 등록
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

      // ATA 생성 (idempotent)
      const ataIxs: TransactionInstruction[] = [
        createAssociatedTokenAccountIdempotentInstruction(
          leaderKey, leaderATA, leaderKey, CURRENCY_MINT,
          TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      ];
      if (reinsurerPubkey) {
        const reinsurerATA = await getAssociatedTokenAddress(CURRENCY_MINT, reinsurerPubkey);
        ataIxs.push(createAssociatedTokenAccountIdempotentInstruction(
          leaderKey, reinsurerATA, reinsurerPubkey, CURRENCY_MINT,
          TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
        ));
      }

      // ── TX1: ATA 생성 + pool 계정 생성 ──
      const tx1 = new Transaction().add(...ataIxs, ...poolIxs);
      await provider.sendAndConfirm(tx1, poolSigners);

      // ── TX2: 마스터계약 생성 + leader 등록/확인 ──
      const tx2 = new Transaction().add(createMasterIx, regLeaderIx, confirmLeaderIx);
      const sig = await provider.sendAndConfirm(tx2, []);

      // pool wallet pubkey 저장
      participants.forEach((p, i) => {
        setPoolWallet(p.id, participantPoolKps[i]!.publicKey);
      });

      // ── Update store ──
      setMasterAgreementPDA(masterAgreementPDA.toBase58());
      onChainSetTerms(sig, {
        cededRatioBps: reinsurer.enabled ? 5000 : 0,
        reinsCommissionBps: reinsurer.enabled ? 1000 : 0,
        premium,
        payoutTiers: { delay2h: payout2h, delay3h: payout3h, delay4to5h: payout4to5h, delay6hOrCancelled: payout6h },
        coverageDates: { start: coverageStart, end: coverageEnd },
        leaderShare,
        participants,
        reinsurer,
      });

      toast(`Master policy created! TX: ${sig.slice(0, 8)}...`, 's');
      onTermsSet?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('AlreadyProcessed') || message.includes('already been processed')) {
        toast('Master policy 생성 완료 (tx 중복 응답 무시)', 's');
      } else {
        toast(`TX failed: ${message}`, 'd');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFundPools = async () => {
    if (!masterAgreementPDA || !wallet || !program || !provider) {
      toast('Wallet not connected or no master agreement selected', 'd');
      return;
    }
    setFundLoading(true);
    try {
      const masterPK = new PublicKey(masterAgreementPDA);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const masterData = await (program as any).account.masterPolicy.fetch(masterPK);

      const NUM_CLAIMS = 5;
      const maxPayoutRaw: number = masterData.payoutDelay6HOrCancelled.toNumber();
      const totalPayout = maxPayoutRaw * NUM_CLAIMS;

      const reinsurerEffBps: number = masterData.reinsurerEffectiveBps;
      const reinsurerAmount = Math.floor(totalPayout * reinsurerEffBps / 10_000);
      const insurerTotal = totalPayout - reinsurerAmount;

      const currencyMint: PublicKey = masterData.currencyMint;
      const leaderATA = await getAssociatedTokenAddress(currencyMint, wallet.publicKey);
      const ixs = [];

      // reinsurer pool 충전
      if (reinsurerAmount > 0 && masterData.reinsurerPoolWallet) {
        ixs.push(createTransferInstruction(
          leaderATA, masterData.reinsurerPoolWallet, wallet.publicKey, reinsurerAmount,
        ));
      }

      const leaderAmount = Math.floor(insurerTotal * masterData.leaderShareBps / 10_000);
      if (leaderAmount > 0) {
        ixs.push(createTransferInstruction(
          leaderATA, masterData.leaderPoolWallet, wallet.publicKey, leaderAmount,
        ));
      }

      // 각 참여사 pool 충전 (지분율 기반)
      for (const p of masterData.participants) {
        const amount = Math.floor(insurerTotal * p.shareBps / 10_000);
        if (amount > 0) {
          ixs.push(createTransferInstruction(
            leaderATA, p.poolWallet, wallet.publicKey, amount,
          ));
        }
      }

      const tx = new Transaction().add(...ixs);
      const sig = await provider.sendAndConfirm(tx, []);
      refreshPool();
      const totalUsdc = (totalPayout / 1_000_000).toFixed(2);
      toast(`Pool funded (${totalUsdc} USDC total)! TX: ${sig.slice(0, 8)}...`, 's');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast(`Fund failed: ${message}`, 'd');
    } finally {
      setFundLoading(false);
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
            value={locked ? store.coverageStart : coverageStart}
            onChange={e => setCoverageStart(e.target.value)}
            type="date"
            readOnly={locked}
            style={{ opacity: locked ? 0.6 : 1 }}
          />
        </FormGroup>
        <FormGroup>
          <FormLabel>{t('master.coverageEnd')}</FormLabel>
          <FormInput
            value={locked ? store.coverageEnd : coverageEnd}
            onChange={e => setCoverageEnd(e.target.value)}
            type="date"
            readOnly={locked}
            style={{ opacity: locked ? 0.6 : 1 }}
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
            value={locked ? store.premiumPerPolicy : premium}
            onChange={e => setPremium(parseInt(e.target.value) || 1)}
            min={1}
            readOnly={locked}
            style={{ fontFamily: "'DM Mono', monospace", opacity: locked ? 0.6 : 1 }}
          />
        </FormGroup>
        <Divider />
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--sub)', marginBottom: 6 }}>
          {t('master.payoutByTier')}
        </div>
        {([
          { label: '2h~2h59m', color: '#F59E0B', value: locked ? store.payoutTiers.delay2h : payout2h, set: setPayout2h },
          { label: '3h~3h59m', color: '#f97316', value: locked ? store.payoutTiers.delay3h : payout3h, set: setPayout3h },
          { label: '4h~5h59m', color: '#EF4444', value: locked ? store.payoutTiers.delay4to5h : payout4to5h, set: setPayout4to5h },
          { label: t('master.tier.6h'), color: '#fca5a5', value: locked ? store.payoutTiers.delay6hOrCancelled : payout6h, set: setPayout6h },
        ] as { label: string; color: string; value: number; set: (v: number) => void }[]).map(tier => (
          <div key={tier.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
            <span style={{ fontSize: 10, color: 'var(--sub)' }}>{tier.label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="number"
                value={tier.value}
                onChange={e => tier.set(parseInt(e.target.value) || 0)}
                min={0}
                readOnly={locked}
                style={{
                  width: 52, textAlign: 'right', fontFamily: "'DM Mono', monospace", fontSize: 10,
                  color: tier.color, background: 'var(--card2)', border: '1px solid var(--border)',
                  borderRadius: 5, padding: '2px 5px', outline: 'none',
                  opacity: locked ? 0.6 : 1,
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
            {participants.map((p, i) => (
              <FormGroup key={p.id}>
                <FormLabel style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: PARTICIPANT_COLORS[i], display: 'inline-block' }} />
                  {p.name || `${t('share.participant')} ${i + 1}`}
                </FormLabel>
                <FormInput
                  value={p.address}
                  onChange={e => store.updateParticipant(p.id, { address: e.target.value })}
                  placeholder={`${t('share.participant')} ${i + 1} wallet address`}
                  readOnly={locked}
                  style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, opacity: locked ? 0.6 : 1 }}
                />
              </FormGroup>
            ))}
            {reinsurer.enabled ? (
              <FormGroup>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <FormLabel style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: REINSURER_COLOR, display: 'inline-block' }} />
                    {t('master.reinsurerAddress')}
                  </FormLabel>
                  {!locked && (
                    <button
                      onClick={() => store.toggleReinsurer()}
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 9, padding: '0 4px' }}
                    >{t('master.removeReinsurer')}</button>
                  )}
                </div>
                <FormInput
                  value={reinsurer.address}
                  onChange={e => store.setReinsurer({ address: e.target.value })}
                  placeholder="Reinsurer wallet address"
                  readOnly={locked}
                  style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, opacity: locked ? 0.6 : 1 }}
                />
              </FormGroup>
            ) : (
              !locked && (
                <Button variant="outline" size="sm" fullWidth onClick={() => store.toggleReinsurer()} style={{ marginBottom: 8 }}>
                  + {t('master.addReinsurer')}
                </Button>
              )
            )}
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
        {mode === 'onchain' && masterActive && (
          <Button variant="warning" fullWidth onClick={handleFundPools} disabled={fundLoading} style={{ marginTop: 6 }} data-guide="fund-pool-btn">
            {fundLoading ? 'Funding...' : t('master.fundAllPools')}
          </Button>
        )}
      </CardBody>
    </Card>
  );
}

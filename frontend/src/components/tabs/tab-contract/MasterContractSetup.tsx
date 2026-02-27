import { useState } from 'react';
import BN from 'bn.js';
import { Transaction, TransactionInstruction, SystemProgram, Keypair, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createInitializeAccount3Instruction, createTransferInstruction, ACCOUNT_SIZE, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Card, CardHeader, CardTitle, CardBody, Button, FormGroup, FormLabel, FormInput, Divider, Tag } from '@/components/common';
import { useProtocolStore } from '@/store/useProtocolStore';
import { useToast } from '@/components/common';
import { useTranslation } from 'react-i18next';
import { useProgram } from '@/hooks/useProgram';
import { getMasterPolicyPDA } from '@/lib/pda';
import { CURRENCY_MINT, DEFAULT_PAYOUT_TIERS } from '@/lib/constants';
import { generateDemoKeypairs, setPoolWallet } from '@/lib/demo-keypairs';
import { ConfirmRole } from '@/lib/idl/open_parametric';

export function MasterContractSetup() {
  const { mode, masterActive, processStep, shares, masterPolicyPDA, setTerms, onChainSetTerms, setMasterPolicyPDA, refreshPool } = useProtocolStore();
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
  const [fundLoading, setFundLoading] = useState(false);

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

      // demo: 데모용 인메모리 키페어 생성 — 프로덕션에서는 UI에서 참여사 지갑 주소 입력
      const { partA: partAKp, partB: partBKp } = generateDemoKeypairs();

      // PDA-owned pool 계정 키페어 (settle 시 MasterPolicy PDA가 서명하려면 SPL Token owner = PDA 필요)
      const leaderPoolKp = Keypair.generate();
      const partAPoolKp = Keypair.generate();
      const partBPoolKp = Keypair.generate();
      const reinsurerPoolKp = Keypair.generate();

      const masterId = Date.now();
      const masterIdBN = new BN(masterId);
      const [masterPolicyPDA] = getMasterPolicyPDA(leaderKey, masterIdBN);

      // demo: 각 역할별 별도 지갑이어야 함 — 현재 데모에서는 leader=operator=reinsurer
      const operatorKey = leaderKey;
      const reinsurerKey = leaderKey;

      // demo: 데모 키페어에 SOL 전송 (confirm TX 가스비용)
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

      // demo: 데모 키페어의 ATA(SPL Token Account, deposit wallet) 생성 — leader가 rent 비용 부담
      // 실제 환경에서는 각 참여사가 자체 ATA를 이미 보유
      const partAATA = await getAssociatedTokenAddress(CURRENCY_MINT, partAKp.publicKey);
      const partBATA = await getAssociatedTokenAddress(CURRENCY_MINT, partBKp.publicKey);
      const createPartAATAIx = createAssociatedTokenAccountInstruction(
        leaderKey, partAATA, partAKp.publicKey, CURRENCY_MINT,
      );
      const createPartBATAIx = createAssociatedTokenAccountInstruction(
        leaderKey, partBATA, partBKp.publicKey, CURRENCY_MINT,
      );

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
        createInitializeAccount3Instruction(kp.publicKey, CURRENCY_MINT, masterPolicyPDA),
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
          // demo: 데모에서는 3명 모두 다른 지갑 키페어 사용
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
          reinsurerPoolWallet: reinsurerPoolKp.publicKey, // PDA-owned
          reinsurerDepositWallet: leaderATA,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction();

      // leader pool wallet 등록 (poolWallet = PDA-owned, depositWallet = leader ATA)
      const regLeaderIx = await prog.methods
        .registerParticipantWallets()
        .accounts({
          insurer: leaderKey,
          masterPolicy: masterPolicyPDA,
          poolWallet: leaderPoolKp.publicKey,
          depositWallet: leaderATA,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction();

      const confirmLeaderIx = await prog.methods
        .confirmMaster(ConfirmRole.Participant)
        .accounts({ actor: leaderKey, masterPolicy: masterPolicyPDA })
        .instruction();

      // ── TX1: pool 계정 생성 + fund + ATA 생성 ──
      const tx1 = new Transaction().add(
        createLeaderPoolIx, initLeaderPoolIx,
        createPartAPoolIx, initPartAPoolIx,
        createPartBPoolIx, initPartBPoolIx,
        createReinsurerPoolIx, initReinsurerPoolIx,
        fundPartA, fundPartB,
        createPartAATAIx, createPartBATAIx,
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
      setMasterPolicyPDA(masterPolicyPDA.toBase58());
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

  const handleFundPools = async () => {
    if (!masterPolicyPDA || !wallet || !program || !provider) {
      toast('Wallet not connected or no master policy selected', 'd');
      return;
    }
    setFundLoading(true);
    try {
      const masterPK = new PublicKey(masterPolicyPDA);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const masterData = await (program as any).account.masterPolicy.fetch(masterPK);

      // 5건 최대 클레임(6h 티어) 감당 가능한 양으로 충전
      const NUM_CLAIMS = 5;
      const maxPayoutRaw: number = masterData.payoutDelay6HOrCancelled.toNumber();
      const totalPayout = maxPayoutRaw * NUM_CLAIMS;

      const reinsurerEffBps: number = masterData.reinsurerEffectiveBps;
      const reinsurerAmount = Math.floor(totalPayout * reinsurerEffBps / 10_000);
      const insurerTotal = totalPayout - reinsurerAmount;

      const leaderATA = await getAssociatedTokenAddress(CURRENCY_MINT, wallet.publicKey);
      const ixs = [];

      // reinsurer pool 충전 (USDC)
      ixs.push(createTransferInstruction(
        leaderATA, masterData.reinsurerPoolWallet, wallet.publicKey, reinsurerAmount,
      ));

      // 각 참여사 pool 충전 (지분율 기반)
      // 필요 금액 계산:
      // - reinsurer_effective_bps = 5000 × (10000−1000) / 10000 = 4500 (45%)
      // - 최대 클레임 100 USDC 기준:
      //   - reinsurer pool: 45 USDC/건
      //   - insurer total: 55 USDC → 지분율대로 분배 (leader/partA/partB)
      // - 5건 여유분: reinsurer pool ~225 USDC, 각 insurer pool ~27.5×5 = 137.5 USDC 등

      // 클릭 시 온체인 master 데이터에서 reinsurerEffectiveBps, payoutDelay6HOrCancelled, 각 참여사 shareBps, poolWallet
      // 주소를 읽어옴
      // - 5건 × 최대 티어(100 USDC) = 500 USDC 기준으로 각 pool에 정확한 지분율대로 분배:
      //   - reinsurer pool → 45% = 225 USDC
      //   - leader pool → 55% × leader지분
      //   - partA/B pool → 55% × 각 지분
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
            {fundLoading ? 'Funding...' : 'Demo: Fund Pool (USDC)'}
          </Button>
        )}
      </CardBody>
    </Card>
  );
}

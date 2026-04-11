import { Card, CardHeader, CardTitle, CardBody, FormGroup, FormLabel, FormInput, SummaryRow, Button } from '@/components/common';
import { useProtocolStore, PARTICIPANT_COLORS, MAX_PARTICIPANTS } from '@/store/useProtocolStore';
import { useTranslation } from 'react-i18next';

export function ShareStructure() {
  const { leaderShare, setLeaderShare, participants, addParticipant, removeParticipant, updateParticipant, reinsurer, processStep } = useProtocolStore();
  const { t } = useTranslation();
  const locked = processStep >= 1;
  const total = leaderShare + participants.reduce((s, p) => s + p.share, 0);
  const valid = total === 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('share.title')}</CardTitle>
      </CardHeader>
      <CardBody>
        <div style={{ fontSize: 9, color: 'var(--sub)', marginBottom: 7 }}>
          {t('share.structure')}
        </div>
        <FormGroup>
          <FormLabel>{t('share.leaderShare')}</FormLabel>
          <FormInput
            type="number" min={1} max={100} value={leaderShare}
            onChange={e => setLeaderShare(parseInt(e.target.value) || 0)}
            readOnly={locked}
            style={{ fontFamily: "'DM Mono', monospace", opacity: locked ? 0.6 : 1 }}
          />
        </FormGroup>
        {participants.map((p, i) => (
          <FormGroup key={p.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <FormLabel style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: PARTICIPANT_COLORS[i], display: 'inline-block' }} />
                {p.name || `${t('share.participant')} ${i + 1}`} {t('share.shareLabel')}
              </FormLabel>
              {!locked && participants.length > 1 && (
                <button
                  onClick={() => removeParticipant(p.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 14, padding: '0 4px', lineHeight: 1 }}
                  title={t('share.removeParticipant')}
                >-</button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <FormInput
                placeholder={t('share.namePlaceholder')}
                value={p.name}
                onChange={e => updateParticipant(p.id, { name: e.target.value })}
                readOnly={locked}
                style={{ fontFamily: "'DM Mono', monospace", opacity: locked ? 0.6 : 1, flex: 1 }}
              />
              <FormInput
                type="number" min={0} max={100} value={p.share}
                onChange={e => updateParticipant(p.id, { share: parseInt(e.target.value) || 0 })}
                readOnly={locked}
                style={{ fontFamily: "'DM Mono', monospace", opacity: locked ? 0.6 : 1, width: 60, textAlign: 'right' }}
              />
            </div>
          </FormGroup>
        ))}
        {!locked && participants.length < MAX_PARTICIPANTS && (
          <Button variant="outline" size="sm" fullWidth onClick={addParticipant} style={{ marginBottom: 8 }}>
            + {t('share.addParticipant')}
          </Button>
        )}
        <div style={{ fontSize: 10, color: valid ? 'var(--success)' : 'var(--danger)', fontFamily: "'DM Mono', monospace", marginBottom: 6 }}>
          {t('common.total')}: {total}% {valid ? '✓' : '❌'}
        </div>
        {reinsurer.enabled && (
          <>
            <SummaryRow><span style={{ fontSize: 10, color: 'var(--sub)' }}>{t('share.reinCommRate')}</span><span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>10%</span></SummaryRow>
            <SummaryRow><span style={{ fontSize: 10, color: 'var(--sub)' }}>{t('share.cessionRate')}</span><span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{t('share.cessionValue')}</span></SummaryRow>
          </>
        )}
      </CardBody>
    </Card>
  );
}

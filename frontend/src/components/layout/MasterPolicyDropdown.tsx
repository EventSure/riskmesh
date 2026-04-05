import { useEffect } from 'react';
import styled from '@emotion/styled';
import { useTranslation } from 'react-i18next';
import { useProtocolStore } from '@/store/useProtocolStore';
import { useMasterPolicies } from '@/hooks/useMasterPolicies';
import { useProgram } from '@/hooks/useProgram';
import { MasterPolicyStatus } from '@/lib/idl/open_parametric';

const SelectBase = styled.select`
  background: ${p => p.theme.colors.card};
  border: 1px solid ${p => p.theme.colors.border};
  color: ${p => p.theme.colors.text};
  font-family: ${p => p.theme.fonts.mono};
  font-size: 10px;
  font-weight: 600;
  padding: 5px 24px 5px 9px;
  border-radius: 7px;
  outline: none;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394A3B8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  max-width: 220px;
`;

function statusLabel(status: number): string {
  if (status === MasterPolicyStatus.Active) return 'Active';
  if (status === MasterPolicyStatus.PendingConfirm) return 'Pending';
  if (status === MasterPolicyStatus.Closed) return 'Closed';
  return 'Draft';
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('ko-KR', {
    year: '2-digit', month: '2-digit', day: '2-digit',
  });
}

const ROLE_LABEL: Record<'leader' | 'partA' | 'partB' | 'rein', string> = {
  leader: '리더사',
  partA: '참여사A',
  partB: '참여사B',
  rein: '재보험사',
};

export function MasterPolicyDropdown() {
  const mode = useProtocolStore(s => s.mode);
  const masterPolicyPDA = useProtocolStore(s => s.masterPolicyPDA);
  const selectMasterPolicy = useProtocolStore(s => s.selectMasterPolicy);
  const setRole = useProtocolStore(s => s.setRole);
  const { t } = useTranslation();
  const { connected } = useProgram();
  const { policies, loading, refetch } = useMasterPolicies();

  // Sync detected role to store when selected policy changes or list updates
  useEffect(() => {
    if (!masterPolicyPDA) return;
    const found = policies.find(p => p.pda === masterPolicyPDA);
    if (found?.myRole) setRole(found.myRole);
  }, [masterPolicyPDA, policies]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch when a newly created policy isn't in the list yet
  useEffect(() => {
    if (masterPolicyPDA && !policies.some(p => p.pda === masterPolicyPDA)) {
      refetch();
    }
  }, [masterPolicyPDA]); // eslint-disable-line react-hooks/exhaustive-deps

  if (mode !== 'onchain' || !connected) return null;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pda = e.target.value || null;
    selectMasterPolicy(pda);
    if (pda) {
      const found = policies.find(p => p.pda === pda);
      if (found?.myRole) setRole(found.myRole);
    }
  };

  return (
    <SelectBase value={masterPolicyPDA ?? ''} onChange={handleChange}>
      <option value="">{t('master.newCreate')}</option>
      {loading && <option disabled>{t('master.loading')}</option>}
      {!loading && policies.length === 0 && !masterPolicyPDA && (
        <option disabled>{t('master.noPrevious')}</option>
      )}
      {policies.map(p => (
        <option key={p.pda} value={p.pda}>
          {p.pda.slice(0, 8)}... · {statusLabel(p.status)} · {p.myRole ? ROLE_LABEL[p.myRole] : ''} · {formatDate(p.coverageEndTs)}
        </option>
      ))}
      {masterPolicyPDA && !policies.some(p => p.pda === masterPolicyPDA) && (
        <option value={masterPolicyPDA}>
          {masterPolicyPDA.slice(0, 8)}... · {loading ? t('master.loading') : 'New'}
        </option>
      )}
    </SelectBase>
  );
}

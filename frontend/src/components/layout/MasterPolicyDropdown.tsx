import { useEffect } from 'react';
import styled from '@emotion/styled';
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

export function MasterPolicyDropdown() {
  const mode = useProtocolStore(s => s.mode);
  const masterPolicyPDA = useProtocolStore(s => s.masterPolicyPDA);
  const selectMasterPolicy = useProtocolStore(s => s.selectMasterPolicy);
  const { connected } = useProgram();
  const { policies, loading, refetch } = useMasterPolicies();

  // After a new master contract is created, its PDA won't be in the fetched list yet.
  // Refetch whenever masterPolicyPDA is set to a value not already in the list.
  useEffect(() => {
    if (masterPolicyPDA && !policies.some(p => p.pda === masterPolicyPDA)) {
      refetch();
    }
  }, [masterPolicyPDA]); // eslint-disable-line react-hooks/exhaustive-deps

  if (mode !== 'onchain' || !connected) return null;

  return (
    <SelectBase
      value={masterPolicyPDA ?? ''}
      onChange={e => selectMasterPolicy(e.target.value || null)}
    >
      <option value="">새 마스터계약 생성</option>
      {loading && <option disabled>조회 중...</option>}
      {!loading && policies.length === 0 && (
        <option disabled>이전 계약 없음</option>
      )}
      {policies.map(p => (
        <option key={p.pda} value={p.pda}>
          {p.pda.slice(0, 8)}... · {statusLabel(p.status)} · {formatDate(p.coverageEndTs)}
        </option>
      ))}
    </SelectBase>
  );
}

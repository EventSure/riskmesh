import styled from '@emotion/styled';
import { useTranslation } from 'react-i18next';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { BaseHeader } from './BaseHeader';
import { Mono } from '@/components/common';
import type { ParticipantInfo } from '@/hooks/useParticipantRole';

const RoleBadge = styled.div<{ roleColor: string }>`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 18px;
  border: 1px solid ${p => p.roleColor};
  background: ${p => p.roleColor}12;
  font-size: 11px;
  font-weight: 700;
  color: ${p => p.roleColor};
`;

const RoleDot = styled.div<{ color: string }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${p => p.color};
`;

const PdaBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 18px;
  border: 1px solid ${p => p.theme.colors.border};
  background: ${p => p.theme.colors.surface2};
  font-size: 11px;
  color: ${p => p.theme.colors.sub};
`;

const InfoBar = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 18px;
  margin: 0 -18px;
  border-top: 1px solid ${p => p.theme.colors.border};
`;

const SelectBase = styled.select`
  background: ${p => p.theme.colors.card};
  border: 1px solid ${p => p.theme.colors.border};
  color: ${p => p.theme.colors.text};
  font-family: ${p => p.theme.fonts.sans};
  font-size: 11px;
  font-weight: 600;
  padding: 5px 24px 5px 9px;
  border-radius: 7px;
  outline: none;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394A3B8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
`;

const WalletWrap = styled.div`
  .wallet-adapter-button {
    height: 28px !important;
    padding: 0 12px !important;
    font-size: 10px !important;
    font-weight: 700 !important;
    font-family: ${p => p.theme.fonts.mono} !important;
    border-radius: 20px !important;
    background: ${p => p.theme.colors.card} !important;
    border: 1px solid ${p => p.theme.colors.border} !important;
    color: ${p => p.theme.colors.text} !important;
    line-height: 1 !important;
    transition: all 0.2s !important;
  }
  .wallet-adapter-button:hover {
    border-color: ${p => p.theme.colors.primary} !important;
    background: rgba(153,69,255,.08) !important;
  }
  .wallet-adapter-button-trigger {
    background: rgba(153,69,255,.15) !important;
    border-color: ${p => p.theme.colors.primary} !important;
    color: ${p => p.theme.colors.primary} !important;
  }
  .wallet-adapter-button > i,
  .wallet-adapter-button > img,
  .wallet-adapter-button-start-icon {
    width: 14px !important;
    height: 14px !important;
    margin-right: 5px !important;
  }
`;

const ROLE_COLORS: Record<string, string> = {
  leader: '#9945FF',
  participant: '#22C55E',
  rein: '#38BDF8',
};

interface PortalHeaderProps {
  role: 'leader' | 'participant' | 'rein' | null;
  masterPDA: string | null;
  roles?: ParticipantInfo[];
}

export function PortalHeader({ role, masterPDA, roles }: PortalHeaderProps) {
  const { t, i18n } = useTranslation();

  const displayRoles = roles && roles.length > 0 ? roles : role ? [{ role }] : [];

  const actions = (
    <>
      <SelectBase value={i18n.language} onChange={e => i18n.changeLanguage(e.target.value)}>
        <option value="en">English</option>
        <option value="ko">한국어</option>
      </SelectBase>
      <WalletWrap>
        <WalletMultiButton />
      </WalletWrap>
    </>
  );

  const bottomBar = (
    <InfoBar>
      {displayRoles.map(r => {
        const color = r.role ? ROLE_COLORS[r.role] || '#94A3B8' : '#94A3B8';
        const label = r.role ? t(`portal.role.${r.role}`) : t('portal.noRole');
        return (
          <RoleBadge key={r.role} roleColor={color}>
            <RoleDot color={color} />
            {label}
          </RoleBadge>
        );
      })}
      {masterPDA && (
        <PdaBadge>
          <Mono style={{ fontSize: 9 }}>{masterPDA.slice(0, 8)}...{masterPDA.slice(-6)}</Mono>
        </PdaBadge>
      )}
    </InfoBar>
  );

  return <BaseHeader actions={actions} bottomBar={bottomBar} />;
}

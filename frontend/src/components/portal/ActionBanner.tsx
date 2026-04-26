import styled from '@emotion/styled';

export type BannerSeverity = 'warning' | 'danger' | 'info';

const COLORS: Record<BannerSeverity, string> = {
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#38BDF8',
};

const ICONS: Record<BannerSeverity, string> = {
  warning: '⚠',
  danger: '✕',
  info: 'ℹ',
};

const Banner = styled.div<{ severity: BannerSeverity }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: ${p => p.theme.radii.md};
  border: 1px solid ${p => COLORS[p.severity]}44;
  background: ${p => COLORS[p.severity]}10;
  margin-bottom: 10px;
`;

const Icon = styled.span`
  font-size: 14px;
  flex-shrink: 0;
`;

const TextGroup = styled.div`
  flex: 1;
`;

const Title = styled.div<{ severity: BannerSeverity }>`
  color: ${p => COLORS[p.severity]};
  font-size: 11px;
  font-weight: 700;
`;

const Desc = styled.div`
  color: ${p => p.theme.colors.sub};
  font-size: 10px;
  margin-top: 1px;
`;

const ActionBtn = styled.button<{ severity: BannerSeverity }>`
  background: ${p => COLORS[p.severity]}20;
  border: 1px solid ${p => COLORS[p.severity]}44;
  border-radius: ${p => p.theme.radii.xs};
  color: ${p => COLORS[p.severity]};
  font-size: 10px;
  font-weight: 600;
  padding: 3px 10px;
  cursor: pointer;
  white-space: nowrap;
`;

export interface ActionBannerProps {
  severity: BannerSeverity;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export function ActionBanner({ severity, title, description, action }: ActionBannerProps) {
  return (
    <Banner severity={severity}>
      <Icon>{ICONS[severity]}</Icon>
      <TextGroup>
        <Title severity={severity}>{title}</Title>
        <Desc>{description}</Desc>
      </TextGroup>
      {action && (
        <ActionBtn severity={severity} onClick={action.onClick}>
          {action.label}
        </ActionBtn>
      )}
    </Banner>
  );
}

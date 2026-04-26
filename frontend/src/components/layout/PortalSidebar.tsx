import styled from '@emotion/styled';

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
`;

const RoleBadge = styled.div<{ roleColor: string }>`
  background: ${p => p.roleColor}12;
  border: 1px solid ${p => p.roleColor}44;
  border-radius: ${p => p.theme.radii.md};
  padding: 10px;
`;

const RoleHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
`;

const RoleDot = styled.div<{ color: string }>`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: ${p => p.color};
  flex-shrink: 0;
`;

const RoleName = styled.span<{ color: string }>`
  color: ${p => p.color};
  font-size: 11px;
  font-weight: 700;
`;

const KpiItem = styled.div`
  & + & {
    margin-top: 8px;
  }
`;

const KpiLabel = styled.div`
  color: ${p => p.theme.colors.sub};
  font-size: 8px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
`;

const KpiValue = styled.div<{ color?: string }>`
  color: ${p => p.color ?? p.theme.colors.text};
  font-family: ${p => p.theme.fonts.mono};
  font-size: 15px;
  font-weight: 700;
  margin-top: 2px;
`;

const NavList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const NavItem = styled.button<{ active: boolean; roleColor: string }>`
  text-align: left;
  padding: 6px 9px;
  border-radius: ${p => p.theme.radii.sm};
  font-size: 11px;
  font-weight: ${p => (p.active ? 600 : 400)};
  color: ${p => (p.active ? p.roleColor : p.theme.colors.sub)};
  background: ${p => (p.active ? `${p.roleColor}15` : 'transparent')};
  border-left: ${p => (p.active ? `2px solid ${p.roleColor}` : '2px solid transparent')};
  border-top: none;
  border-right: none;
  border-bottom: none;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    color: ${p => p.roleColor};
    background: ${p => `${p.roleColor}10`};
  }
`;

export interface SidebarKpi {
  label: string;
  value: string;
  color?: string;
}

export interface NavTab {
  id: string;
  label: string;
}

interface PortalSidebarProps {
  roleName: string;
  roleColor: string;
  kpis: SidebarKpi[];
  tabs: NavTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

export function PortalSidebar({
  roleName,
  roleColor,
  kpis,
  tabs,
  activeTab,
  onTabChange,
}: PortalSidebarProps) {
  return (
    <Wrap>
      <RoleBadge roleColor={roleColor}>
        <RoleHeader>
          <RoleDot color={roleColor} />
          <RoleName color={roleColor}>{roleName}</RoleName>
        </RoleHeader>
        {kpis.map(kpi => (
          <KpiItem key={kpi.label}>
            <KpiLabel>{kpi.label}</KpiLabel>
            <KpiValue color={kpi.color}>{kpi.value}</KpiValue>
          </KpiItem>
        ))}
      </RoleBadge>

      <NavList>
        {tabs.map(tab => (
          <NavItem
            key={tab.id}
            active={activeTab === tab.id}
            roleColor={roleColor}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </NavItem>
        ))}
      </NavList>
    </Wrap>
  );
}

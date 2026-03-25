import React from 'react';
import styled from '@emotion/styled';
import { useTranslation } from 'react-i18next';

const TabsWrap = styled.div`
  display: flex;
  background: ${p => p.theme.colors.card2};
  border-bottom: 1px solid ${p => p.theme.colors.border};
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  position: sticky;
  top: 0;
  z-index: 100;
`;

const Tab = styled.button<{ active?: boolean }>`
  padding: 12px 20px;
  font-size: 12px;
  font-weight: 600;
  min-height: 44px;
  letter-spacing: 0.01em;
  color: ${p => (p.active ? p.theme.colors.primary : p.theme.colors.sub)};
  cursor: pointer;
  border: none;
  border-bottom: 2px solid ${p => (p.active ? p.theme.colors.primary : 'transparent')};
  background: none;
  transition: all 0.2s;
  white-space: nowrap;

  &:hover {
    color: ${p => p.theme.colors.primary};
  }

  &:focus-visible {
    outline: 2px solid ${p => p.theme.colors.primary};
    outline-offset: -2px;
  }
`;

/* ── Legacy admin tab IDs (backward compatible) ── */
export const TAB_IDS = ['tab-contract', 'tab-feed', 'tab-oracle', 'tab-settlement', 'tab-inspector'] as const;
export type TabId = (typeof TAB_IDS)[number];

/* ── Generic tab definition ── */
export interface TabDef {
  id: string;
  label: string;
}

/* ── Overload 1: generic tabs prop ── */
interface GenericTabBarProps {
  tabs: TabDef[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

/* ── Overload 2: legacy admin mode (no tabs prop) ── */
interface LegacyTabBarProps {
  tabs?: undefined;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

type TabBarProps = GenericTabBarProps | LegacyTabBarProps;

export function TabBar(props: TabBarProps) {
  const { t } = useTranslation();

  // Generic mode: use provided tabs
  if (props.tabs) {
    const tabs = props.tabs;
    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      let nextIndex: number | null = null;
      if (e.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
      if (nextIndex !== null) {
        e.preventDefault();
        const tabList = e.currentTarget.closest('[role="tablist"]');
        const tabButtons = tabList?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
        tabButtons?.[nextIndex]?.focus();
      }
    };

    return (
      <TabsWrap role="tablist">
        {tabs.map((tab, index) => (
          <Tab
            key={tab.id}
            role="tab"
            aria-selected={props.activeTab === tab.id}
            tabIndex={props.activeTab === tab.id ? 0 : -1}
            active={props.activeTab === tab.id}
            onClick={() => props.onTabChange(tab.id)}
            onKeyDown={e => handleKeyDown(e, index)}
          >
            {tab.label}
          </Tab>
        ))}
      </TabsWrap>
    );
  }

  // Legacy mode: hardcoded admin tabs
  const TAB_LABELS: Record<TabId, string> = {
    'tab-contract': t('tab.contract'),
    'tab-feed': t('tab.feed'),
    'tab-oracle': t('tab.oracle'),
    'tab-settlement': t('tab.settlement'),
    'tab-inspector': t('tab.inspector'),
  };

  return (
    <TabsWrap role="tablist">
      {TAB_IDS.map(id => (
        <Tab
          key={id}
          role="tab"
          aria-selected={props.activeTab === id}
          tabIndex={props.activeTab === id ? 0 : -1}
          active={props.activeTab === id}
          onClick={() => props.onTabChange(id)}
          data-guide={id}
        >
          {TAB_LABELS[id]}
        </Tab>
      ))}
    </TabsWrap>
  );
}

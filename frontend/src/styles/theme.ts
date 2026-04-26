const baseTheme = {
  glow: {
    primary: 'rgba(153,69,255,0.25)',
    accent: 'rgba(20,241,149,0.25)',
    danger: 'rgba(239,68,68,0.25)',
    info: 'rgba(56,189,248,0.25)',
    warning: 'rgba(245,158,11,0.25)',
  },
  glowSubtle: {
    primary: 'rgba(153,69,255,0.10)',
    accent: 'rgba(20,241,149,0.10)',
    danger: 'rgba(239,68,68,0.08)',
    info: 'rgba(56,189,248,0.10)',
    warning: 'rgba(245,158,11,0.08)',
  },
  fonts: {
    sans: "'Space Grotesk', sans-serif",
    mono: "'DM Mono', monospace",
  },
  radii: {
    xs: '4px',
    sm: '6px',
    md: '8px',
    lg: '10px',
    xl: '16px',
    full: '50%',
    pill: '20px',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '10px',
    lg: '12px',
    xl: '14px',
    xxl: '16px',
  },
  breakpoints: { sm: 640, md: 768, lg: 1024, xl: 1280 },
  mediaQueries: {
    sm: '@media (min-width: 640px)',
    md: '@media (min-width: 768px)',
    lg: '@media (min-width: 1024px)',
    xl: '@media (min-width: 1280px)',
  },
} as const;

export const darkTheme = {
  ...baseTheme,
  mode: 'dark' as const,
  colors: {
    bg: '#0B1120',
    card: '#111827',
    card2: '#0d1626',
    surface1: '#111827',
    surface2: '#1A2332',
    surface3: '#0F1A2A',
    primary: '#9945FF',
    accent: '#14F195',
    danger: '#EF4444',
    success: '#22C55E',
    warning: '#F59E0B',
    info: '#38BDF8',
    text: '#F8FAFC',
    sub: '#94A3B8',
    border: '#1F2937',
    border2: '#263045',
  },
};

export const lightTheme = {
  ...baseTheme,
  mode: 'light' as const,
  colors: {
    bg: '#F8FAFC',
    card: '#FFFFFF',
    card2: '#F1F5F9',
    surface1: '#FFFFFF',
    surface2: '#F1F5F9',
    surface3: '#E2E8F0',
    primary: '#9945FF',
    accent: '#059669',
    danger: '#DC2626',
    success: '#16A34A',
    warning: '#D97706',
    info: '#0284C7',
    text: '#0F172A',
    sub: '#64748B',
    border: '#E2E8F0',
    border2: '#CBD5E1',
  },
};

// 하위 호환: 기존 코드가 `theme`을 import하는 경우
export const theme = darkTheme;

export type Theme = {
  mode: 'dark' | 'light';
  colors: typeof darkTheme.colors;
  glow: typeof darkTheme.glow;
  glowSubtle: typeof darkTheme.glowSubtle;
  fonts: typeof darkTheme.fonts;
  radii: typeof darkTheme.radii;
  spacing: typeof darkTheme.spacing;
  breakpoints: typeof darkTheme.breakpoints;
  mediaQueries: typeof darkTheme.mediaQueries;
};

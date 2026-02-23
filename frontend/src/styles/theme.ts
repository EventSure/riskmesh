export const theme = {
  colors: {
    bg: '#0B1120',
    card: '#111827',
    card2: '#0d1626',
    primary: '#9945FF',
    accent: '#14F195',
    danger: '#EF4444',
    success: '#22C55E',
    warning: '#F59E0B',
    text: '#F8FAFC',
    sub: '#94A3B8',
    border: '#1F2937',
    border2: '#263045',
  },
  glow: {
    primary: 'rgba(153,69,255,0.25)',
    accent: 'rgba(20,241,149,0.25)',
    danger: 'rgba(239,68,68,0.25)',
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
} as const;

export type Theme = typeof theme;

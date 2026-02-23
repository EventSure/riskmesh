import styled from '@emotion/styled';

interface TagProps {
  variant?: 'primary' | 'accent' | 'warning' | 'danger' | 'subtle';
}

export const Tag = styled.span<TagProps>`
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 5px;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-family: 'DM Mono', monospace;

  ${({ variant, theme }) => variant === 'primary' && `
    background: rgba(153,69,255,.12);
    color: ${theme.colors.primary};
    border: 1px solid rgba(153,69,255,.3);
  `}

  ${({ variant, theme }) => variant === 'accent' && `
    background: rgba(20,241,149,.12);
    color: ${theme.colors.accent};
    border: 1px solid rgba(20,241,149,.3);
  `}

  ${({ variant, theme }) => variant === 'warning' && `
    background: rgba(245,158,11,.12);
    color: ${theme.colors.warning};
    border: 1px solid rgba(245,158,11,.3);
  `}

  ${({ variant, theme }) => variant === 'danger' && `
    background: rgba(239,68,68,.12);
    color: ${theme.colors.danger};
    border: 1px solid rgba(239,68,68,.3);
  `}

  ${({ variant, theme }) => variant === 'subtle' && `
    background: rgba(148,163,184,.1);
    color: ${theme.colors.sub};
    border: 1px solid rgba(148,163,184,.2);
  `}
`;

import styled from '@emotion/styled';

interface ButtonProps {
  variant?: 'primary' | 'accent' | 'outline' | 'danger' | 'warning';
  size?: 'sm' | 'md';
  fullWidth?: boolean;
}

export const Button = styled.button<ButtonProps>`
  padding: 8px 14px;
  border-radius: 8px;
  border: none;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  letter-spacing: 0.02em;
  display: inline-flex;
  align-items: center;
  gap: 6px;

  ${({ variant, theme }) => variant === 'primary' && `
    background: ${theme.colors.primary};
    color: #fff;
    box-shadow: 0 0 14px ${theme.glow.primary};
    &:hover {
      box-shadow: 0 0 24px rgba(153,69,255,.5);
      transform: translateY(-1px);
    }
  `}

  ${({ variant, theme }) => variant === 'accent' && `
    background: ${theme.colors.accent};
    color: #0B1120;
    font-weight: 700;
    &:hover {
      box-shadow: 0 0 20px ${theme.glow.accent};
      transform: translateY(-1px);
    }
  `}

  ${({ variant, theme }) => variant === 'outline' && `
    background: transparent;
    color: ${theme.colors.text};
    border: 1px solid ${theme.colors.border};
    &:hover {
      border-color: ${theme.colors.primary};
      color: ${theme.colors.primary};
    }
  `}

  ${({ variant, theme }) => variant === 'danger' && `
    background: ${theme.colors.danger};
    color: #fff;
  `}

  ${({ variant, theme }) => variant === 'warning' && `
    background: ${theme.colors.warning};
    color: #0B1120;
  `}

  ${({ size }) => size === 'sm' && `
    padding: 5px 10px;
    font-size: 11px;
    border-radius: 6px;
  `}

  ${({ fullWidth }) => fullWidth && `
    width: 100%;
    justify-content: center;
  `}

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
    transform: none !important;
    box-shadow: none !important;
  }
`;

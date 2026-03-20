import styled from '@emotion/styled';
import type { Theme } from '@/styles/theme';

type SpacingKey = keyof Theme['spacing'];

interface StackProps {
  direction?: 'row' | 'column';
  spacing?: SpacingKey;
  align?: string;
  justify?: string;
  wrap?: boolean;
}

export const Stack = styled.div<StackProps>`
  display: flex;
  flex-direction: ${p => p.direction || 'column'};
  gap: ${p => p.theme.spacing[p.spacing || 'md']};
  ${p => p.align && `align-items: ${p.align};`}
  ${p => p.justify && `justify-content: ${p.justify};`}
  ${p => p.wrap && 'flex-wrap: wrap;'}
`;

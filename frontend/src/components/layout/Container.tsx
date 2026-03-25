import styled from '@emotion/styled';

interface ContainerProps {
  maxWidth?: number;
}

export const Container = styled.div<ContainerProps>`
  width: 100%;
  max-width: ${p => p.maxWidth ? `${p.maxWidth}px` : '1280px'};
  margin: 0 auto;
  padding: 0 ${p => p.theme.spacing.xxl};
`;

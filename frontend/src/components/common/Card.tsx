import styled from '@emotion/styled';

export const Card = styled.div`
  background: ${p => p.theme.colors.card};
  border: 1px solid ${p => p.theme.colors.border};
  border-radius: 16px;
  margin-bottom: 12px;
  overflow: hidden;
`;

export const CardHeader = styled.div`
  padding: 11px 14px;
  border-bottom: 1px solid ${p => p.theme.colors.border};
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export const CardTitle = styled.span`
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: ${p => p.theme.colors.sub};
`;

export const CardBody = styled.div`
  padding: 14px;
`;

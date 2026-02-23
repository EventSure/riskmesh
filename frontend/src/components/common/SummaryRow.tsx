import styled from '@emotion/styled';

export const SummaryRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  background: ${p => p.theme.colors.card2};
  border-radius: 8px;
  margin-bottom: 5px;
  border: 1px solid ${p => p.theme.colors.border};
`;

import styled from '@emotion/styled';

const TierRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border-radius: 6px;
  margin-bottom: 4px;
  border: 1px solid ${p => p.theme.colors.border};
  background: ${p => p.theme.colors.card2};
`;

const TierLabel = styled.span`
  font-size: 10px;
  flex: 1;
`;

const TierValue = styled.span`
  font-family: ${p => p.theme.fonts.mono};
  font-size: 10px;
`;

interface TierItemProps {
  label: string;
  value: string;
  color: string;
}

export function TierItem({ label, value, color }: TierItemProps) {
  return (
    <TierRow>
      <TierLabel>{label}</TierLabel>
      <TierValue style={{ color }}>{value}</TierValue>
    </TierRow>
  );
}

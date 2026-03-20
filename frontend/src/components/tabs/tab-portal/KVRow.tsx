import styled from '@emotion/styled';
import type { ReactNode } from 'react';

const Row = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  background: ${p => p.theme.colors.surface3};
  border-radius: 8px;
  margin-bottom: 5px;
  border: 1px solid ${p => p.theme.colors.border};
`;

const Label = styled.span`
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: ${p => p.theme.colors.sub};
  font-weight: 600;
`;

const Value = styled.span`
  font-family: ${p => p.theme.fonts.mono};
  font-size: 11px;
  color: ${p => p.theme.colors.text};
`;

interface KVRowProps {
  label: string;
  value: ReactNode;
}

export function KVRow({ label, value }: KVRowProps) {
  return (
    <Row>
      <Label>{label}</Label>
      <Value>{value}</Value>
    </Row>
  );
}

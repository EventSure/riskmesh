import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';

const rowIn = keyframes`
  from { opacity: 0; transform: translateX(-5px); }
  to   { opacity: 1; transform: translateX(0); }
`;

export const DataTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 10px;

  th {
    padding: 5px 7px;
    text-align: left;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: ${p => p.theme.colors.sub};
    font-weight: 700;
    border-bottom: 1px solid ${p => p.theme.colors.border};
    white-space: nowrap;
  }

  td {
    padding: 5px 7px;
    border-bottom: 1px solid rgba(31, 41, 55, 0.4);
    font-family: ${p => p.theme.fonts.mono};
  }

  tr.nr {
    animation: ${rowIn} 0.35s ease;
  }

  tr:hover td {
    background: rgba(153, 69, 255, 0.03);
  }
`;

export const SettlementTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 10px;

  th {
    padding: 6px 8px;
    background: rgba(153, 69, 255, 0.08);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: ${p => p.theme.colors.primary};
    font-weight: 700;
    border: 1px solid rgba(153, 69, 255, 0.2);
  }

  td {
    padding: 5px 8px;
    border: 1px solid ${p => p.theme.colors.border};
    font-family: ${p => p.theme.fonts.mono};
  }

  .ttr td {
    background: rgba(20, 241, 149, 0.06);
    font-weight: 700;
    color: ${p => p.theme.colors.accent};
  }

  .trein td {
    background: rgba(56, 189, 248, 0.05);
    color: ${p => p.theme.colors.info};
  }

  th:last-child {
    background: rgba(153, 69, 255, 0.16);
    color: ${p => p.theme.colors.primary};
  }

  td:last-child {
    background: rgba(153, 69, 255, 0.06);
    font-weight: 700;
  }
`;

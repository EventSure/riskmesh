import styled from '@emotion/styled';

export const FormGroup = styled.div`
  margin-bottom: 10px;
`;

export const FormLabel = styled.label`
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: ${p => p.theme.colors.sub};
  margin-bottom: 4px;
  display: block;
`;

export const FormInput = styled.input`
  width: 100%;
  padding: 7px 10px;
  background: ${p => p.theme.colors.surface1};
  border: 1px solid ${p => p.theme.colors.border2};
  border-radius: 5px;
  color: ${p => p.theme.colors.text};
  font-family: inherit;
  font-size: 12px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;

  &:focus {
    border-color: ${p => p.theme.colors.primary};
    box-shadow: 0 0 0 2px rgba(153, 69, 255, 0.08);
  }

  &[readonly] {
    opacity: 0.5;
    cursor: default;
  }
`;

export const FormSelect = styled.select`
  width: 100%;
  padding: 7px 10px;
  background: ${p => p.theme.colors.surface1};
  border: 1px solid ${p => p.theme.colors.border2};
  border-radius: 5px;
  color: ${p => p.theme.colors.text};
  font-family: inherit;
  font-size: 12px;
  outline: none;
  transition: border-color 0.15s;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394A3B8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-color: ${p => p.theme.colors.surface1};
  padding-right: 28px;

  &:focus {
    border-color: ${p => p.theme.colors.primary};
  }
`;

export const FormRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
`;

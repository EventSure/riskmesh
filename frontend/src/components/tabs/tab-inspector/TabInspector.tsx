import styled from '@emotion/styled';
import { InspectorPanel } from './InspectorPanel';
import { AuditTrail } from './AuditTrail';

const Col = styled.div`
  overflow-y: auto;
  border-right: 1px solid ${p => p.theme.colors.border};
  padding: 12px;
  &:last-child { border-right: none; }
`;
const ColMd = styled(Col)`flex: 0 0 326px;`;
const ColLg = styled(Col)`flex: 1;`;

export function TabInspector() {
  return (
    <>
      <ColMd>
        <InspectorPanel />
      </ColMd>
      <ColLg>
        <AuditTrail />
      </ColLg>
    </>
  );
}

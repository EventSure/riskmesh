import styled from '@emotion/styled';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/common';
import { Tag } from '@/components/common';
import { SummaryRow } from '@/components/common';
import { Divider } from '@/components/common';
import { Mono } from '@/components/common';
import { FormLabel } from '@/components/common';

const ProgressLabel = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  color: ${p => p.theme.colors.sub};
  font-family: ${p => p.theme.fonts.mono};
  margin-bottom: 3px;
`;

const ProgressWrap = styled.div`
  height: 5px;
  background: ${p => p.theme.colors.card2};
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 3px;
`;

const ProgressFill = styled.div`
  height: 100%;
  border-radius: 3px;
  transition: width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
`;

export function RiskPoolAccount() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>RiskPool Account</CardTitle>
        <Tag variant="subtle">PENDING</Tag>
      </CardHeader>
      <CardBody>
        <SummaryRow>
          <FormLabel as="span">available_balance</FormLabel>
          <Mono>0</Mono>
        </SummaryRow>
        <SummaryRow>
          <FormLabel as="span">total_escrowed</FormLabel>
          <Mono>0</Mono>
        </SummaryRow>
        <SummaryRow>
          <FormLabel as="span">payout_amount</FormLabel>
          <Mono>—</Mono>
        </SummaryRow>
        <SummaryRow>
          <FormLabel as="span">total_ratio_bps</FormLabel>
          <Mono>0 / 10000</Mono>
        </SummaryRow>
        <Divider />
        <ProgressLabel>
          <span>Collateral Funded</span>
          <span>0%</span>
        </ProgressLabel>
        <ProgressWrap>
          <ProgressFill style={{ width: '0%', background: 'linear-gradient(90deg,var(--primary),var(--accent))' }} />
        </ProgressWrap>
        <div style={{ height: '130px', marginTop: '10px' }}>
          <canvas id="pieChart"></canvas>
        </div>
      </CardBody>
    </Card>
  );
}

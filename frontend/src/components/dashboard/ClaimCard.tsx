import { Card, CardHeader, CardTitle, CardBody } from '@/components/common';
import { Button } from '@/components/common';
import { Tag } from '@/components/common';
import { SummaryRow } from '@/components/common';
import { Divider } from '@/components/common';
import { Mono } from '@/components/common';
import { FormLabel } from '@/components/common';

export function ClaimCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Claim Account</CardTitle>
        <Tag variant="subtle">PENDING</Tag>
      </CardHeader>
      <CardBody>
        <SummaryRow><FormLabel as="span">oracle_value</FormLabel><Mono>— min</Mono></SummaryRow>
        <SummaryRow><FormLabel as="span">verified_at</FormLabel><Mono>—</Mono></SummaryRow>
        <SummaryRow><FormLabel as="span">approved_by</FormLabel><Mono>—</Mono></SummaryRow>
        <SummaryRow><FormLabel as="span">payout_amount</FormLabel><Mono>—</Mono></SummaryRow>
        <SummaryRow><FormLabel as="span">status</FormLabel><Mono>None</Mono></SummaryRow>
        <Divider />
        <Button variant="warning" fullWidth>approve_claim</Button>
        <Button variant="accent" fullWidth style={{ marginTop: 6 }}>settle_claim</Button>
      </CardBody>
    </Card>
  );
}

import { Card, CardHeader, CardTitle, CardBody } from '@/components/common';
import { Button } from '@/components/common';
import { Tag } from '@/components/common';
import { SummaryRow } from '@/components/common';
import { Divider } from '@/components/common';
import { Mono } from '@/components/common';
import { FormLabel } from '@/components/common';

export function PolicyDetails() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Policy Account</CardTitle>
        <Tag variant="subtle">DRAFT</Tag>
      </CardHeader>
      <CardBody>
        <SummaryRow><FormLabel as="span">policy_id</FormLabel><Mono>1001</Mono></SummaryRow>
        <SummaryRow><FormLabel as="span">flight_no</FormLabel><Mono>KE081</Mono></SummaryRow>
        <SummaryRow><FormLabel as="span">route</FormLabel><Mono>ICN-JFK</Mono></SummaryRow>
        <SummaryRow><FormLabel as="span">delay_threshold</FormLabel><Mono>120 min</Mono></SummaryRow>
        <SummaryRow><FormLabel as="span">payout_amount</FormLabel><Mono>1,000,000 USDC</Mono></SummaryRow>
        <SummaryRow><FormLabel as="span">departure_date</FormLabel><Mono>2026-03-15T10:00:00Z</Mono></SummaryRow>
        <SummaryRow><FormLabel as="span">unix_timestamp</FormLabel><Mono>1773568800</Mono></SummaryRow>
        <SummaryRow><FormLabel as="span">state</FormLabel><Mono>Draft</Mono></SummaryRow>
        <Divider />
        <Button variant="primary" fullWidth>open_underwriting</Button>
        <Button variant="accent" fullWidth style={{ marginTop: 6 }}>activate_policy</Button>
        <Button variant="outline" fullWidth style={{ marginTop: 6, fontSize: 11 }}>expire_policy</Button>
      </CardBody>
    </Card>
  );
}

import { Card, CardHeader, CardTitle, CardBody } from '@/components/common';
import { SummaryRow } from '@/components/common';
import { Mono } from '@/components/common';
import { FormLabel } from '@/components/common';

export function ExternalRefs() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>External Policyholder Refs (Off-chain)</CardTitle>
      </CardHeader>
      <CardBody>
        <div style={{ fontSize: 9, color: 'var(--sub)', marginBottom: 8 }}>SHA-256 hashes only. No PII stored on-chain.</div>
        <SummaryRow><FormLabel as="span" style={{ fontSize: 9 }}>ref_hash_1</FormLabel><Mono style={{ fontSize: 9 }}>a3f8e2...d91c</Mono></SummaryRow>
        <SummaryRow><FormLabel as="span" style={{ fontSize: 9 }}>ref_hash_2</FormLabel><Mono style={{ fontSize: 9 }}>7b14cc...f302</Mono></SummaryRow>
        <SummaryRow><FormLabel as="span" style={{ fontSize: 9 }}>ref_hash_3</FormLabel><Mono style={{ fontSize: 9 }}>c09a77...1e88</Mono></SummaryRow>
      </CardBody>
    </Card>
  );
}

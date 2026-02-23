import { Card, CardHeader, CardTitle, CardBody } from '@/components/common';
import { Button } from '@/components/common';
import { FormGroup, FormLabel, FormInput } from '@/components/common';
import { Divider } from '@/components/common';
import { Mono } from '@/components/common';

export function PolicyBuilder() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Policy Builder</CardTitle>
        <Mono style={{ fontSize: '10px', color: 'var(--sub)' }}>POL-—</Mono>
      </CardHeader>
      <CardBody>
        <FormGroup>
          <FormLabel>policy_id</FormLabel>
          <FormInput type="number" defaultValue={1001} />
        </FormGroup>
        <FormGroup>
          <FormLabel>flight_no</FormLabel>
          <FormInput type="text" defaultValue="KE081" />
        </FormGroup>
        <FormGroup>
          <FormLabel>route</FormLabel>
          <FormInput type="text" defaultValue="ICN-JFK" />
        </FormGroup>
        <FormGroup>
          <FormLabel>departure_date</FormLabel>
          <FormInput type="text" defaultValue="2026-03-15T10:00:00Z" />
        </FormGroup>
        <FormGroup>
          <FormLabel>delay_threshold</FormLabel>
          <FormInput type="number" defaultValue={120} />
        </FormGroup>
        <FormGroup>
          <FormLabel>payout_amount</FormLabel>
          <FormInput type="number" defaultValue={1000000} />
        </FormGroup>
        <FormGroup>
          <FormLabel>currency_mint</FormLabel>
          <FormInput
            type="text"
            defaultValue="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
            readOnly
            style={{ fontSize: '9px', opacity: 0.7 }}
          />
        </FormGroup>
        <FormGroup>
          <FormLabel>oracle_feed</FormLabel>
          <FormInput
            type="text"
            defaultValue="SwitchboardFeed1aFlight1ICN1JFK1KE081xxxx"
            readOnly
            style={{ fontSize: '9px', opacity: 0.7 }}
          />
        </FormGroup>
        <Divider />
        <Button variant="primary" fullWidth>📄 create_policy</Button>
      </CardBody>
    </Card>
  );
}

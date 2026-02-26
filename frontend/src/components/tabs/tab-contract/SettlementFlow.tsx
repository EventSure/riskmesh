import { Card, CardHeader, CardTitle, SettlementFlowDiagram } from '@/components/common';
import { useTranslation } from 'react-i18next';

export function SettlementFlow() {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('flow.title')}</CardTitle>
      </CardHeader>
      <SettlementFlowDiagram />
    </Card>
  );
}

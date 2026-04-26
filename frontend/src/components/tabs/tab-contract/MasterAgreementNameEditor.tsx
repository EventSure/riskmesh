import styled from '@emotion/styled';
import { useEffect, useMemo, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useTranslation } from 'react-i18next';
import { Card, CardBody, CardHeader, CardTitle, Button, FormGroup, FormInput, FormLabel, useToast } from '@/components/common';
import { useMasterAgreementAccount } from '@/hooks/useMasterAgreementAccount';
import { useMasterAgreements } from '@/hooks/useMasterAgreements';
import { useUpdateMasterAgreementName } from '@/hooks/useUpdateMasterAgreementName';
import { useProtocolStore } from '@/store/useProtocolStore';

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
`;

export function MasterAgreementNameEditor() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const masterAgreementPDA = useProtocolStore(s => s.masterAgreementPDA);
  const selectedMasterAgreementName = useProtocolStore(s => s.selectedMasterAgreementName);
  const setSelectedMasterAgreementName = useProtocolStore(s => s.setSelectedMasterAgreementName);
  const masterAgreementKey = useMemo(
    () => (masterAgreementPDA ? new PublicKey(masterAgreementPDA) : null),
    [masterAgreementPDA],
  );
  const { account, refetch: refetchAccount } = useMasterAgreementAccount(masterAgreementKey);
  const { refetch: refetchPolicies } = useMasterAgreements();
  const { updateMasterAgreementName, loading } = useUpdateMasterAgreementName();
  const [draftName, setDraftName] = useState('');

  useEffect(() => {
    setDraftName(selectedMasterAgreementName ?? account?.name ?? '');
  }, [account?.name, selectedMasterAgreementName]);

  if (!masterAgreementKey) {
    return null;
  }

  const normalizedCurrentName = selectedMasterAgreementName?.trim() || account?.name?.trim() || '';
  const normalizedDraftName = draftName.trim();

  const handleSave = async () => {
    if (!normalizedDraftName) {
      toast(t('master.nameRequired'), 'd');
      return;
    }

    const result = await updateMasterAgreementName({
      masterAgreement: masterAgreementKey,
      name: normalizedDraftName,
    });

    if (!result.success) {
      toast(result.error || 'Failed to update master agreement name', 'd');
      return;
    }

    setSelectedMasterAgreementName(normalizedDraftName);

    const refreshResults = await Promise.allSettled([refetchAccount(), refetchPolicies()]);
    const refreshFailed = refreshResults.some((refreshResult) => refreshResult.status === 'rejected');
    toast(t('master.nameSaved'), 's');
    if (refreshFailed) {
      toast(t('master.nameSavedLocalWarning'), 'w');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('master.name')}</CardTitle>
      </CardHeader>
      <CardBody>
        <FormGroup>
          <FormLabel>{t('master.name')}</FormLabel>
          <FormInput
            value={draftName}
            onChange={e => setDraftName(e.target.value)}
            placeholder={t('master.namePlaceholder')}
          />
        </FormGroup>
        <Actions>
          <Button
            type="button"
            variant="outline"
            onClick={handleSave}
            disabled={loading || !normalizedDraftName || normalizedDraftName === normalizedCurrentName}
          >
            {loading ? t('master.loading') : t('master.nameSave')}
          </Button>
        </Actions>
      </CardBody>
    </Card>
  );
}

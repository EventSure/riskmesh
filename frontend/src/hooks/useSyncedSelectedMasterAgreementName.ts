import { useEffect, useRef } from 'react';
import { useProtocolStore } from '@/store/useProtocolStore';

function normalizeName(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  return trimmed ? trimmed : null;
}

export function useSyncedSelectedMasterAgreementName(authoritativeName: string | null | undefined) {
  const selectedMasterAgreementName = useProtocolStore((state) => state.selectedMasterAgreementName);
  const setSelectedMasterAgreementName = useProtocolStore((state) => state.setSelectedMasterAgreementName);
  const normalizedAuthoritativeName = normalizeName(authoritativeName);
  const previousAuthoritativeNameRef = useRef<string | null>(normalizedAuthoritativeName);

  useEffect(() => {
    const previousAuthoritativeName = previousAuthoritativeNameRef.current;
    previousAuthoritativeNameRef.current = normalizedAuthoritativeName;

    if (!normalizedAuthoritativeName) {
      return;
    }

    if (!selectedMasterAgreementName?.trim()) {
      setSelectedMasterAgreementName(normalizedAuthoritativeName);
      return;
    }

    if (
      previousAuthoritativeName &&
      previousAuthoritativeName !== normalizedAuthoritativeName &&
      selectedMasterAgreementName.trim() !== normalizedAuthoritativeName
    ) {
      setSelectedMasterAgreementName(normalizedAuthoritativeName);
    }
  }, [normalizedAuthoritativeName, selectedMasterAgreementName, setSelectedMasterAgreementName]);
}

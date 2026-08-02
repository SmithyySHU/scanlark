import { useEffect, useState } from "react";

export function useOperationsReportDraft<T extends { updated_at?: string }>(
  value: T,
) {
  const [draft, setDraft] = useState(value);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraft(value);
    setDirty(false);
  }, [value, value.updated_at]);

  function updateDraft(patch: Partial<T>) {
    setDraft((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  }

  return { draft, dirty, setDirty, updateDraft };
}

export function useOptionalOperationsReportDraft<
  T extends { updated_at?: string },
>(value: T | undefined) {
  const [draft, setDraft] = useState<T | undefined>(value);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraft(value);
    setDirty(false);
  }, [value, value?.updated_at]);

  function updateDraft(patch: Partial<T>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
  }

  return { draft, dirty, setDirty, updateDraft };
}

export type OperationsCapabilities = {
  canAccessOperations: boolean;
  canUseOperationsEmail: boolean;
  operationsEmailEnabled: boolean;
};

export function canShowOperationsEmailNavigation(
  capabilities: OperationsCapabilities | null | undefined,
): boolean {
  return (
    capabilities?.operationsEmailEnabled === true &&
    capabilities.canUseOperationsEmail === true
  );
}

export type OperationsCapabilities = {
  canAccessOperations: boolean;
  canMutateOperations: boolean;
  canUseOperationsEmail: boolean;
  operationsEmailEnabled: boolean;
  workspaceSelectionRequired: boolean;
};

export function canShowOperationsEmailNavigation(
  capabilities: OperationsCapabilities | null | undefined,
): boolean {
  return (
    capabilities?.operationsEmailEnabled === true &&
    capabilities.canUseOperationsEmail === true
  );
}

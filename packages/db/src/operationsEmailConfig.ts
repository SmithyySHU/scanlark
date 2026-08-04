type OperationsEmailEnvironment = Record<string, string | undefined>;

export function isOperationsEmailModuleEnabled(
  env: OperationsEmailEnvironment = process.env,
): boolean {
  return env.OPERATIONS_EMAIL_MODULE_ENABLED?.trim().toLowerCase() === "true";
}

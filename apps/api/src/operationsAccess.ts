import type { NextFunction, Request, RequestHandler, Response } from "express";
import {
  getUserInternalWorkspaceMemberships,
  SCANLARK_OPERATIONS_WORKSPACE_CODE,
  type InternalWorkspaceMembershipRow,
  type InternalWorkspaceRole,
} from "../../../packages/db/src/internalWorkspaces";
import { isOperationsEmailModuleEnabled } from "../../../packages/db/src/operationsEmailConfig";
import { isAdminEmail } from "./adminAccess";
import { isInternalAdminEmail, isInternalOnlyMode } from "./internalAccess";

type Environment = Record<string, string | undefined>;

export type OperationsCapabilities = {
  canAccessOperations: boolean;
  canUseOperationsEmail: boolean;
  operationsEmailEnabled: boolean;
};

type CapabilityInputs = {
  memberships: Pick<
    InternalWorkspaceMembershipRow,
    "workspace_code" | "role" | "is_active"
  >[];
  hasExistingOperationsAdminAccess: boolean;
  internalAccessAllowed: boolean;
  operationsEmailEnabled: boolean;
};

const OPERATIONS_EMAIL_ROLES = new Set<InternalWorkspaceRole>([
  "owner",
  "operations_admin",
  "operations_member",
]);

export function deriveOperationsCapabilities({
  memberships,
  hasExistingOperationsAdminAccess,
  internalAccessAllowed,
  operationsEmailEnabled,
}: CapabilityInputs): OperationsCapabilities {
  const operationsMembership = memberships.find(
    (membership) =>
      membership.is_active &&
      membership.workspace_code === SCANLARK_OPERATIONS_WORKSPACE_CODE,
  );
  const hasOperationsMembership = operationsMembership !== undefined;
  const hasOperationsEmailRole =
    operationsMembership !== undefined &&
    OPERATIONS_EMAIL_ROLES.has(operationsMembership.role);

  return {
    canAccessOperations:
      internalAccessAllowed &&
      (hasOperationsMembership || hasExistingOperationsAdminAccess),
    canUseOperationsEmail: internalAccessAllowed && hasOperationsEmailRole,
    operationsEmailEnabled,
  };
}

export async function getOperationsCapabilities(
  user: { id: string; email: string },
  env: Environment = process.env,
): Promise<OperationsCapabilities> {
  const memberships = await getUserInternalWorkspaceMemberships(user.id);
  const internalAccessAllowed =
    !isInternalOnlyMode(env) || isInternalAdminEmail(user.email, env);

  return deriveOperationsCapabilities({
    memberships,
    hasExistingOperationsAdminAccess: isAdminEmail(user.email, env),
    internalAccessAllowed,
    operationsEmailEnabled: isOperationsEmailModuleEnabled(env),
  });
}

function sendAccessError(
  res: Response,
  status: number,
  error: string,
  message: string,
) {
  return res.status(status).json({ error, message });
}

export const requireOperationsWorkspaceMember: RequestHandler = async (
  req,
  res,
  next,
) => {
  if (!req.user) {
    sendAccessError(res, 401, "unauthorized", "Unauthorized");
    return;
  }

  try {
    const capabilities = await getOperationsCapabilities(req.user);
    req.operationsCapabilities = capabilities;
    if (!capabilities.canAccessOperations) {
      sendAccessError(
        res,
        403,
        "operations_workspace_required",
        "Operations workspace access required",
      );
      return;
    }
    next();
  } catch (error) {
    console.error("Operations workspace access check failed", error);
    sendAccessError(
      res,
      500,
      "operations_workspace_access_failed",
      "Failed to verify Operations workspace access",
    );
  }
};

type CapabilityResolver = (user: {
  id: string;
  email: string;
}) => Promise<OperationsCapabilities>;

export function createRequireOperationsEmailAccess(
  resolveCapabilities: CapabilityResolver = getOperationsCapabilities,
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      sendAccessError(res, 401, "unauthorized", "Unauthorized");
      return;
    }

    try {
      const capabilities =
        req.operationsCapabilities ?? (await resolveCapabilities(req.user));
      req.operationsCapabilities = capabilities;

      if (
        !capabilities.canAccessOperations ||
        !capabilities.canUseOperationsEmail
      ) {
        sendAccessError(
          res,
          403,
          "operations_email_access_required",
          "Operations Email access required",
        );
        return;
      }
      if (!capabilities.operationsEmailEnabled) {
        sendAccessError(res, 404, "not_found", "Not found");
        return;
      }
      next();
    } catch (error) {
      console.error("Operations Email access check failed", error);
      sendAccessError(
        res,
        500,
        "operations_email_access_failed",
        "Failed to verify Operations Email access",
      );
    }
  };
}

export const requireOperationsEmailAccess =
  createRequireOperationsEmailAccess();

import type { NextFunction, Request, RequestHandler, Response } from "express";
import {
  getInternalWorkspaceById,
  getUserInternalWorkspaceMemberships,
  type InternalWorkspaceMembershipRow,
  type InternalWorkspaceRole,
  type InternalWorkspaceRow,
} from "../../../packages/db/src/internalWorkspaces";
import { isOperationsEmailModuleEnabled } from "../../../packages/db/src/operationsEmailConfig";
import { isInternalAdminEmail, isInternalOnlyMode } from "./internalAccess";

type Environment = Record<string, string | undefined>;

export type OperationsCapabilities = {
  canAccessOperations: boolean;
  canMutateOperations: boolean;
  canUseOperationsEmail: boolean;
  operationsEmailEnabled: boolean;
  workspaceSelectionRequired: boolean;
};

export type OperationsRequestContext = {
  actor: { id: string; email: string };
  workspace: InternalWorkspaceRow;
  membership: InternalWorkspaceMembershipRow;
  role: InternalWorkspaceRole;
  canReadOperations: true;
  canMutateOperations: boolean;
  canUseOperationsEmail: boolean;
  operationsEmailEnabled: boolean;
  canManageMembers: boolean;
};

type CapabilityInputs = {
  memberships: Pick<
    InternalWorkspaceMembershipRow,
    "workspace_id" | "role" | "is_active"
  >[];
  internalAccessAllowed: boolean;
  operationsEmailEnabled: boolean;
};

const OPERATIONS_WRITE_ROLES = new Set<InternalWorkspaceRole>([
  "owner",
  "operations_admin",
  "operations_member",
]);

export function deriveOperationsCapabilities({
  memberships,
  internalAccessAllowed,
  operationsEmailEnabled,
}: CapabilityInputs): OperationsCapabilities {
  const activeMemberships = memberships.filter(
    (membership) => membership.is_active,
  );
  const membership =
    activeMemberships.length === 1 ? activeMemberships[0] : null;
  const canMutate =
    membership !== null && OPERATIONS_WRITE_ROLES.has(membership.role);

  return {
    canAccessOperations: internalAccessAllowed && membership !== null,
    canMutateOperations: internalAccessAllowed && canMutate,
    canUseOperationsEmail: internalAccessAllowed && canMutate,
    operationsEmailEnabled,
    workspaceSelectionRequired:
      internalAccessAllowed && activeMemberships.length > 1,
  };
}

async function resolveOperationsAccess(
  user: { id: string; email: string },
  env: Environment = process.env,
) {
  const memberships = await getUserInternalWorkspaceMemberships(user.id);
  const internalAccessAllowed =
    !isInternalOnlyMode(env) || isInternalAdminEmail(user.email, env);
  const operationsEmailEnabled = isOperationsEmailModuleEnabled(env);
  const capabilities = deriveOperationsCapabilities({
    memberships,
    internalAccessAllowed,
    operationsEmailEnabled,
  });
  const activeMemberships = memberships.filter(
    (membership) => membership.is_active,
  );
  return {
    memberships,
    activeMemberships,
    capabilities,
    internalAccessAllowed,
  };
}

export async function getOperationsCapabilities(
  user: { id: string; email: string },
  env: Environment = process.env,
): Promise<OperationsCapabilities> {
  return (await resolveOperationsAccess(user, env)).capabilities;
}

function sendAccessError(
  res: Response,
  status: number,
  error: string,
  message: string,
) {
  return res.status(status).json({ error, message });
}

function hasClientWorkspaceSelection(req: Request) {
  const body =
    req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? (req.body as Record<string, unknown>)
      : null;
  return (
    req.get("x-operations-workspace-id") !== undefined ||
    body?.workspaceId !== undefined ||
    body?.internalWorkspaceId !== undefined ||
    body?.internal_workspace_id !== undefined
  );
}

export const requireOperationsContext: RequestHandler = async (
  req,
  res,
  next,
) => {
  if (!req.user) {
    sendAccessError(res, 401, "unauthorized", "Unauthorized");
    return;
  }
  if (hasClientWorkspaceSelection(req)) {
    sendAccessError(
      res,
      400,
      "workspace_is_server_resolved",
      "Operations workspace is resolved by the server",
    );
    return;
  }

  try {
    const resolution = await resolveOperationsAccess(req.user);
    req.operationsCapabilities = resolution.capabilities;
    if (
      !resolution.internalAccessAllowed ||
      resolution.activeMemberships.length === 0
    ) {
      sendAccessError(
        res,
        403,
        "operations_workspace_required",
        "Operations workspace access required",
      );
      return;
    }
    if (resolution.activeMemberships.length > 1) {
      sendAccessError(
        res,
        409,
        "operations_workspace_selection_required",
        "Resolve multiple active Operations workspace memberships before continuing",
      );
      return;
    }

    const membership = resolution.activeMemberships[0];
    const workspace = await getInternalWorkspaceById(membership.workspace_id);
    if (!workspace) {
      sendAccessError(
        res,
        403,
        "operations_workspace_required",
        "Operations workspace access required",
      );
      return;
    }
    req.operationsContext = {
      actor: { id: req.user.id, email: req.user.email },
      workspace,
      membership,
      role: membership.role,
      canReadOperations: true,
      canMutateOperations: resolution.capabilities.canMutateOperations,
      canUseOperationsEmail: resolution.capabilities.canUseOperationsEmail,
      operationsEmailEnabled: resolution.capabilities.operationsEmailEnabled,
      canManageMembers: membership.role === "owner",
    };
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

export const requireOperationsMutation: RequestHandler = (req, res, next) => {
  if (!req.operationsContext?.canMutateOperations) {
    sendAccessError(
      res,
      403,
      "operations_write_required",
      "Your Operations access is read-only.",
    );
    return;
  }
  next();
};

export const requireOperationsOwner: RequestHandler = (req, res, next) => {
  if (!req.operationsContext?.canManageMembers) {
    sendAccessError(
      res,
      403,
      "operations_workspace_owner_required",
      "Operations workspace owner access required",
    );
    return;
  }
  next();
};

export const requireOperationsWorkspaceMember = requireOperationsContext;

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
        req.operationsContext !== undefined
          ? req.operationsCapabilities!
          : (req.operationsCapabilities ??
            (await resolveCapabilities(req.user)));
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

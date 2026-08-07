import "express-serve-static-core";
import type { IronSession } from "iron-session";
import type {
  OperationsCapabilities,
  OperationsRequestContext,
} from "./operationsAccess";

declare module "express-serve-static-core" {
  interface Request {
    session: IronSession<{ userId?: string }>;
    user?: {
      id: string;
      email: string;
      displayName?: string | null;
      name?: string;
      isAdmin?: boolean;
      isInternalAdmin?: boolean;
    };
    operationsCapabilities?: OperationsCapabilities;
    operationsContext?: OperationsRequestContext;
  }
}

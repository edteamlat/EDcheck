import { EDcheckConfigError } from "../../errors/edcheck-config-error.ts";

export function missingPeerError(packageName: string): EDcheckConfigError {
  return new EDcheckConfigError(
    `Missing optional peer dependency "${packageName}". Install with: yarn add ai @ai-sdk/gateway`,
    "missing_peer_dependency",
  );
}

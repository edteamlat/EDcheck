import type * as Gateway from "@ai-sdk/gateway";

export type GatewaySdkModule = {
  createGateway: typeof Gateway.createGateway;
};

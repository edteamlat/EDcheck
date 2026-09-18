import { Experimental_EvaluationMockModelV4 } from "ai/test";

type EvaluateCall = Parameters<Experimental_EvaluationMockModelV4["doEvaluate"]>[0];

export function gatewayMockModel(
  doEvaluate: (call: EvaluateCall) => Promise<Record<string, unknown>>,
  options: {
    modelId?: string;
    supportedQuestionTypes?: Array<"choice" | "score" | "boolean">;
  } = {},
): Experimental_EvaluationMockModelV4 {
  return new Experimental_EvaluationMockModelV4({
    modelId: options.modelId ?? "typesafe-ai/jev",
    ...(options.supportedQuestionTypes === undefined
      ? {}
      : { supportedQuestionTypes: options.supportedQuestionTypes }),
    doEvaluate: async (call) => {
      const result = await doEvaluate(call);
      return { warnings: [], ...result } as unknown as Awaited<
        ReturnType<Experimental_EvaluationMockModelV4["doEvaluate"]>
      >;
    },
  });
}

import {
  createEDcheck,
  type ProviderErrorEvent,
  type ProviderResponseEvent,
  type SemanticAnswer,
} from "edcheck";

import type { RunCasesInput } from "./types/run-cases-input.ts";
import type { Observation } from "./types/observation.ts";

function concurrencyOf(input: RunCasesInput): number {
  if (input.concurrency !== undefined) {
    return input.concurrency;
  }
  const raw = process.env.EDCHECK_EVAL_CONCURRENCY;
  const parsed = raw === undefined ? Number.NaN : Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 4;
}

function argmaxLevel(
  probabilities: readonly number[],
  levels: readonly string[],
): string | undefined {
  let best = 0;
  let highest = Number.NEGATIVE_INFINITY;
  for (const [index, probability] of probabilities.entries()) {
    if (probability !== undefined && probability > highest) {
      highest = probability;
      best = index;
    }
  }
  return levels[best];
}

function fromAnswer(
  answer: SemanticAnswer | undefined,
  levels: readonly string[] | undefined,
): Pick<Observation, "probability" | "level" | "score" | "confidence"> {
  if (answer === undefined) {
    return {};
  }
  if (answer.type === "noul") {
    return { probability: answer.noul };
  }
  const level = levels === undefined ? undefined : argmaxLevel(answer.probabilities, levels);
  return {
    score: answer.score,
    confidence: answer.confidence,
    ...(level === undefined ? {} : { level }),
  };
}

function errorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return undefined;
}

async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      const item = items[index];
      if (item === undefined) {
        return;
      }
      results[index] = await mapper(item, index);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function runCases(input: RunCasesInput): Promise<Observation[]> {
  const timeoutMs = input.timeoutMs ?? 15_000;
  return mapLimit(input.file.cases, concurrencyOf(input), async (item) => {
    let response: ProviderResponseEvent | undefined;
    let errorEvent: ProviderErrorEvent | undefined;
    const started = Date.now();
    const bound = input.binding.define(
      createEDcheck({
        provider: input.provider,
        timeoutMs,
        hooks: {
          onResponse: (event) => {
            response = event;
          },
          onError: (event) => {
            errorEvent = event;
          },
        },
      }),
    );
    try {
      const result = await bound.safeParse(input.binding.toInput(item.value), { timeoutMs });
      const answer = response?.response.answers[input.binding.ruleId];
      const measured = fromAnswer(answer, input.binding.levels);
      const unavailable = result.issues.find((issue) => issue.code === "semantic_unavailable");
      const error = errorCode(errorEvent?.error) ?? unavailable?.code;
      const observation: Observation = {
        rule: input.binding.rule,
        language: input.file.language,
        id: item.id,
        expect: item.expect,
        model: response?.response.model ?? "unknown",
        durationMs: response?.durationMs ?? Date.now() - started,
        ...measured,
        ...(error === undefined ? {} : { error }),
      };
      return observation;
    } catch (caught) {
      const code =
        typeof caught === "object" && caught !== null && "code" in caught
          ? String((caught as { code: unknown }).code)
          : "unknown";
      return {
        rule: input.binding.rule,
        language: input.file.language,
        id: item.id,
        expect: item.expect,
        model: "unknown",
        durationMs: Date.now() - started,
        error: code,
      };
    }
  });
}

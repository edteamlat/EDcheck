import { getAtPath } from "../shared/get-at-path.ts";
import { isPathPrefix } from "../shared/is-path-prefix.ts";

import type { BoundCrossField } from "./types/bound-cross-field.ts";

export type ExecutableCrossField = BoundCrossField & { values: unknown[] };

export function collectExecutableCrossFields(
  bindings: readonly BoundCrossField[],
  input: unknown,
  parsedData: unknown,
  shapeSuccess: boolean,
  invalidPrefixes: ReadonlyArray<ReadonlyArray<string | number>>,
): ExecutableCrossField[] {
  const executable: ExecutableCrossField[] = [];
  for (const bound of bindings) {
    if (
      invalidPrefixes.some((prefix) =>
        bound.paths.some((path) => isPathPrefix(prefix, path)),
      )
    ) {
      continue;
    }
    const values = readDeclaredValues(bound, input, parsedData, shapeSuccess);
    if (values === undefined) {
      continue;
    }
    executable.push({ ...bound, values });
  }
  return executable;
}

function readDeclaredValues(
  bound: BoundCrossField,
  input: unknown,
  parsedData: unknown,
  shapeSuccess: boolean,
): unknown[] | undefined {
  const values: unknown[] = [];
  for (const [index, path] of bound.paths.entries()) {
    const node = bound.nodes[index];
    if (node === undefined) {
      return undefined;
    }
    const value = shapeSuccess
      ? getAtPath(parsedData, path)
      : readNodeValue(node, getAtPath(input, path));
    if (value === undefined || value === null) {
      return undefined;
    }
    values.push(value);
  }
  return values;
}

function readNodeValue(node: BoundCrossField["nodes"][number], raw: unknown): unknown {
  const parsed = node.safeParse(raw);
  if (!parsed.success) {
    return undefined;
  }
  return parsed.data;
}

function nonEmpty(value: string | undefined): boolean {
  return value !== undefined && value.trim().length > 0;
}

export function hasEvalKey(env: NodeJS.ProcessEnv = process.env): boolean {
  return nonEmpty(env.TYPESAFE_API_KEY) || nonEmpty(env.AI_GATEWAY_API_KEY);
}

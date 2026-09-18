export function shouldRetry(status: number): boolean {
  return status === 429 || status === 529;
}

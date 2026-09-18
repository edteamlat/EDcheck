export function isReservedPath(path: readonly string[]): boolean {
  return path[0] === "context";
}

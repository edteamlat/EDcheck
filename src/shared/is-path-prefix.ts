export function isPathPrefix(
  prefix: ReadonlyArray<string | number>,
  path: ReadonlyArray<string | number>,
): boolean {
  if (prefix.length === 0) {
    return true;
  }
  if (prefix.length > path.length) {
    return false;
  }
  return prefix.every((segment, index) => segment === path[index]);
}

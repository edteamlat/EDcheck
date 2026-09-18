export function parsePath(dottedPath: string): string[] {
  if (dottedPath === "") {
    return [];
  }
  return dottedPath.split(".");
}

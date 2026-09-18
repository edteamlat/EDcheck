export function formatPathList(paths: readonly string[]): string {
  const quoted = paths.map((path) => `\`${path}\``);
  if (quoted.length === 0) {
    return "";
  }
  if (quoted.length === 1) {
    return quoted[0] ?? "";
  }
  const last = quoted[quoted.length - 1] ?? "";
  if (quoted.length === 2) {
    return `${quoted[0]} and ${last}`;
  }
  return `${quoted.slice(0, -1).join(", ")} and ${last}`;
}

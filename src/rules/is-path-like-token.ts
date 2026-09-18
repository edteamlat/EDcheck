const PATH_LIKE = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/;

export function isPathLikeToken(token: string): boolean {
  return PATH_LIKE.test(token);
}

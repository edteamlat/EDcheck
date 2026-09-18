type UnwrapNullish<T> = Exclude<T, null | undefined>;

export type PathValue<T, P extends string> = P extends `${infer Head}.${infer Rest}`
  ? Head extends keyof UnwrapNullish<T>
    ? PathValue<UnwrapNullish<T>[Head], Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never;

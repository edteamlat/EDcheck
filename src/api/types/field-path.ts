type PrimitiveLeaf = string | number | boolean | bigint | symbol;
type UnwrapNullish<T> = Exclude<T, null | undefined>;
type Prev = [never, 0, 1, 2, 3, 4, 5, 6];

export type FieldPath<T> = FieldSegments<UnwrapNullish<T>, "", 6>;

type FieldSegments<T, Prefix extends string, Depth extends number> = Depth extends never
  ? never
  : T extends readonly unknown[]
    ? never
    : T extends Date
      ? never
      : T extends PrimitiveLeaf
        ? Prefix extends ""
          ? never
          : Prefix
        : T extends object
          ? {
              [K in keyof T & string]: FieldSegments<
                UnwrapNullish<T[K]>,
                Prefix extends "" ? K : `${Prefix}.${K}`,
                Prev[Depth]
              >;
            }[keyof T & string]
          : never;

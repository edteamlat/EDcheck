type PrimitiveLeaf = string | number | boolean | bigint | symbol;
type UnwrapNullish<T> = Exclude<T, null | undefined>;
type Prev = [never, 0, 1, 2, 3, 4, 5, 6];
type IsArray<T> = [T] extends [readonly unknown[]] ? true : false;

export type NodePath<T> = NodeSegments<UnwrapNullish<T>, "", 6>;

type NodeSegments<T, Prefix extends string, Depth extends number> = Depth extends never
  ? never
  : IsArray<T> extends true
    ? never
    : T extends Date
      ? never
      : T extends PrimitiveLeaf
        ? Prefix extends ""
          ? never
          : Prefix
        : T extends object
          ? ObjectNodePaths<T, Prefix, Depth>
          : never;

type ObjectNodePaths<T, Prefix extends string, Depth extends number> =
  | (Prefix extends "" ? never : Prefix)
  | (MappedNodeChildren<T, Prefix, Depth>[keyof MappedNodeChildren<T, Prefix, Depth>]);

type MappedNodeChildren<T, Prefix extends string, Depth extends number> = {
  [K in Extract<keyof T, string> as IsArray<UnwrapNullish<T[K]>> extends true ? never : K]: NodeSegments<
    UnwrapNullish<T[K]>,
    Prefix extends "" ? K : `${Prefix}.${K}`,
    Prev[Depth]
  >;
};

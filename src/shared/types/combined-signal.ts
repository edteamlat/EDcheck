export type CombinedSignal = {
  signal: AbortSignal;
  dispose: () => void;
};

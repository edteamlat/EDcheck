export type Calibration =
  | {
      readonly separable: true;
      readonly pass: number;
      readonly fail: number;
      readonly negativeMax: number;
      readonly positiveMin: number;
      readonly narrowGap: boolean;
      readonly positiveDecisiveRate: number;
      readonly negativeDecisiveRate: number;
      readonly ambiguousInWarningRate: number;
    }
  | {
      readonly separable: false;
      readonly overlapping: readonly string[];
      readonly negativeMax: number;
      readonly positiveMin: number;
    };

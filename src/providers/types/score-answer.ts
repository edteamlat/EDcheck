export type ScoreAnswer = {
  type: "score";
  score: number;
  probabilities: readonly number[];
  confidence: number;
};

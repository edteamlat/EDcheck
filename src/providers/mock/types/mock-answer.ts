export type MockScoreAnswer = {
  probabilities: readonly number[];
  confidence?: number;
};

export type MockAnswer = number | MockScoreAnswer;

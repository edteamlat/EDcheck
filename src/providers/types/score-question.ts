export type ScoreQuestion = {
  type: "score";
  instructions: string;
  criteria: readonly string[];
};

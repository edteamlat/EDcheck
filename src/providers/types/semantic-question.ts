export type SemanticQuestion = {
  type: "noul";
  instructions: string;
  criteria?: {
    true?: string;
    false?: string;
  };
};

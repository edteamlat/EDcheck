export type NoulQuestion = {
  type: "noul";
  instructions: string;
  criteria?: {
    true?: string;
    false?: string;
  };
};

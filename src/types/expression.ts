export type ExpressionCategory = 'Daily' | 'Business' | 'Travel' | 'Developer' | 'OPIc';

export type EnglishExpression = {
  id: number;
  sentence: string;
  meaning: string;
  keyword: string;
  keywordMeaning: string;
  example: string;
  exampleMeaning: string;
  level: 'A2' | 'B1' | 'B2' | 'C1';
  category: ExpressionCategory;
};

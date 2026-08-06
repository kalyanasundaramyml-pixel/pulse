import { BlockType, QuestionType } from './api';

export type DraftQuestionType = Exclude<QuestionType, 'SINGLE_CHOICE'>; // 'RATING' | 'TEXT' | 'MULTI_CHOICE'

export interface DraftQuestion {
  clientId: string; // stable React key + "is this new" marker; never sent to the backend
  id?: string; // present once persisted
  questionType: DraftQuestionType;
  prompt: string;
  isRequired: boolean;
  ratingScaleMin?: number;
  ratingScaleMax?: number;
  maxChoices?: number;
  options?: string[];
}

export interface DraftBlock {
  clientId: string;
  id?: string;
  blockType: BlockType;
  name?: string;
  title?: string;
  body?: string;
  questions: DraftQuestion[];
}

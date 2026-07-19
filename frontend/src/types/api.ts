export type UserRole = 'ADMIN' | 'LEADER' | 'USER';
export type SurveyStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED';
export type QuestionType = 'RATING' | 'TEXT' | 'SINGLE_CHOICE' | 'MULTI_CHOICE';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  mustChangePassword: boolean;
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface DirectoryUser {
  id: string;
  name: string;
  email: string;
}

export interface ImportResult {
  batchId: string;
  totalRows: number;
  successCount: number;
  errorCount: number;
  createdUsers: { name: string; email: string; role: UserRole; tempPassword: string }[];
  errors: { row: number; email?: string; message: string }[];
}

export interface QuestionOption {
  id: string;
  label: string;
}

export interface Question {
  id: string;
  questionType: QuestionType;
  prompt: string;
  isRequired: boolean;
  ratingScaleMin: number | null;
  ratingScaleMax: number | null;
  options: QuestionOption[];
}

export interface Survey {
  id: string;
  title: string;
  description: string | null;
  isAnonymous: boolean;
  status: SurveyStatus;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  closedAt: string | null;
  endDate: string | null;
  isTemplate: boolean;
  isPublic: boolean;
  createdBy?: { id: string; name: string };
}

export interface SurveyDetail extends Survey {
  questions: Question[];
  recipients: { user: DirectoryUser }[];
}

export interface AnswerInput {
  questionId: string;
  ratingValue?: number;
  textValue?: string;
  selectedOptionIds?: string[];
  commentText?: string;
}

export interface TakeSurveyResponse {
  survey: {
    id: string;
    title: string;
    description: string | null;
    isAnonymous: boolean;
    status: SurveyStatus;
  };
  questions: Question[];
  alreadyResponded: boolean;
  myResponse: {
    answers: AnswerInput[];
    submittedAt: string;
    updatedAt: string;
  } | null;
}

interface WithheldSummary {
  withheld: true;
  responseCount: number;
  minRequired: number;
}
interface RatingSummary {
  withheld: false;
  average: number;
  distribution: Record<number, number>;
  comments: string[];
}
interface ChoiceSummary {
  withheld: false;
  tally: Record<string, number>;
  comments: string[];
}
interface TextSummary {
  withheld: false;
  responses: string[];
}

export interface QuestionSummary {
  questionId: string;
  prompt: string;
  type: QuestionType;
  summary: WithheldSummary | RatingSummary | ChoiceSummary | TextSummary;
  options?: QuestionOption[];
}

export interface AnonymousDashboardDTO {
  survey: { id: string; title: string; isAnonymous: true; status: SurveyStatus };
  completion: { targetCount: number; respondedCount: number; rate: number };
  questions: QuestionSummary[];
}

export interface AttributedDashboardDTO {
  survey: { id: string; title: string; isAnonymous: false; status: SurveyStatus };
  completion: { targetCount: number; respondedCount: number; rate: number };
  questions: QuestionSummary[];
  respondents: { userId: string; name: string; email: string; submittedAt: string; updatedAt: string }[];
}

export type DashboardDTO = AnonymousDashboardDTO | AttributedDashboardDTO;

export interface GroupSummary {
  id: string;
  name: string;
  memberCount: number;
  createdAt: string;
}

export interface GroupDetail {
  id: string;
  name: string;
  members: DirectoryUser[];
}

export type OneOnOneRunStatus = 'PENDING' | 'COMPLETED';

export interface OneOnOneTemplate {
  id: string;
  title: string;
  description: string | null;
  createdById: string;
  isArchived: boolean;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name: string };
}

export interface OneOnOneTemplateDetail extends OneOnOneTemplate {
  questions: Question[];
  recipients: { user: DirectoryUser; runCount: number }[];
}

export interface OneOnOneRun {
  id: string;
  templateId?: string;
  status: OneOnOneRunStatus;
  createdAt: string;
  submittedAt: string | null;
  respondentUser?: DirectoryUser;
  template?: { id: string; title: string; description: string | null };
}

export interface TakeOneOnOneResponse {
  run: { id: string; status: OneOnOneRunStatus; createdAt: string; submittedAt: string | null };
  template: { id: string; title: string; description: string | null };
  questions: Question[];
  answers: AnswerInput[] | null;
}

interface TrendRatingPoint {
  runId: string;
  submittedAt: string;
  value: number | null;
  comment: string | null;
}
interface TrendChoicePoint {
  runId: string;
  submittedAt: string;
  selectedLabels: string[];
  comment: string | null;
}
interface TrendTextPoint {
  runId: string;
  submittedAt: string;
  text: string | null;
}

export interface TrendQuestionSeries {
  questionId: string;
  prompt: string;
  type: QuestionType;
  points: TrendRatingPoint[] | TrendChoicePoint[] | TrendTextPoint[];
}

export interface OneOnOneTrendResponse {
  template: { id: string };
  runCount: number;
  questions: TrendQuestionSeries[];
}

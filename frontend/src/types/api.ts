export type MemberRole = 'ADMIN' | 'CREATOR' | 'AUDITOR' | 'MEMBER';
export type SurveyStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED';
export type OneOnOneStatus = 'DRAFT' | 'PUBLISHED';
export type QuestionType = 'RATING' | 'TEXT' | 'SINGLE_CHOICE' | 'MULTI_CHOICE';
export type BlockType = 'WELCOME' | 'QUESTIONS' | 'END';

export interface PublicMember {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  mustChangePassword: boolean;
}

export interface AdminMemberRow {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  group: { id: string; name: string };
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  isDefault: boolean;
  memberCount: number;
  createdAt: string;
}

export interface DirectoryMember {
  id: string;
  name: string;
  email: string;
}

export interface ImportResult {
  batchId: string;
  totalRows: number;
  successCount: number;
  errorCount: number;
  createdMembers: { name: string; email: string; role: MemberRole; tempPassword: string }[];
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
  maxChoices: number;
  options: QuestionOption[];
}

export interface Block {
  id: string;
  position: number;
  blockType: BlockType;
  name: string | null;
  title: string | null;
  body: string | null;
  questions: Question[];
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
  _count?: { questions: number; recipients: number; responseAccess: number; attributedResponses: number };
  // Only present for scope='targeted' — whether the current member has already responded.
  hasResponded?: boolean;
}

export interface SurveyDetail extends Survey {
  blocks: Block[];
  recipients: { member: DirectoryMember; resubmitAllowed: boolean }[];
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
  blocks: Block[];
  alreadyResponded: boolean;
  canResubmit: boolean;
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
  respondents: { memberId: string; name: string; email: string; submittedAt: string; updatedAt: string }[];
}

export type DashboardDTO = AnonymousDashboardDTO | AttributedDashboardDTO;

export interface CircleSummary {
  id: string;
  name: string;
  memberCount: number;
  createdAt: string;
}

export interface CircleDetail {
  id: string;
  name: string;
  members: DirectoryMember[];
}

export type OneOnOneRunStatus = 'PENDING' | 'COMPLETED';

export interface OneOnOneTemplate {
  id: string;
  title: string;
  description: string | null;
  createdById: string;
  isArchived: boolean;
  isPublic: boolean;
  isTemplate: boolean;
  status: OneOnOneStatus;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name: string };
}

export interface OneOnOneTemplateDetail extends OneOnOneTemplate {
  blocks: Block[];
  recipients: { member: DirectoryMember; runCount: number }[];
}

export interface OneOnOneRun {
  id: string;
  templateId?: string;
  status: OneOnOneRunStatus;
  createdAt: string;
  submittedAt: string | null;
  respondentMember?: DirectoryMember;
  template?: { id: string; title: string; description: string | null };
}

export interface TakeOneOnOneResponse {
  run: { id: string; status: OneOnOneRunStatus; createdAt: string; submittedAt: string | null };
  template: { id: string; title: string; description: string | null };
  blocks: Block[];
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
  ratingScaleMin?: number | null;
  ratingScaleMax?: number | null;
  points: TrendRatingPoint[] | TrendChoicePoint[] | TrendTextPoint[];
}

export interface OneOnOneTrendResponse {
  template: { id: string; title: string };
  recipient: { id: string; name: string };
  runCount: number;
  questions: TrendQuestionSeries[];
}

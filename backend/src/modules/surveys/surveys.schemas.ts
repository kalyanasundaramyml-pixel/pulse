import { z } from 'zod';
import { QuestionType } from '@prisma/client';

// Accepts either a plain YYYY-MM-DD (native <input type="date">) or a full
// ISO datetime string; new Date(...) in the service layer parses either.
const dateString = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date');

export const createSurveySchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(2000).optional(),
  isAnonymous: z.boolean(),
  endDate: dateString.nullable().optional(),
  isTemplate: z.boolean().optional(),
});

export const updateSurveySchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().max(2000).optional(),
  isAnonymous: z.boolean().optional(),
  endDate: dateString.nullable().optional(),
  isPublic: z.boolean().optional(),
});

export const reopenSurveySchema = z.object({
  endDate: dateString.nullable().optional(),
});

export const duplicateSurveySchema = z.object({
  asTemplate: z.boolean().default(false),
});

export const listSurveysQuerySchema = z.object({
  scope: z.enum(['created', 'targeted', 'all', 'public']).default('created'),
  status: z.enum(['DRAFT', 'PUBLISHED', 'CLOSED']).optional(),
});

export const createBlockSchema = z.object({
  name: z.string().trim().min(1).max(200),
});

export const updateBlockSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().trim().max(4000).optional(),
});

export const reorderBlocksSchema = z.object({
  blockIds: z.array(z.string().uuid()).min(1),
});

const questionBaseSchema = z.object({
  questionType: z.nativeEnum(QuestionType),
  prompt: z.string().trim().min(1).max(1000),
  isRequired: z.boolean().default(true),
  ratingScaleMin: z.number().int().optional(),
  ratingScaleMax: z.number().int().optional(),
  options: z.array(z.string().trim().min(1).max(300)).optional(),
});

export const createQuestionSchema = questionBaseSchema.superRefine((data, ctx) => {
  if (data.questionType === 'RATING') {
    if (data.ratingScaleMin == null || data.ratingScaleMax == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'RATING questions require ratingScaleMin and ratingScaleMax' });
    } else if (data.ratingScaleMin >= data.ratingScaleMax) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'ratingScaleMin must be less than ratingScaleMax' });
    }
  }
  if (data.questionType === 'SINGLE_CHOICE' || data.questionType === 'MULTI_CHOICE') {
    if (!data.options || data.options.length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Choice questions require at least 2 options' });
    }
  }
});

export const updateQuestionSchema = questionBaseSchema.partial();

export const reorderQuestionsSchema = z.object({
  questionIds: z.array(z.string().uuid()).min(1),
});

export const setRecipientsSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1),
});

export const addRecipientsSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1),
});

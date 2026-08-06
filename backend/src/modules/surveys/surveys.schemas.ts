import { z } from 'zod';

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
  scope: z.enum(['created', 'targeted', 'all', 'public', 'audit', 'viewing']).default('created'),
  status: z.enum(['DRAFT', 'PUBLISHED', 'CLOSED']).optional(),
});

export const grantViewerSchema = z.object({
  memberId: z.string().uuid(),
});

const draftQuestionSchema = z
  .object({
    id: z.string().uuid().optional(),
    questionType: z.enum(['RATING', 'TEXT', 'MULTI_CHOICE']),
    prompt: z.string().trim().min(1).max(1000),
    isRequired: z.boolean().default(true),
    ratingScaleMin: z.number().int().optional(),
    ratingScaleMax: z.number().int().optional(),
    maxChoices: z.number().int().min(1).optional(),
    options: z.array(z.string().trim().min(1).max(300)).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.questionType === 'RATING') {
      if (data.ratingScaleMin == null || data.ratingScaleMax == null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'RATING questions require ratingScaleMin and ratingScaleMax' });
      } else if (data.ratingScaleMin >= data.ratingScaleMax) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'ratingScaleMin must be less than ratingScaleMax' });
      }
    }
    if (data.questionType === 'MULTI_CHOICE') {
      if (!data.options || data.options.length < 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Choice questions require at least 2 options' });
      } else {
        const maxChoices = data.maxChoices ?? 1;
        if (maxChoices < 1 || maxChoices > data.options.length) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'maxChoices must be between 1 and the number of options' });
        }
      }
    }
  });

const draftBlockSchema = z.object({
  id: z.string().uuid().optional(),
  blockType: z.enum(['WELCOME', 'QUESTIONS', 'END']),
  name: z.string().trim().max(200).optional(),
  title: z.string().trim().max(200).optional(),
  body: z.string().trim().max(4000).optional(),
  questions: z.array(draftQuestionSchema).default([]),
});

export const saveDraftSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(2000).optional(),
  isAnonymous: z.boolean().optional(),
  endDate: dateString.nullable().optional(),
  blocks: z.array(draftBlockSchema).min(2),
});

export const setRecipientsSchema = z.object({
  memberIds: z.array(z.string().uuid()).min(1),
});

export const addRecipientsSchema = z.object({
  memberIds: z.array(z.string().uuid()).min(1),
});

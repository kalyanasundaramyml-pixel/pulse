import { z } from 'zod';

export const createTemplateSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(2000).optional(),
  isTemplate: z.boolean().optional(),
});

export const updateTemplateSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().max(2000).optional(),
  isArchived: z.boolean().optional(),
  isPublic: z.boolean().optional(),
});

export const listTemplatesQuerySchema = z.object({
  scope: z.enum(['created', 'all', 'public', 'audit']).default('created'),
});

export const duplicateTemplateSchema = z.object({
  asTemplate: z.boolean().default(false),
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
  blocks: z.array(draftBlockSchema).min(2),
});

export const setRecipientsSchema = z.object({
  memberIds: z.array(z.string().uuid()).min(1),
});

export const addRecipientsSchema = z.object({
  memberIds: z.array(z.string().uuid()).min(1),
});

export const startRunSchema = z.object({
  recipientMemberId: z.string().uuid(),
});

export const answerSchema = z.object({
  questionId: z.string().uuid(),
  ratingValue: z.number().int().nullable().optional(),
  textValue: z.string().trim().max(5000).nullable().optional(),
  selectedOptionIds: z.array(z.string().uuid()).optional(),
  commentText: z.string().trim().max(2000).nullable().optional(),
});

export const submitRunSchema = z.object({
  answers: z.array(answerSchema),
});

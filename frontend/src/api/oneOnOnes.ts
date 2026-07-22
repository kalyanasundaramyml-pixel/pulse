import { apiClient } from './client';
import {
  AnswerInput,
  Block,
  OneOnOneRun,
  OneOnOneTemplate,
  OneOnOneTemplateDetail,
  OneOnOneTrendResponse,
  Question,
  TakeOneOnOneResponse,
} from '../types/api';
import { QuestionInput } from './surveys';

export const oneOnOnesApi = {
  create: (input: { title: string; description?: string }) =>
    apiClient.post<{ template: OneOnOneTemplate }>('/one-on-ones', input),
  list: (scope: 'created' | 'all' | 'public' = 'created') =>
    apiClient.get<{ templates: OneOnOneTemplate[] }>(`/one-on-ones?scope=${scope}`),
  get: (id: string) => apiClient.get<{ template: OneOnOneTemplateDetail }>(`/one-on-ones/${id}`),
  update: (id: string, input: Partial<{ title: string; description: string; isArchived: boolean; isPublic: boolean }>) =>
    apiClient.patch<{ template: OneOnOneTemplate }>(`/one-on-ones/${id}`, input),
  remove: (id: string) => apiClient.delete<void>(`/one-on-ones/${id}`),
  duplicateTemplate: (id: string, asTemplate = false) =>
    apiClient.post<{ template: OneOnOneTemplate }>(`/one-on-ones/${id}/duplicate`, { asTemplate }),
  publish: (id: string) => apiClient.post<{ template: OneOnOneTemplate }>(`/one-on-ones/${id}/publish`),
  unpublish: (id: string) => apiClient.post<{ template: OneOnOneTemplate }>(`/one-on-ones/${id}/unpublish`),

  addBlock: (templateId: string, name: string) =>
    apiClient.post<{ block: Block }>(`/one-on-ones/${templateId}/blocks`, { name }),
  updateBlock: (templateId: string, blockId: string, input: { name?: string; title?: string; body?: string }) =>
    apiClient.patch<{ block: Block }>(`/one-on-ones/${templateId}/blocks/${blockId}`, input),
  deleteBlock: (templateId: string, blockId: string) =>
    apiClient.delete<void>(`/one-on-ones/${templateId}/blocks/${blockId}`),
  reorderBlocks: (templateId: string, blockIds: string[]) =>
    apiClient.put<void>(`/one-on-ones/${templateId}/blocks/reorder`, { blockIds }),

  addQuestion: (templateId: string, blockId: string, input: QuestionInput) =>
    apiClient.post<{ question: Question }>(`/one-on-ones/${templateId}/blocks/${blockId}/questions`, input),
  updateQuestion: (templateId: string, blockId: string, questionId: string, input: Partial<QuestionInput>) =>
    apiClient.patch<{ question: Question }>(`/one-on-ones/${templateId}/blocks/${blockId}/questions/${questionId}`, input),
  deleteQuestion: (templateId: string, blockId: string, questionId: string) =>
    apiClient.delete<void>(`/one-on-ones/${templateId}/blocks/${blockId}/questions/${questionId}`),
  reorderQuestions: (templateId: string, blockId: string, questionIds: string[]) =>
    apiClient.put<void>(`/one-on-ones/${templateId}/blocks/${blockId}/questions/reorder`, { questionIds }),

  setRecipients: (templateId: string, userIds: string[]) =>
    apiClient.put<void>(`/one-on-ones/${templateId}/recipients`, { userIds }),

  startRun: (templateId: string, recipientUserId: string) =>
    apiClient.post<{ run: OneOnOneRun }>(`/one-on-ones/${templateId}/runs`, { recipientUserId }),
  listRuns: (templateId: string, recipientUserId?: string) => {
    const qs = recipientUserId ? `?recipientUserId=${recipientUserId}` : '';
    return apiClient.get<{ runs: OneOnOneRun[] }>(`/one-on-ones/${templateId}/runs${qs}`);
  },
  getTrend: (templateId: string, userId: string) =>
    apiClient.get<OneOnOneTrendResponse>(`/one-on-ones/${templateId}/trend/${userId}`),

  myRuns: () => apiClient.get<{ runs: OneOnOneRun[] }>('/one-on-ones/runs/mine'),
  takeRun: (runId: string) => apiClient.get<TakeOneOnOneResponse>(`/one-on-ones/runs/${runId}/take`),
  submitRun: (runId: string, answers: AnswerInput[]) =>
    apiClient.post<{ runId: string }>(`/one-on-ones/runs/${runId}/responses`, { answers }),
};

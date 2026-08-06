import { apiClient } from './client';
import {
  AnswerInput,
  OneOnOneRun,
  OneOnOneTemplate,
  OneOnOneTemplateDetail,
  OneOnOneTrendResponse,
  TakeOneOnOneResponse,
} from '../types/api';
import { blocksToPayload } from '../lib/draft';

export const oneOnOnesApi = {
  create: (input: { title: string; description?: string; isTemplate?: boolean }) =>
    apiClient.post<{ template: OneOnOneTemplate }>('/one-on-ones', input),
  list: (scope: 'created' | 'all' | 'public' | 'audit' = 'created') =>
    apiClient.get<{ templates: OneOnOneTemplate[] }>(`/one-on-ones?scope=${scope}`),
  get: (id: string) => apiClient.get<{ template: OneOnOneTemplateDetail }>(`/one-on-ones/${id}`),
  update: (id: string, input: Partial<{ title: string; description: string; isArchived: boolean; isPublic: boolean }>) =>
    apiClient.patch<{ template: OneOnOneTemplate }>(`/one-on-ones/${id}`, input),
  remove: (id: string) => apiClient.delete<void>(`/one-on-ones/${id}`),
  duplicateTemplate: (id: string, asTemplate = false) =>
    apiClient.post<{ template: OneOnOneTemplate }>(`/one-on-ones/${id}/duplicate`, { asTemplate }),
  publish: (id: string) => apiClient.post<{ template: OneOnOneTemplate }>(`/one-on-ones/${id}/publish`),
  unpublish: (id: string) => apiClient.post<{ template: OneOnOneTemplate }>(`/one-on-ones/${id}/unpublish`),

  saveDraft: (
    id: string,
    input: { title: string; description?: string; blocks: ReturnType<typeof blocksToPayload> },
  ) => apiClient.put<{ template: OneOnOneTemplateDetail }>(`/one-on-ones/${id}/draft`, input),

  setRecipients: (templateId: string, memberIds: string[]) =>
    apiClient.put<void>(`/one-on-ones/${templateId}/recipients`, { memberIds }),

  startRun: (templateId: string, recipientMemberId: string) =>
    apiClient.post<{ run: OneOnOneRun }>(`/one-on-ones/${templateId}/runs`, { recipientMemberId }),
  listRuns: (templateId: string, recipientMemberId?: string) => {
    const qs = recipientMemberId ? `?recipientMemberId=${recipientMemberId}` : '';
    return apiClient.get<{ runs: OneOnOneRun[] }>(`/one-on-ones/${templateId}/runs${qs}`);
  },
  getTrend: (templateId: string, memberId: string) =>
    apiClient.get<OneOnOneTrendResponse>(`/one-on-ones/${templateId}/trend/${memberId}`),

  myRuns: () => apiClient.get<{ runs: OneOnOneRun[] }>('/one-on-ones/runs/mine'),
  takeRun: (runId: string) => apiClient.get<TakeOneOnOneResponse>(`/one-on-ones/runs/${runId}/take`),
  submitRun: (runId: string, answers: AnswerInput[]) =>
    apiClient.post<{ runId: string }>(`/one-on-ones/runs/${runId}/responses`, { answers }),
};

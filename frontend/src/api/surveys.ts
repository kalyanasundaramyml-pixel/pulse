import { apiClient } from './client';
import { Block, DirectoryMember, Question, QuestionType, Survey, SurveyDetail, SurveyStatus } from '../types/api';

export interface QuestionInput {
  questionType: QuestionType;
  prompt: string;
  isRequired: boolean;
  ratingScaleMin?: number;
  ratingScaleMax?: number;
  options?: string[];
}

export const surveysApi = {
  create: (input: {
    title: string;
    description?: string;
    isAnonymous: boolean;
    endDate?: string | null;
    isTemplate?: boolean;
  }) => apiClient.post<{ survey: Survey }>('/surveys', input),
  list: (scope: 'created' | 'targeted' | 'all' | 'public' | 'audit' | 'viewing', status?: SurveyStatus) => {
    const qs = new URLSearchParams({ scope });
    if (status) qs.set('status', status);
    return apiClient.get<{ surveys: Survey[] }>(`/surveys?${qs.toString()}`);
  },
  get: (id: string) => apiClient.get<{ survey: SurveyDetail }>(`/surveys/${id}`),
  update: (
    id: string,
    input: Partial<{ title: string; description: string; isAnonymous: boolean; endDate: string | null; isPublic: boolean }>,
  ) => apiClient.patch<{ survey: Survey }>(`/surveys/${id}`, input),
  remove: (id: string) => apiClient.delete<void>(`/surveys/${id}`),
  publish: (id: string) => apiClient.post<{ survey: Survey }>(`/surveys/${id}/publish`),
  close: (id: string) => apiClient.post<{ survey: Survey }>(`/surveys/${id}/close`),
  unpublish: (id: string) => apiClient.post<{ survey: Survey }>(`/surveys/${id}/unpublish`),
  reopen: (id: string, endDate?: string | null) =>
    apiClient.post<{ survey: Survey }>(`/surveys/${id}/reopen`, { endDate }),
  duplicate: (id: string, asTemplate = false) =>
    apiClient.post<{ survey: Survey }>(`/surveys/${id}/duplicate`, { asTemplate }),

  addBlock: (surveyId: string, name: string) =>
    apiClient.post<{ block: Block }>(`/surveys/${surveyId}/blocks`, { name }),
  updateBlock: (surveyId: string, blockId: string, input: { name?: string; title?: string; body?: string }) =>
    apiClient.patch<{ block: Block }>(`/surveys/${surveyId}/blocks/${blockId}`, input),
  deleteBlock: (surveyId: string, blockId: string) =>
    apiClient.delete<void>(`/surveys/${surveyId}/blocks/${blockId}`),
  reorderBlocks: (surveyId: string, blockIds: string[]) =>
    apiClient.put<void>(`/surveys/${surveyId}/blocks/reorder`, { blockIds }),

  addQuestion: (surveyId: string, blockId: string, input: QuestionInput) =>
    apiClient.post<{ question: Question }>(`/surveys/${surveyId}/blocks/${blockId}/questions`, input),
  updateQuestion: (surveyId: string, blockId: string, questionId: string, input: Partial<QuestionInput>) =>
    apiClient.patch<{ question: Question }>(`/surveys/${surveyId}/blocks/${blockId}/questions/${questionId}`, input),
  deleteQuestion: (surveyId: string, blockId: string, questionId: string) =>
    apiClient.delete<void>(`/surveys/${surveyId}/blocks/${blockId}/questions/${questionId}`),
  reorderQuestions: (surveyId: string, blockId: string, questionIds: string[]) =>
    apiClient.put<void>(`/surveys/${surveyId}/blocks/${blockId}/questions/reorder`, { questionIds }),

  setRecipients: (surveyId: string, memberIds: string[]) =>
    apiClient.put<{ protectedMemberIds: string[]; message: string } | undefined>(
      `/surveys/${surveyId}/recipients`,
      { memberIds },
    ),
  addRecipients: (surveyId: string, memberIds: string[]) =>
    apiClient.post<void>(`/surveys/${surveyId}/recipients`, { memberIds }),
  removeRecipient: (surveyId: string, memberId: string) =>
    apiClient.delete<void>(`/surveys/${surveyId}/recipients/${memberId}`),
  reopenForRecipient: (surveyId: string, memberId: string) =>
    apiClient.post<void>(`/surveys/${surveyId}/recipients/${memberId}/reopen`),

  listViewers: (surveyId: string) => apiClient.get<{ viewers: DirectoryMember[] }>(`/surveys/${surveyId}/viewers`),
  grantViewer: (surveyId: string, memberId: string) =>
    apiClient.post<void>(`/surveys/${surveyId}/viewers`, { memberId }),
  revokeViewer: (surveyId: string, memberId: string) =>
    apiClient.delete<void>(`/surveys/${surveyId}/viewers/${memberId}`),
};

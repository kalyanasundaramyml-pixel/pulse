import { apiClient } from './client';
import { Question, QuestionType, Survey, SurveyDetail, SurveyStatus } from '../types/api';

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
  list: (scope: 'created' | 'targeted' | 'all' | 'public', status?: SurveyStatus) => {
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

  addQuestion: (surveyId: string, input: QuestionInput) =>
    apiClient.post<{ question: Question }>(`/surveys/${surveyId}/questions`, input),
  updateQuestion: (surveyId: string, questionId: string, input: Partial<QuestionInput>) =>
    apiClient.patch<{ question: Question }>(`/surveys/${surveyId}/questions/${questionId}`, input),
  deleteQuestion: (surveyId: string, questionId: string) =>
    apiClient.delete<void>(`/surveys/${surveyId}/questions/${questionId}`),
  reorderQuestions: (surveyId: string, questionIds: string[]) =>
    apiClient.put<void>(`/surveys/${surveyId}/questions/reorder`, { questionIds }),

  setRecipients: (surveyId: string, userIds: string[]) =>
    apiClient.put<{ protectedUserIds: string[]; message: string } | undefined>(
      `/surveys/${surveyId}/recipients`,
      { userIds },
    ),
  addRecipients: (surveyId: string, userIds: string[]) =>
    apiClient.post<void>(`/surveys/${surveyId}/recipients`, { userIds }),
  removeRecipient: (surveyId: string, userId: string) =>
    apiClient.delete<void>(`/surveys/${surveyId}/recipients/${userId}`),
};

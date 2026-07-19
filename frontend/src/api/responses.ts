import { apiClient } from './client';
import { AnswerInput, TakeSurveyResponse } from '../types/api';

export const responsesApi = {
  take: (surveyId: string) => apiClient.get<TakeSurveyResponse>(`/surveys/${surveyId}/take`),
  submit: (surveyId: string, answers: AnswerInput[]) =>
    apiClient.post<{ responseId: string }>(`/surveys/${surveyId}/responses`, { answers }),
  edit: (surveyId: string, answers: AnswerInput[]) =>
    apiClient.patch<{ responseId: string }>(`/surveys/${surveyId}/responses/me`, { answers }),
  getMine: (surveyId: string) =>
    apiClient.get<{ answers: AnswerInput[]; submittedAt: string; updatedAt: string }>(
      `/surveys/${surveyId}/responses/me`,
    ),
};

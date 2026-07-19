import { apiClient } from './client';
import { DashboardDTO } from '../types/api';

export const dashboardApi = {
  get: (surveyId: string) => apiClient.get<DashboardDTO>(`/surveys/${surveyId}/dashboard`),
};

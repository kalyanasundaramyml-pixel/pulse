import { apiClient } from './client';
import { DirectoryMember, Survey, SurveyDetail, SurveyStatus } from '../types/api';
import { blocksToPayload } from '../lib/draft';

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

  saveDraft: (
    id: string,
    input: {
      title: string;
      description?: string;
      isAnonymous?: boolean;
      endDate?: string | null;
      blocks: ReturnType<typeof blocksToPayload>;
    },
  ) => apiClient.put<{ survey: SurveyDetail }>(`/surveys/${id}/draft`, input),

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

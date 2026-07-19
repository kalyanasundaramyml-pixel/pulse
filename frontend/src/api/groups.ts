import { apiClient } from './client';
import { GroupDetail, GroupSummary } from '../types/api';

export const groupsApi = {
  list: () => apiClient.get<{ groups: GroupSummary[] }>('/groups'),
  get: (id: string) => apiClient.get<{ group: GroupDetail }>(`/groups/${id}`),
  create: (input: { name: string; userIds: string[] }) =>
    apiClient.post<{ group: GroupDetail }>('/groups', input),
  update: (id: string, input: { name?: string; userIds?: string[] }) =>
    apiClient.patch<{ group: GroupDetail }>(`/groups/${id}`, input),
  remove: (id: string) => apiClient.delete<void>(`/groups/${id}`),
};

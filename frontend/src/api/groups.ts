import { apiClient } from './client';
import { Group } from '../types/api';

export const groupsApi = {
  list: () => apiClient.get<{ groups: Group[] }>('/admin/groups'),
  create: (name: string) => apiClient.post<{ group: Group }>('/admin/groups', { name }),
  rename: (id: string, name: string) => apiClient.patch<{ group: Group }>(`/admin/groups/${id}`, { name }),
  remove: (id: string) => apiClient.delete<void>(`/admin/groups/${id}`),
};

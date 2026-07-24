import { apiClient } from './client';
import { CircleDetail, CircleSummary } from '../types/api';

export const circlesApi = {
  list: () => apiClient.get<{ circles: CircleSummary[] }>('/circles'),
  get: (id: string) => apiClient.get<{ circle: CircleDetail }>(`/circles/${id}`),
  create: (input: { name: string; memberIds: string[] }) =>
    apiClient.post<{ circle: CircleDetail }>('/circles', input),
  update: (id: string, input: { name?: string; memberIds?: string[] }) =>
    apiClient.patch<{ circle: CircleDetail }>(`/circles/${id}`, input),
  remove: (id: string) => apiClient.delete<void>(`/circles/${id}`),
};

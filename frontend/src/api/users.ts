import { apiClient } from './client';
import { AdminUserRow, DirectoryUser, ImportResult, UserRole } from '../types/api';

export const usersApi = {
  list: (params: { search?: string; role?: UserRole; page?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.role) qs.set('role', params.role);
    if (params.page) qs.set('page', String(params.page));
    return apiClient.get<{ total: number; page: number; pageSize: number; users: AdminUserRow[] }>(
      `/admin/users?${qs.toString()}`,
    );
  },
  create: (input: { name: string; email: string; role: UserRole }) =>
    apiClient.post<{ user: AdminUserRow; tempPassword: string }>('/admin/users', input),
  update: (id: string, input: { role?: UserRole; isActive?: boolean }) =>
    apiClient.patch<{ user: AdminUserRow }>(`/admin/users/${id}`, input),
  resetPassword: (id: string) => apiClient.post<{ tempPassword: string }>(`/admin/users/${id}/reset-password`),
  importCsv: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.postForm<ImportResult>('/admin/users/import', formData);
  },
  directory: (search?: string) => {
    const qs = new URLSearchParams();
    if (search) qs.set('search', search);
    return apiClient.get<{ total: number; users: DirectoryUser[] }>(`/users/directory?${qs.toString()}`);
  },
};

import { apiClient } from './client';
import { AdminMemberRow, DirectoryMember, ImportResult, MemberRole } from '../types/api';

export const membersApi = {
  list: (params: { search?: string; role?: MemberRole; groupId?: string; page?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.role) qs.set('role', params.role);
    if (params.groupId) qs.set('groupId', params.groupId);
    if (params.page) qs.set('page', String(params.page));
    return apiClient.get<{ total: number; page: number; pageSize: number; members: AdminMemberRow[] }>(
      `/admin/members?${qs.toString()}`,
    );
  },
  create: (input: { name: string; email: string; role: MemberRole; groupId?: string }) =>
    apiClient.post<{ member: AdminMemberRow; tempPassword: string }>('/admin/members', input),
  update: (id: string, input: { role?: MemberRole; groupId?: string; isActive?: boolean }) =>
    apiClient.patch<{ member: AdminMemberRow }>(`/admin/members/${id}`, input),
  resetPassword: (id: string) => apiClient.post<{ tempPassword: string }>(`/admin/members/${id}/reset-password`),
  importCsv: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.postForm<ImportResult>('/admin/members/import', formData);
  },
  directory: (search?: string) => {
    const qs = new URLSearchParams();
    if (search) qs.set('search', search);
    return apiClient.get<{ total: number; members: DirectoryMember[] }>(`/members/directory?${qs.toString()}`);
  },
};

import { apiClient } from './client';
import { PublicMember } from '../types/api';

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<{ member: PublicMember }>('/auth/login', { email, password }),
  logout: () => apiClient.post<void>('/auth/logout'),
  me: () => apiClient.get<{ member: PublicMember }>('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.post<void>('/auth/change-password', { currentPassword, newPassword }),
};

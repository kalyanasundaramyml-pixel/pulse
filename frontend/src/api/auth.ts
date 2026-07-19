import { apiClient } from './client';
import { PublicUser } from '../types/api';

export const authApi = {
  login: (email: string, password: string) => apiClient.post<{ user: PublicUser }>('/auth/login', { email, password }),
  logout: () => apiClient.post<void>('/auth/logout'),
  me: () => apiClient.get<{ user: PublicUser }>('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.post<void>('/auth/change-password', { currentPassword, newPassword }),
};

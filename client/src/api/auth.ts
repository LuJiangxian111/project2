import request from './request';

export interface LoginParams {
  username: string;
  password: string;
}

export interface RegisterParams {
  username: string;
  password: string;
  name?: string;
  email?: string;
}

export const login = (data: LoginParams) => request.post('/auth/login', data);
export const register = (data: RegisterParams) => request.post('/auth/register', data);
export const getProfile = () => request.get('/auth/profile');
export const updateProfile = (id: number, data: any) => request.put(`/users/${id}`, data);
export const changePassword = (id: number, data: { oldPassword: string; newPassword: string }) =>
  request.put(`/users/${id}/password`, data);
export const uploadAvatar = (id: number, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return request.post(`/users/${id}/avatar`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

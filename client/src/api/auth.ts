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

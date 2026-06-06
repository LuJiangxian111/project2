import axios from 'axios';
import { message } from 'antd';
import { useUserStore } from '../stores/user';

const request = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

request.interceptors.request.use((config) => {
  const token = useUserStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

request.interceptors.response.use(
  (response) => {
    const res = response.data;
    if (res.code !== undefined && res.code !== 0) {
      message.error(res.message || '请求失败');
      if (res.code === 401) {
        useUserStore.getState().logout();
        window.location.href = '/login';
      }
      return Promise.reject(new Error(res.message || '请求失败'));
    }
    return res;
  },
  (error) => {
    if (error.response?.status === 401) {
      useUserStore.getState().logout();
      window.location.href = '/login';
    } else {
      message.error(error.response?.data?.message || error.message || '网络错误');
    }
    return Promise.reject(error);
  },
);

export default request;

import request from './request';

export const getNotices = (userId?: number) =>
  request.get('/notices', { params: userId ? { userId } : {} });

export const createNotice = (data: { title: string; content: string }) =>
  request.post('/notices', data);

export const updateNotice = (id: number, data: Partial<any>) =>
  request.put(`/notices/${id}`, data);

export const deleteNotice = (id: number) => request.delete(`/notices/${id}`);

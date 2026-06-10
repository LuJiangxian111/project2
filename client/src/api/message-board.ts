import request from './request';

export const getMessages = () => request.get('/message-board');

export const createMessage = (data: { nickname?: string; content: string; parentId?: number }) =>
  request.post('/message-board', data);

export const deleteMessage = (id: number) => request.delete(`/message-board/${id}`);

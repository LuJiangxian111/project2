import request from './request';

export const getMyGroups = () => request.get('/discussion');
export const getGroupByProject = (projectId: number) => request.get(`/discussion/project/${projectId}`);
export const getMessages = (groupId: number, params?: { limit?: number; before?: number }) =>
  request.get(`/discussion/${groupId}/messages`, { params });
export const sendMessage = (groupId: number, data: {
  content: string;
  mentionIds?: number[];
  referenceType?: string;
  referenceId?: number;
  referenceData?: any;
}) => request.post(`/discussion/${groupId}/messages`, data);
export const addMember = (groupId: number, userId: number) =>
  request.post(`/discussion/${groupId}/members`, { userId });
export const removeMember = (groupId: number, userId: number) =>
  request.delete(`/discussion/${groupId}/members/${userId}`);
export const getMembers = (groupId: number) =>
  request.get(`/discussion/${groupId}/members`);

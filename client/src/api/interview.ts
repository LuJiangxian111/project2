import request from './request';

export interface Interview {
  id: number;
  candidatePositionId: number;
  round: number;
  interviewerId?: number;
  interviewType: string;
  meetingLink?: string;
  scheduledAt?: string;
  result?: string;
  feedback?: string;
  score?: number;
  aiQuestions?: string;
  createdAt?: string;
  candidatePosition?: any;
  interviewer?: any;
}

export const getInterviews = (params?: { result?: string; projectId?: number; candidatePositionId?: number }) =>
  request.get('/interviews', { params });
export const createInterview = (data: Partial<Interview>) => request.post('/interviews', data);
export const updateInterview = (id: number, data: Partial<Interview>) => request.put(`/interviews/${id}`, data);
export const generateQuestions = (id: number) => request.post(`/interviews/${id}/generate-questions`);

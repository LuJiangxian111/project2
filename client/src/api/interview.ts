import request from './request';

export interface Interview {
  id: number;
  candidateId: number;
  candidateName?: string;
  positionId: number;
  positionTitle?: string;
  round: number;
  interviewer?: string;
  scheduledAt?: string;
  result?: string;
  feedback?: string;
  questions?: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateInterviewParams {
  candidateId: number;
  positionId: number;
  round?: number;
  interviewer?: string;
  scheduledAt?: string;
  status?: string;
}

export const getInterviews = (params?: { status?: string; startDate?: string; endDate?: string }) =>
  request.get('/interviews', { params });
export const createInterview = (data: CreateInterviewParams) => request.post('/interviews', data);
export const updateInterview = (id: number, data: Partial<CreateInterviewParams & { result?: string; feedback?: string }>) =>
  request.put(`/interviews/${id}`, data);
export const generateQuestions = (id: number) => request.post(`/interviews/${id}/generate-questions`);

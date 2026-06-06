import request from './request';

export interface Position {
  id: number;
  title: string;
  projectId: number;
  projectName?: string;
  description?: string;
  requirements?: string;
  salaryMin?: number;
  salaryMax?: number;
  location?: string;
  urgency: string;
  headcount: number;
  hiredCount: number;
  expectedDate?: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePositionParams {
  title: string;
  projectId: number;
  description?: string;
  requirements?: string;
  salaryMin?: number;
  salaryMax?: number;
  location?: string;
  urgency?: string;
  headcount?: number;
  expectedDate?: string;
  status?: string;
}

export interface PositionQuery {
  keyword?: string;
  projectId?: number;
  urgency?: string;
  status?: string;
}

export const getPositions = (params?: PositionQuery) => request.get('/positions', { params });
export const createPosition = (data: CreatePositionParams) => request.post('/positions', data);
export const getPosition = (id: number) => request.get(`/positions/${id}`);
export const updatePosition = (id: number, data: Partial<CreatePositionParams>) => request.put(`/positions/${id}`, data);
export const deletePosition = (id: number) => request.delete(`/positions/${id}`);
export const addCandidateToPosition = (positionId: number, data: { candidateId: number }) =>
  request.post(`/positions/${positionId}/candidates`, data);
export const getPositionCandidates = (positionId: number) => request.get(`/positions/${positionId}/candidates`);

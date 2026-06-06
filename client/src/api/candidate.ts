import request from './request';

export interface Candidate {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  source?: string;
  yearsOfExperience?: number;
  currentCompany?: string;
  skills?: string;
  resumeUrl?: string;
  positionCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCandidateParams {
  name: string;
  phone?: string;
  email?: string;
  source?: string;
  yearsOfExperience?: number;
  currentCompany?: string;
  skills?: string;
  resumeUrl?: string;
}

export const getCandidates = () => request.get('/candidates');
export const createCandidate = (data: CreateCandidateParams) => request.post('/candidates', data);
export const getCandidate = (id: number) => request.get(`/candidates/${id}`);
export const updateCandidate = (id: number, data: Partial<CreateCandidateParams>) => request.put(`/candidates/${id}`, data);
export const deleteCandidate = (id: number) => request.delete(`/candidates/${id}`);
export const matchCandidate = (candidateId: number, positionId: number) =>
  request.post(`/candidates/${candidateId}/match/${positionId}`);

import request from './request';

export interface Candidate {
  id: number;
  name: string;
  idType?: string;
  idNumber?: string;
  gender?: string;
  contactPhone?: string;
  contactEmail?: string;
  areaCode?: string;
  educationType?: string;
  education?: string;
  graduationDate?: string;
  domainYears?: number;
  workStatus?: string;
  expectedSalary?: string;
  supplier?: string;
  resumeUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCandidateParams {
  name: string;
  idType?: string;
  idNumber?: string;
  gender?: string;
  contactPhone?: string;
  contactEmail?: string;
  areaCode?: string;
  educationType?: string;
  education?: string;
  graduationDate?: string;
  domainYears?: number;
  workStatus?: string;
  expectedSalary?: string;
  supplier?: string;
  resumeUrl?: string;
  recommender?: string;
  recommendReason?: string;
}

export const getCandidates = () => request.get('/candidates');
export const getCandidatesGrouped = (params?: { keyword?: string; projectId?: number; positionId?: number; status?: string }) =>
  request.get('/candidates/grouped', { params });
export const createCandidate = (data: CreateCandidateParams) => request.post('/candidates', data);
export const getCandidate = (id: number) => request.get(`/candidates/${id}`);
export const updateCandidate = (id: number, data: Partial<CreateCandidateParams>) => request.put(`/candidates/${id}`, data);
export const deleteCandidate = (id: number) => request.delete(`/candidates/${id}`);
export const matchCandidate = (candidateId: number, positionId: number) =>
  request.post(`/candidates/${candidateId}/match/${positionId}`);
export const updateCandidatePositionStatus = (cpId: number, status: string) =>
  request.put(`/positions/candidate-position/${cpId}/status`, { status });

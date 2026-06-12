import request from './request';

export interface Position {
  id: number;
  systemName: string;
  department: string;
  requirementNumber: string;
  positionType: string;
  positionDuty: string;
  techDomain: string;
  majorType: string;
  levelDistribution: string;
  salaryRange?: string;
  requirements: string;
  responsibilities: string;
  domainExperience: string;
  region: string;
  deliveryForm: string;
  positionImplementation?: string;
  projectId: number;
  projectName?: string;
  urgency: string;
  requiredCount: number;
  hiredCount: number;
  recommendedCount?: number;
  gapCount?: number;
  expectedDate?: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePositionParams {
  systemName: string;
  department: string;
  requirementNumber: string;
  positionType: string;
  positionDuty: string;
  techDomain: string;
  majorType: string;
  levelDistribution: string;
  salaryRange?: string;
  requirements: string;
  responsibilities: string;
  domainExperience: string;
  region: string;
  deliveryForm: string;
  positionImplementation?: string;
  projectId: number;
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
export const addCandidateToPosition = (positionId: number, data: { candidateId: number; recommender?: string; recommendReason?: string }) =>
  request.post(`/positions/${positionId}/candidates`, data);
export const getPositionCandidates = (positionId: number) => request.get(`/positions/${positionId}/candidates`);
export const batchImportCandidates = (positionId: number, items: any[]) =>
  request.post(`/positions/${positionId}/candidates/batch-import`, { items });

export const batchImportPositions = (data: { items: any[]; projectId: number }) =>
  request.post('/positions/batch-import', data);

export const batchUpdatePositions = (ids: number[], data: Partial<any>) =>
  request.put('/positions/batch/update', { ids, data });

export const batchDeletePositions = (ids: number[]) =>
  request.post('/positions/batch-delete', { ids });

export const getDashboardStats = (projectId?: number) =>
  request.get('/positions/dashboard/stats', { params: { projectId } });

// ========== 简历库 API ==========

export const getResumeLibrary = (positionId: number) =>
  request.get(`/positions/${positionId}/resume-library`);

export const uploadResumeFile = (positionId: number, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return request.post(`/positions/${positionId}/resume-library/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const smartUploadResume = (positionId: number, data: { fileUrl: string; fileName: string; extractedText?: string }) =>
  request.post(`/positions/${positionId}/resume-library/smart-upload`, data);

export const exportResumes = (positionId: number, candidateIds: number[]) =>
  request.post(`/positions/${positionId}/resume-library/export`, { candidateIds }, {
    responseType: 'blob',
  });

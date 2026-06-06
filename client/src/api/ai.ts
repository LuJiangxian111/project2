import request from './request';

export const chatWithAI = (message: string, context?: string) =>
  request.post('/ai/chat', { message, context });

export const parseResume = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return request.post('/ai/parse-resume', formData);
};

export const matchAnalysis = (candidateId: number, positionId: number) =>
  request.post('/ai/match', { candidateId, positionId });

export const generateReport = (type: string, projectId: number, startDate?: string, endDate?: string) =>
  request.post('/ai/generate-report', { type, projectId, startDate, endDate });

export const analyzeRisk = (positionId?: number, projectId?: number) =>
  request.post('/ai/analyze-risk', { positionId, projectId });

export const importFile = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return request.post('/ai/import-file', formData);
};

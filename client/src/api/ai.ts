import request from './request';

export const chatWithAI = (message: string, context?: string) =>
  request.post('/ai/chat', { message, context });

export const chatWithFile = (file: File, messages: { role: string; content: string }[]) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('messages', JSON.stringify(messages));
  return request.post('/ai/chat-with-file', formData, { timeout: 180000 });
};

export const analyzeFile = (file: File, instruction?: string) => {
  const formData = new FormData();
  formData.append('file', file);
  if (instruction) formData.append('instruction', instruction);
  return request.post('/ai/analyze-file', formData, { timeout: 180000 });
};

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

export const agentChatWithAI = (message: string) =>
  request.post('/ai/agent-chat', { message });

export const importFile = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return request.post('/ai/import-file', formData);
};

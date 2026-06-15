import request from './request';

export const getSystemLlmConfig = () =>
  request.get('/system-config/llm');

export const updateSystemLlmConfig = (data: { baseUrl?: string; apiKey?: string; model?: string }) =>
  request.put('/system-config/llm', data);

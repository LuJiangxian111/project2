import request from './request';

export function createApiKey(name: string) {
  return request.post('/api-keys', { name });
}

export function listApiKeys() {
  return request.get('/api-keys');
}

export function deleteApiKey(id: number) {
  return request.delete(`/api-keys/${id}`);
}

export function revokeApiKey(id: number) {
  return request.post(`/api-keys/${id}/revoke`);
}

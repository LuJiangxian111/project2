import request from './request';

export interface Project {
  id: number;
  name: string;
  description?: string;
  status: string;
  manager?: string;
  startDate?: string;
  endDate?: string;
  positionCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateProjectParams {
  name: string;
  description?: string;
  status?: string;
  manager?: string;
  startDate?: string;
  endDate?: string;
}

export const getProjects = () => request.get('/projects');
export const createProject = (data: CreateProjectParams) => request.post('/projects', data);
export const getProject = (id: number) => request.get(`/projects/${id}`);
export const updateProject = (id: number, data: Partial<CreateProjectParams>) => request.put(`/projects/${id}`, data);
export const deleteProject = (id: number) => request.delete(`/projects/${id}`);
export const getProjectPositions = (id: number) => request.get(`/projects/${id}/positions`);

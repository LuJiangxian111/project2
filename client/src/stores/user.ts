import { create } from 'zustand';
import { login as loginApi } from '../api/auth';

interface User {
  id: number;
  username: string;
  name?: string;
  email?: string;
  role?: string;
  llmApiKey?: string;
  llmBaseUrl?: string;
  llmModel?: string;
}

interface UserState {
  token: string | null;
  user: User | null;
  setToken: (token: string) => void;
  setUser: (user: User) => void;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  token: localStorage.getItem('token'),
  user: null,
  setToken: (token: string) => {
    localStorage.setItem('token', token);
    set({ token });
  },
  setUser: (user: User) => set({ user }),
  login: async (username: string, password: string) => {
    const res: any = await loginApi({ username, password });
    const { token, user } = res.data || res;
    localStorage.setItem('token', token);
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, user: null });
  },
}));

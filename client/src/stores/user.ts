import { create } from 'zustand';
import { login as loginApi, getProfile } from '../api/auth';

interface User {
  id: number;
  username: string;
  name?: string;
  nickname?: string;
  gender?: string;
  phone?: string;
  email?: string;
  avatar?: string;
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
  loadUser: () => Promise<void>;
}

const USER_STORAGE_KEY = 'user_info';

function loadSavedUser(): User | null {
  try {
    const saved = localStorage.getItem(USER_STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export const useUserStore = create<UserState>((set, get) => ({
  token: localStorage.getItem('token'),
  user: loadSavedUser(),
  setToken: (token: string) => {
    localStorage.setItem('token', token);
    set({ token });
  },
  setUser: (user: User) => {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    set({ user });
  },
  login: async (username: string, password: string) => {
    const res: any = await loginApi({ username, password });
    const { token, user } = res.data || res;
    localStorage.setItem('token', token);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem(USER_STORAGE_KEY);
    set({ token: null, user: null });
  },
  loadUser: async () => {
    const { token, user } = get();
    if (!token) return;
    // 如果已有用户信息则跳过
    if (user && user.id) return;
    // 记住发起请求时的 token，如果请求期间 token 变化了（用户重新登录），则不执行 logout
    const tokenAtRequestStart = token;
    try {
      const res: any = await getProfile();
      const profile = res.data || res;
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(profile));
      set({ user: profile });
    } catch {
      // 仅当 token 没有变化时才 logout，避免竞态条件：用户在 loadUser 期间重新登录
      const currentToken = get().token;
      if (currentToken === tokenAtRequestStart) {
        get().logout();
      }
    }
  },
}));

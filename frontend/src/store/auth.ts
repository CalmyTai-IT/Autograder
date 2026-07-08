import { create } from "zustand";
import type { Role, User } from "@/types";
import { authApi, clearToken, getToken, setToken } from "@/lib/api";

interface AuthState {
  user: User | null;
  ready: boolean; // đã khôi phục phiên xong chưa
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  register: (data: {
    fullName: string; email: string; password: string; role: Role; studentCode?: string;
  }) => Promise<{ message: string }>;
  updateProfile: (patch: Partial<Pick<User, "fullName" | "avatarUrl">>) => Promise<void>;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  ready: false,

  bootstrap: async () => {
    if (!getToken()) {
      set({ ready: true });
      return;
    }
    try {
      const user = await authApi.me();
      set({ user, ready: true });
    } catch {
      clearToken();
      set({ user: null, ready: true });
    }
  },

  login: async (email, password) => {
    const { token, user } = await authApi.login(email, password);
    setToken(token);
    set({ user });
    return user;
  },

  register: (data) => authApi.register(data),

  updateProfile: async (patch) => {
    const updated = await authApi.updateMe(patch);
    set({ user: updated });
  },

  logout: () => {
    clearToken();
    set({ user: null });
  },
}));

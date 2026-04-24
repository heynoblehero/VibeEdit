import { create } from "zustand";

interface AuthStore {
  authenticated: boolean;
  email: string | null;
  unlockedWorkflows: string[];
  loaded: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  setUnlocked: (ids: string[]) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  authenticated: false,
  email: null,
  unlockedWorkflows: [],
  loaded: false,

  async refresh() {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.authenticated) {
        set({
          authenticated: true,
          email: data.email,
          unlockedWorkflows: data.unlockedWorkflows ?? [],
          loaded: true,
        });
      } else {
        set({
          authenticated: false,
          email: null,
          unlockedWorkflows: [],
          loaded: true,
        });
      }
    } catch {
      set({ authenticated: false, email: null, unlockedWorkflows: [], loaded: true });
    }
  },

  async signOut() {
    await fetch("/api/auth/me", { method: "DELETE" }).catch(() => {});
    set({ authenticated: false, email: null, unlockedWorkflows: [] });
  },

  setUnlocked(ids) {
    set({ unlockedWorkflows: ids });
  },
}));

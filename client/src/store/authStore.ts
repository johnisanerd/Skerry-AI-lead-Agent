import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  authLogin,
  authLogout,
  authSession,
  type AuthUser,
} from "@/lib/skerryApi";
import { authLoginLocal, authLogoutLocal, authSessionLocal } from "@/lib/skerryApiLocal";

export type UserRole = "user" | "developer";

interface AuthStore {
  isAuthenticated: boolean;
  isHydrating: boolean;
  user: AuthUser | null;
  login: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  hydrateSession: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    set => ({
      isAuthenticated: false,
      isHydrating: true,
      user: null,
      login: async (email, password) => {
        try {
          // Try server login first
          const response = await authLogin(email, password);
          if (!response.ok || !response.user) {
            // Fallback to local auth if server fails
            console.log('Server auth failed, trying local fallback...');
            const localResponse = await authLoginLocal(email, password);
            if (!localResponse.ok || !localResponse.user) {
              return { success: false, error: localResponse.error ?? "Login failed." };
            }
            set({ isAuthenticated: true, user: localResponse.user });
            return { success: true };
          }
          set({ isAuthenticated: true, user: response.user });
          return { success: true };
        } catch (error) {
          // If network error, try local auth
          console.log('Network error, trying local auth...');
          try {
            const localResponse = await authLoginLocal(email, password);
            if (!localResponse.ok || !localResponse.user) {
              return { success: false, error: localResponse.error ?? "Login failed." };
            }
            set({ isAuthenticated: true, user: localResponse.user });
            return { success: true };
          } catch (localError) {
            return { success: false, error: "Network error and local auth failed." };
          }
        }
      },
      logout: () => {
        void authLogout();
        void authLogoutLocal();
        set({ isAuthenticated: false, user: null });
      },
      hydrateSession: async () => {
        set({ isHydrating: true });
        try {
          const response = await authSession();
          if (response.ok && response.user) {
            set({
              isAuthenticated: true,
              user: response.user,
              isHydrating: false,
            });
            return;
          }
        } catch (error) {
          // Server unavailable, try local session
          try {
            const localResponse = await authSessionLocal();
            if (localResponse.ok && localResponse.user) {
              set({
                isAuthenticated: true,
                user: localResponse.user,
                isHydrating: false,
              });
              return;
            }
          } catch (localError) {
            // Both failed
          }
        }
        set({ isAuthenticated: false, user: null, isHydrating: false });
      },
    }),
    {
      name: "skerry-auth",
      partialize: s => ({
        isAuthenticated: s.isAuthenticated,
        user: s.user,
      }),
    }
  )
);

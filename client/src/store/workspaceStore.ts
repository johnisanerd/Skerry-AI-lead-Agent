import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Workspace {
  id: string;
  name: string;
  plan_tier: string;
  slug: string;
  role?: "owner" | "admin" | "member" | "viewer";
}

interface WorkspaceStore {
  currentId: string | null;
  workspaces: Workspace[];
  setCurrentId: (id: string) => void;
  loadWorkspaces: () => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    set => ({
      currentId: null,
      workspaces: [],
      setCurrentId: id => set({ currentId: id }),
      loadWorkspaces: async () => {
        try {
          const res = await fetch("/api/workspaces", {
            credentials: "include",
          });
          if (!res.ok) return;
          const data = (await res.json()) as {
            ok: boolean;
            workspaces?: Workspace[];
          };
          if (data.ok && data.workspaces?.length) {
            set({
              workspaces: data.workspaces,
              currentId: data.workspaces[0].id,
            });
          }
        } catch {
          /* graceful skip in demo mode */
        }
      },
    }),
    { name: "skerry-workspace", partialize: s => ({ currentId: s.currentId }) }
  )
);

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ProjectPosition {
  id: string;
  x: number;
  y: number;
}

interface ProjectStore {
  projectPositions: Record<string, { x: number; y: number }>;
  setProjectPosition: (id: string, x: number, y: number) => void;
  getProjectPosition: (id: string) => { x: number; y: number } | null;
  clearPositions: () => void;
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      projectPositions: {},

      setProjectPosition: (id: string, x: number, y: number) => {
        set((state) => ({
          projectPositions: {
            ...state.projectPositions,
            [id]: { x, y },
          },
        }));
      },

      getProjectPosition: (id: string) => {
        const positions = get().projectPositions;
        return positions[id] || null;
      },

      clearPositions: () => {
        set({ projectPositions: {} });
      },
    }),
    {
      name: 'studio-project-positions',
      version: 1,
    }
  )
);

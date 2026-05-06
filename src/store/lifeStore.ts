import { create } from "zustand";
import type {
  ExcludedPeriod,
  LifeProject,
  LifeStage,
  Milestone,
} from "../types/life";
import { createDemoProjects } from "../storage/demoData";
import {
  loadLifeData,
  saveLifeData,
  type StoredLifeData,
} from "../storage/lifeStorage";
import {
  clearLifeDataOnServer,
  loadLifeDataFromServer,
  saveLifeDataToServer,
} from "../storage/lifeApi";
import { createId, timestamp } from "../utils/id";

type ProjectInput = {
  name: string;
  description?: string;
};

type StageInput = {
  name: string;
  startDate: string;
  endDate: string;
  color?: string;
  description?: string;
  tags?: string[];
};

type ExcludedPeriodInput = {
  name: string;
  startDate: string;
  endDate: string;
  reason?: string;
  countAsExcluded: boolean;
};

type MilestoneInput = {
  name: string;
  date: string;
  description?: string;
};

type LifeState = {
  projects: LifeProject[];
  selectedProjectId?: string;
  storageWarning?: string;
  backendStatus: "idle" | "syncing" | "synced" | "unavailable";
  createProject: (input: ProjectInput) => void;
  updateProject: (projectId: string, patch: Partial<ProjectInput>) => void;
  deleteProject: (projectId: string) => void;
  createStage: (projectId: string, input: StageInput) => void;
  updateStage: (
    projectId: string,
    stageId: string,
    patch: Partial<StageInput>
  ) => void;
  deleteStage: (projectId: string, stageId: string) => void;
  createExcludedPeriod: (
    projectId: string,
    stageId: string,
    input: ExcludedPeriodInput
  ) => void;
  updateExcludedPeriod: (
    projectId: string,
    stageId: string,
    excludedPeriodId: string,
    patch: Partial<ExcludedPeriodInput>
  ) => void;
  deleteExcludedPeriod: (
    projectId: string,
    stageId: string,
    excludedPeriodId: string
  ) => void;
  createMilestone: (
    projectId: string,
    stageId: string,
    input: MilestoneInput
  ) => void;
  updateMilestone: (
    projectId: string,
    stageId: string,
    milestoneId: string,
    patch: Partial<MilestoneInput>
  ) => void;
  deleteMilestone: (
    projectId: string,
    stageId: string,
    milestoneId: string
  ) => void;
  selectProject: (projectId?: string) => void;
  syncWithBackend: () => Promise<void>;
  resetDemoData: () => void;
  clearAllData: () => void;
};

const loaded = loadLifeData();
const initialSelectedProjectId = loaded.data.projects[0]?.id;

function persist(projects: LifeProject[]): string | undefined {
  const data: StoredLifeData = {
    version: 1,
    projects,
  };
  void saveLifeDataToServer(data).catch(() => undefined);
  return saveLifeData(data);
}

function withProjectUpdate(
  projects: LifeProject[],
  projectId: string,
  updater: (project: LifeProject) => LifeProject
): LifeProject[] {
  return projects.map((project) =>
    project.id === projectId
      ? { ...updater(project), updatedAt: timestamp() }
      : project
  );
}

function createStageEntity(input: StageInput): LifeStage {
  const now = timestamp();

  return {
    id: createId(),
    name: input.name,
    startDate: input.startDate,
    endDate: input.endDate,
    color: input.color,
    description: input.description,
    tags: input.tags ?? [],
    excludedPeriods: [],
    milestones: [],
    createdAt: now,
    updatedAt: now,
  };
}

function createExcludedPeriodEntity(
  input: ExcludedPeriodInput
): ExcludedPeriod {
  const now = timestamp();

  return {
    id: createId(),
    name: input.name,
    startDate: input.startDate,
    endDate: input.endDate,
    reason: input.reason,
    countAsExcluded: input.countAsExcluded,
    createdAt: now,
    updatedAt: now,
  };
}

function createMilestoneEntity(input: MilestoneInput): Milestone {
  const now = timestamp();

  return {
    id: createId(),
    name: input.name,
    date: input.date,
    description: input.description,
    createdAt: now,
    updatedAt: now,
  };
}

export const useLifeStore = create<LifeState>((set) => ({
  projects: loaded.data.projects,
  selectedProjectId: initialSelectedProjectId,
  storageWarning: loaded.warning,
  backendStatus: "idle",

  createProject: (input) =>
    set((state) => {
      const now = timestamp();
      const project: LifeProject = {
        id: createId(),
        name: input.name,
        description: input.description,
        stages: [],
        createdAt: now,
        updatedAt: now,
      };
      const projects = [project, ...state.projects];
      return {
        projects,
        selectedProjectId: project.id,
        storageWarning: persist(projects),
      };
    }),

  updateProject: (projectId, patch) =>
    set((state) => {
      const projects = withProjectUpdate(state.projects, projectId, (project) => ({
        ...project,
        ...patch,
      }));
      return { projects, storageWarning: persist(projects) };
    }),

  deleteProject: (projectId) =>
    set((state) => {
      const projects = state.projects.filter((project) => project.id !== projectId);
      return {
        projects,
        selectedProjectId:
          state.selectedProjectId === projectId
            ? projects[0]?.id
            : state.selectedProjectId,
        storageWarning: persist(projects),
      };
    }),

  createStage: (projectId, input) =>
    set((state) => {
      const projects = withProjectUpdate(state.projects, projectId, (project) => ({
        ...project,
        stages: [...project.stages, createStageEntity(input)],
      }));
      return { projects, storageWarning: persist(projects) };
    }),

  updateStage: (projectId, stageId, patch) =>
    set((state) => {
      const projects = withProjectUpdate(state.projects, projectId, (project) => ({
        ...project,
        stages: project.stages.map((stage) =>
          stage.id === stageId
            ? { ...stage, ...patch, updatedAt: timestamp() }
            : stage
        ),
      }));
      return { projects, storageWarning: persist(projects) };
    }),

  deleteStage: (projectId, stageId) =>
    set((state) => {
      const projects = withProjectUpdate(state.projects, projectId, (project) => ({
        ...project,
        stages: project.stages.filter((stage) => stage.id !== stageId),
      }));
      return { projects, storageWarning: persist(projects) };
    }),

  createExcludedPeriod: (projectId, stageId, input) =>
    set((state) => {
      const projects = withProjectUpdate(state.projects, projectId, (project) => ({
        ...project,
        stages: project.stages.map((stage) =>
          stage.id === stageId
            ? {
                ...stage,
                excludedPeriods: [
                  ...stage.excludedPeriods,
                  createExcludedPeriodEntity(input),
                ],
                updatedAt: timestamp(),
              }
            : stage
        ),
      }));
      return { projects, storageWarning: persist(projects) };
    }),

  updateExcludedPeriod: (projectId, stageId, excludedPeriodId, patch) =>
    set((state) => {
      const projects = withProjectUpdate(state.projects, projectId, (project) => ({
        ...project,
        stages: project.stages.map((stage) =>
          stage.id === stageId
            ? {
                ...stage,
                excludedPeriods: stage.excludedPeriods.map((period) =>
                  period.id === excludedPeriodId
                    ? { ...period, ...patch, updatedAt: timestamp() }
                    : period
                ),
                updatedAt: timestamp(),
              }
            : stage
        ),
      }));
      return { projects, storageWarning: persist(projects) };
    }),

  deleteExcludedPeriod: (projectId, stageId, excludedPeriodId) =>
    set((state) => {
      const projects = withProjectUpdate(state.projects, projectId, (project) => ({
        ...project,
        stages: project.stages.map((stage) =>
          stage.id === stageId
            ? {
                ...stage,
                excludedPeriods: stage.excludedPeriods.filter(
                  (period) => period.id !== excludedPeriodId
                ),
                updatedAt: timestamp(),
              }
            : stage
        ),
      }));
      return { projects, storageWarning: persist(projects) };
    }),

  createMilestone: (projectId, stageId, input) =>
    set((state) => {
      const projects = withProjectUpdate(state.projects, projectId, (project) => ({
        ...project,
        stages: project.stages.map((stage) =>
          stage.id === stageId
            ? {
                ...stage,
                milestones: [...stage.milestones, createMilestoneEntity(input)],
                updatedAt: timestamp(),
              }
            : stage
        ),
      }));
      return { projects, storageWarning: persist(projects) };
    }),

  updateMilestone: (projectId, stageId, milestoneId, patch) =>
    set((state) => {
      const projects = withProjectUpdate(state.projects, projectId, (project) => ({
        ...project,
        stages: project.stages.map((stage) =>
          stage.id === stageId
            ? {
                ...stage,
                milestones: stage.milestones.map((milestone) =>
                  milestone.id === milestoneId
                    ? { ...milestone, ...patch, updatedAt: timestamp() }
                    : milestone
                ),
                updatedAt: timestamp(),
              }
            : stage
        ),
      }));
      return { projects, storageWarning: persist(projects) };
    }),

  deleteMilestone: (projectId, stageId, milestoneId) =>
    set((state) => {
      const projects = withProjectUpdate(state.projects, projectId, (project) => ({
        ...project,
        stages: project.stages.map((stage) =>
          stage.id === stageId
            ? {
                ...stage,
                milestones: stage.milestones.filter(
                  (milestone) => milestone.id !== milestoneId
                ),
                updatedAt: timestamp(),
              }
            : stage
        ),
      }));
      return { projects, storageWarning: persist(projects) };
    }),

  selectProject: (projectId) => set({ selectedProjectId: projectId }),

  syncWithBackend: async () => {
    set({ backendStatus: "syncing" });

    try {
      const serverData = await loadLifeDataFromServer();

      set((state) => {
        if (serverData.projects.length === 0 && state.projects.length > 0) {
          const data: StoredLifeData = {
            version: 1,
            projects: state.projects,
          };
          void saveLifeDataToServer(data).catch(() => undefined);
          return { backendStatus: "synced" };
        }

        if (serverData.projects.length === 0) {
          return { backendStatus: "synced" };
        }

        saveLifeData(serverData);
        return {
          projects: serverData.projects,
          selectedProjectId:
            state.selectedProjectId &&
            serverData.projects.some(
              (project) => project.id === state.selectedProjectId
            )
              ? state.selectedProjectId
              : serverData.projects[0]?.id,
          backendStatus: "synced",
        };
      });
    } catch {
      set({ backendStatus: "unavailable" });
    }
  },

  resetDemoData: () =>
    set(() => {
      const projects = createDemoProjects();
      return {
        projects,
        selectedProjectId: projects[0]?.id,
        storageWarning: persist(projects),
      };
    }),

  clearAllData: () =>
    set(() => {
      void clearLifeDataOnServer().catch(() => undefined);
      return {
        projects: [],
        selectedProjectId: undefined,
        storageWarning: persist([]),
      };
    }),
}));

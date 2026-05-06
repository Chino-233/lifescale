export type ID = string;

export type LifeProject = {
  id: ID;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  stages: LifeStage[];
};

export type LifeStage = {
  id: ID;
  name: string;
  startDate: string;
  endDate: string;
  color?: string;
  description?: string;
  tags: string[];
  excludedPeriods: ExcludedPeriod[];
  milestones: Milestone[];
  createdAt: string;
  updatedAt: string;
};

export type ExcludedPeriod = {
  id: ID;
  name: string;
  startDate: string;
  endDate: string;
  reason?: string;
  countAsExcluded: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Milestone = {
  id: ID;
  name: string;
  date: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
};

export type StageStatus = "not_started" | "active" | "completed" | "invalid";

export type ProgressMetric = {
  totalMs: number;
  elapsedMs: number;
  remainingMs: number;
  percentage: number;
};

export type StageProgress = {
  status: StageStatus;
  natural: ProgressMetric;
  effective: ProgressMetric;
  excludedTotalMs: number;
  excludedElapsedMs: number;
  warnings: string[];
};

export type ProjectProgress = {
  natural: ProgressMetric;
  effective: ProgressMetric;
  excludedTotalMs: number;
  activeStageId?: string;
  warnings: string[];
};

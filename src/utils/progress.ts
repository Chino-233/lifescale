import type {
  LifeProject,
  LifeStage,
  ProgressMetric,
  ProjectProgress,
  StageProgress,
  StageStatus,
} from "../types/life";
import {
  clamp,
  clipInterval,
  mergeIntervals,
  sumIntervals,
  toInterval,
  type TimeInterval,
} from "./intervals";

const emptyMetric: ProgressMetric = {
  totalMs: 0,
  elapsedMs: 0,
  remainingMs: 0,
  percentage: 0,
};

function metric(totalMs: number, elapsedMs: number): ProgressMetric {
  const clampedTotal = Math.max(0, totalMs);
  const clampedElapsed = clamp(elapsedMs, 0, clampedTotal);

  return {
    totalMs: clampedTotal,
    elapsedMs: clampedElapsed,
    remainingMs: clampedTotal - clampedElapsed,
    percentage: clampedTotal > 0 ? (clampedElapsed / clampedTotal) * 100 : 0,
  };
}

function getStatus(stageInterval: TimeInterval, nowMs: number): StageStatus {
  if (nowMs < stageInterval.startMs) {
    return "not_started";
  }

  if (nowMs >= stageInterval.endMs) {
    return "completed";
  }

  return "active";
}

function getExcludedIntervals(
  stage: LifeStage,
  boundary: TimeInterval
): TimeInterval[] {
  return stage.excludedPeriods
    .filter((period) => period.countAsExcluded)
    .map((period) => toInterval(period.startDate, period.endDate))
    .filter((interval): interval is TimeInterval => interval !== null)
    .map((interval) => clipInterval(interval, boundary))
    .filter((interval): interval is TimeInterval => interval !== null);
}

export function computeStageProgress(
  stage: LifeStage,
  now: Date = new Date()
): StageProgress {
  const warnings: string[] = [];
  const stageInterval = toInterval(stage.startDate, stage.endDate);

  if (!stageInterval) {
    return {
      status: "invalid",
      natural: emptyMetric,
      effective: emptyMetric,
      excludedTotalMs: 0,
      excludedElapsedMs: 0,
      warnings: ["阶段日期无效，请检查开始和结束日期。"],
    };
  }

  const nowMs = now.getTime();
  const naturalTotalMs = stageInterval.endMs - stageInterval.startMs;
  const naturalElapsedMs = clamp(
    nowMs - stageInterval.startMs,
    0,
    naturalTotalMs
  );
  const natural = metric(naturalTotalMs, naturalElapsedMs);
  const status = getStatus(stageInterval, nowMs);

  const rawExcludedIntervals = stage.excludedPeriods
    .filter((period) => period.countAsExcluded)
    .map((period) => toInterval(period.startDate, period.endDate))
    .filter((interval): interval is TimeInterval => interval !== null);
  const clippedExcludedIntervals = rawExcludedIntervals
    .map((interval) => clipInterval(interval, stageInterval))
    .filter((interval): interval is TimeInterval => interval !== null);
  const mergedExcludedIntervals = mergeIntervals(clippedExcludedIntervals);
  const excludedTotalMs = sumIntervals(mergedExcludedIntervals);

  const rawExcludedDurationMs = sumIntervals(rawExcludedIntervals);
  const clippedExcludedDurationMs = sumIntervals(clippedExcludedIntervals);

  if (rawExcludedDurationMs !== clippedExcludedDurationMs) {
    warnings.push("部分排除时间段超出阶段范围，计算时已自动裁剪。");
  }

  if (clippedExcludedIntervals.length !== mergedExcludedIntervals.length) {
    warnings.push("存在重叠的排除时间段，计算时已合并处理。");
  }

  const elapsedBoundary: TimeInterval = {
    startMs: stageInterval.startMs,
    endMs: clamp(nowMs, stageInterval.startMs, stageInterval.endMs),
  };
  const excludedElapsedMs = sumIntervals(
    mergeIntervals(getExcludedIntervals(stage, elapsedBoundary))
  );

  const effectiveTotalMs = naturalTotalMs - excludedTotalMs;
  const effectiveElapsedMs = naturalElapsedMs - excludedElapsedMs;

  if (effectiveTotalMs <= 0) {
    return {
      status: "invalid",
      natural,
      effective: emptyMetric,
      excludedTotalMs,
      excludedElapsedMs,
      warnings: [
        ...warnings,
        "排除时间段覆盖了整个阶段，因此无法计算净进度。",
      ],
    };
  }

  return {
    status,
    natural,
    effective: metric(effectiveTotalMs, effectiveElapsedMs),
    excludedTotalMs,
    excludedElapsedMs,
    warnings,
  };
}

export function computeProjectProgress(
  project: LifeProject,
  now: Date = new Date()
): ProjectProgress {
  const warnings: string[] = [];
  const stageEntries = project.stages
    .map((stage) => ({
      stage,
      interval: toInterval(stage.startDate, stage.endDate),
      progress: computeStageProgress(stage, now),
    }))
    .filter((entry) => entry.interval !== null);

  if (stageEntries.length === 0) {
    return {
      natural: emptyMetric,
      effective: emptyMetric,
      excludedTotalMs: 0,
      warnings: ["这个项目还没有有效阶段。"],
    };
  }

  const intervals = stageEntries.map((entry) => entry.interval as TimeInterval);
  const startMs = Math.min(...intervals.map((interval) => interval.startMs));
  const endMs = Math.max(...intervals.map((interval) => interval.endMs));
  const totalMs = endMs - startMs;
  const elapsedMs = clamp(now.getTime() - startMs, 0, totalMs);

  const activeStages = stageEntries
    .filter((entry) => entry.progress.status === "active")
    .sort((a, b) => {
      const aStart = (a.interval as TimeInterval).startMs;
      const bStart = (b.interval as TimeInterval).startMs;
      return aStart - bStart;
    });

  if (activeStages.length > 1) {
    warnings.push("当前有多个阶段重叠处于进行中，已选择开始日期最早的阶段。");
  }

  const effectiveTotalMs = stageEntries.reduce(
    (sum, entry) => sum + entry.progress.effective.totalMs,
    0
  );
  const effectiveElapsedMs = stageEntries.reduce(
    (sum, entry) => sum + entry.progress.effective.elapsedMs,
    0
  );
  const excludedTotalMs = stageEntries.reduce(
    (sum, entry) => sum + entry.progress.excludedTotalMs,
    0
  );

  return {
    natural: metric(totalMs, elapsedMs),
    effective: metric(effectiveTotalMs, effectiveElapsedMs),
    excludedTotalMs,
    activeStageId: activeStages[0]?.stage.id,
    warnings,
  };
}

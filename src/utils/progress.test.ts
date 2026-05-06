import { describe, expect, it } from "vitest";
import type { LifeStage } from "../types/life";
import { parseLocalDate } from "./date";
import {
  getOverlap,
  mergeIntervals,
  toInterval,
  type TimeInterval,
} from "./intervals";
import { computeStageProgress } from "./progress";

const DAY_MS = 24 * 60 * 60 * 1000;

function stage(overrides: Partial<LifeStage> = {}): LifeStage {
  return {
    id: "stage-1",
    name: "测试阶段",
    startDate: "2026-01-01",
    endDate: "2026-01-10",
    color: "#2563eb",
    description: "",
    tags: [],
    excludedPeriods: [],
    milestones: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function localDate(
  year: number,
  monthIndex: number,
  day: number,
  hours = 0
): Date {
  return new Date(year, monthIndex, day, hours, 0, 0, 0);
}

describe("parseLocalDate", () => {
  it("parses YYYY-MM-DD as local midnight", () => {
    const date = parseLocalDate("2026-01-02");

    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(0);
    expect(date.getDate()).toBe(2);
    expect(date.getHours()).toBe(0);
  });

  it("handles month indexing correctly", () => {
    const date = parseLocalDate("2026-12-31");

    expect(date.getMonth()).toBe(11);
    expect(date.getDate()).toBe(31);
  });
});

describe("toInterval", () => {
  it("converts inclusive UI end date to exclusive internal end", () => {
    const interval = toInterval("2026-01-01", "2026-01-10");

    expect(interval).not.toBeNull();
    expect(interval?.endMs).toBe(localDate(2026, 0, 11).getTime());
  });

  it("rejects end before start", () => {
    expect(toInterval("2026-01-10", "2026-01-01")).toBeNull();
  });

  it("accepts same-day interval as one day", () => {
    const interval = toInterval("2026-01-01", "2026-01-01");

    expect(interval).not.toBeNull();
    expect((interval as TimeInterval).endMs - (interval as TimeInterval).startMs).toBe(
      DAY_MS
    );
  });
});

describe("getOverlap", () => {
  it("handles no overlap", () => {
    expect(
      getOverlap(
        { startMs: 0, endMs: 10 },
        { startMs: 10, endMs: 20 }
      )
    ).toBeNull();
  });

  it("handles partial overlap", () => {
    expect(
      getOverlap(
        { startMs: 0, endMs: 10 },
        { startMs: 5, endMs: 15 }
      )
    ).toEqual({ startMs: 5, endMs: 10 });
  });

  it("handles full containment", () => {
    expect(
      getOverlap(
        { startMs: 0, endMs: 20 },
        { startMs: 5, endMs: 10 }
      )
    ).toEqual({ startMs: 5, endMs: 10 });
  });
});

describe("mergeIntervals", () => {
  it("sorts unsorted intervals", () => {
    expect(
      mergeIntervals([
        { startMs: 20, endMs: 30 },
        { startMs: 0, endMs: 10 },
      ])
    ).toEqual([
      { startMs: 0, endMs: 10 },
      { startMs: 20, endMs: 30 },
    ]);
  });

  it("merges overlapping intervals", () => {
    expect(
      mergeIntervals([
        { startMs: 0, endMs: 10 },
        { startMs: 5, endMs: 15 },
      ])
    ).toEqual([{ startMs: 0, endMs: 15 }]);
  });

  it("merges touching intervals", () => {
    expect(
      mergeIntervals([
        { startMs: 0, endMs: 10 },
        { startMs: 10, endMs: 20 },
      ])
    ).toEqual([{ startMs: 0, endMs: 20 }]);
  });

  it("ignores invalid intervals", () => {
    expect(
      mergeIntervals([
        { startMs: 0, endMs: 0 },
        { startMs: 10, endMs: 5 },
        { startMs: 1, endMs: 2 },
      ])
    ).toEqual([{ startMs: 1, endMs: 2 }]);
  });
});

describe("computeStageProgress", () => {
  it("handles a not-started stage", () => {
    const progress = computeStageProgress(stage(), localDate(2025, 11, 31));

    expect(progress.status).toBe("not_started");
    expect(progress.natural.percentage).toBe(0);
  });

  it("handles an active stage with no exclusions", () => {
    const progress = computeStageProgress(stage(), localDate(2026, 0, 6));

    expect(progress.status).toBe("active");
    expect(progress.natural.percentage).toBeCloseTo(50);
    expect(progress.effective.percentage).toBeCloseTo(50);
  });

  it("handles a completed stage", () => {
    const progress = computeStageProgress(stage(), localDate(2026, 0, 11));

    expect(progress.status).toBe("completed");
    expect(progress.natural.percentage).toBe(100);
    expect(progress.effective.percentage).toBe(100);
  });

  it("handles invalid stage dates", () => {
    const progress = computeStageProgress(
      stage({ startDate: "2026-01-10", endDate: "2026-01-01" }),
      localDate(2026, 0, 6)
    );

    expect(progress.status).toBe("invalid");
    expect(progress.warnings.length).toBeGreaterThan(0);
  });

  it("handles one past excluded period", () => {
    const progress = computeStageProgress(
      stage({
        excludedPeriods: [
          {
            id: "excluded-1",
            name: "恢复",
            startDate: "2026-01-03",
            endDate: "2026-01-04",
            countAsExcluded: true,
            createdAt: "",
            updatedAt: "",
          },
        ],
      }),
      localDate(2026, 0, 6)
    );

    expect(progress.excludedTotalMs).toBe(2 * DAY_MS);
    expect(progress.excludedElapsedMs).toBe(2 * DAY_MS);
    expect(progress.effective.percentage).toBeCloseTo(37.5);
  });

  it("handles one future excluded period", () => {
    const progress = computeStageProgress(
      stage({
        excludedPeriods: [
          {
            id: "excluded-1",
            name: "未来暂停",
            startDate: "2026-01-05",
            endDate: "2026-01-06",
            countAsExcluded: true,
            createdAt: "",
            updatedAt: "",
          },
        ],
      }),
      localDate(2026, 0, 2)
    );

    expect(progress.excludedTotalMs).toBe(2 * DAY_MS);
    expect(progress.excludedElapsedMs).toBe(0);
    expect(progress.effective.percentage).toBeCloseTo(12.5);
  });

  it("handles one currently active excluded period", () => {
    const progress = computeStageProgress(
      stage({
        excludedPeriods: [
          {
            id: "excluded-1",
            name: "正在暂停",
            startDate: "2026-01-03",
            endDate: "2026-01-04",
            countAsExcluded: true,
            createdAt: "",
            updatedAt: "",
          },
        ],
      }),
      localDate(2026, 0, 3, 12)
    );

    expect(progress.excludedElapsedMs).toBe(0.5 * DAY_MS);
    expect(progress.effective.percentage).toBeCloseTo(25);
  });

  it("handles overlapping excluded periods without double-counting", () => {
    const progress = computeStageProgress(
      stage({
        excludedPeriods: [
          {
            id: "excluded-1",
            name: "暂停一",
            startDate: "2026-01-03",
            endDate: "2026-01-05",
            countAsExcluded: true,
            createdAt: "",
            updatedAt: "",
          },
          {
            id: "excluded-2",
            name: "暂停二",
            startDate: "2026-01-05",
            endDate: "2026-01-07",
            countAsExcluded: true,
            createdAt: "",
            updatedAt: "",
          },
        ],
      }),
      localDate(2026, 0, 8)
    );

    expect(progress.excludedTotalMs).toBe(5 * DAY_MS);
    expect(progress.warnings).toContain("存在重叠的排除时间段，计算时已合并处理。");
  });

  it("clips excluded periods outside the stage", () => {
    const progress = computeStageProgress(
      stage({
        excludedPeriods: [
          {
            id: "excluded-1",
            name: "跨界暂停",
            startDate: "2025-12-30",
            endDate: "2026-01-02",
            countAsExcluded: true,
            createdAt: "",
            updatedAt: "",
          },
        ],
      }),
      localDate(2026, 0, 6)
    );

    expect(progress.excludedTotalMs).toBe(2 * DAY_MS);
    expect(progress.warnings).toContain("部分排除时间段超出阶段范围，计算时已自动裁剪。");
  });

  it("handles exclusions covering the whole stage", () => {
    const progress = computeStageProgress(
      stage({
        startDate: "2026-01-01",
        endDate: "2026-01-02",
        excludedPeriods: [
          {
            id: "excluded-1",
            name: "全部暂停",
            startDate: "2026-01-01",
            endDate: "2026-01-02",
            countAsExcluded: true,
            createdAt: "",
            updatedAt: "",
          },
        ],
      }),
      localDate(2026, 0, 2)
    );

    expect(progress.status).toBe("invalid");
    expect(progress.effective.percentage).toBe(0);
  });

  it("clamps progress to 0 and 100", () => {
    const before = computeStageProgress(stage(), localDate(2020, 0, 1));
    const after = computeStageProgress(stage(), localDate(2030, 0, 1));

    expect(before.natural.percentage).toBe(0);
    expect(after.natural.percentage).toBe(100);
  });
});

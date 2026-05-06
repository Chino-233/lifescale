import { addLocalDays, isValidDate, parseLocalDate } from "./date";

export type TimeInterval = {
  startMs: number;
  endMs: number;
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function toInterval(
  startDate: string,
  endDate: string
): TimeInterval | null {
  const start = parseLocalDate(startDate);
  const inclusiveEnd = parseLocalDate(endDate);

  if (!isValidDate(start) || !isValidDate(inclusiveEnd)) {
    return null;
  }

  const endExclusive = addLocalDays(inclusiveEnd, 1);
  const interval = {
    startMs: start.getTime(),
    endMs: endExclusive.getTime(),
  };

  return interval.endMs > interval.startMs ? interval : null;
}

export function getDuration(interval: TimeInterval): number {
  return Math.max(0, interval.endMs - interval.startMs);
}

export function getOverlap(
  a: TimeInterval,
  b: TimeInterval
): TimeInterval | null {
  const startMs = Math.max(a.startMs, b.startMs);
  const endMs = Math.min(a.endMs, b.endMs);
  return endMs > startMs ? { startMs, endMs } : null;
}

export function clipInterval(
  interval: TimeInterval,
  boundary: TimeInterval
): TimeInterval | null {
  return getOverlap(interval, boundary);
}

export function mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  const sorted = intervals
    .filter((interval) => interval.endMs > interval.startMs)
    .sort((a, b) => a.startMs - b.startMs);

  const merged: TimeInterval[] = [];

  for (const interval of sorted) {
    const previous = merged[merged.length - 1];

    if (!previous || previous.endMs < interval.startMs) {
      merged.push({ ...interval });
      continue;
    }

    previous.endMs = Math.max(previous.endMs, interval.endMs);
  }

  return merged;
}

export function sumIntervals(intervals: TimeInterval[]): number {
  return intervals.reduce((sum, interval) => sum + getDuration(interval), 0);
}

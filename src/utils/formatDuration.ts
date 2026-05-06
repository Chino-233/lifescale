const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_DAYS = 30.4375;
const YEAR_DAYS = 365.25;

export function formatDuration(ms: number): string {
  const days = Math.max(0, Math.round(ms / DAY_MS));

  if (days === 0) {
    return "0 天";
  }

  const years = Math.floor(days / YEAR_DAYS);
  const remainingAfterYears = days - Math.floor(years * YEAR_DAYS);
  const months = Math.floor(remainingAfterYears / MONTH_DAYS);
  const remainingDays = Math.round(remainingAfterYears - months * MONTH_DAYS);

  const parts: string[] = [];

  if (years > 0) {
    parts.push(`${years} 年`);
  }

  if (months > 0) {
    parts.push(`${months} 个月`);
  }

  if (years === 0 && remainingDays > 0) {
    parts.push(`${remainingDays} 天`);
  }

  return parts.slice(0, 2).join(" ");
}

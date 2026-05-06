export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);

  if (!year || !month || !day) {
    return new Date(Number.NaN);
  }

  const date = new Date(year, month - 1, day, 0, 0, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return new Date(Number.NaN);
  }

  return date;
}

export function addLocalDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

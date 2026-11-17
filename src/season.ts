export function seasonStartYear(date: string): number {
  const [yearText, monthText] = date.split("-");
  const year = Number(yearText), month = Number(monthText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) throw new Error("Nieprawidłowa data sezonu");
  return month >= 7 ? year : year - 1;
}

export function seasonCode(date: string): string {
  const start = seasonStartYear(date);
  return `${String(start % 100).padStart(2, "0")}${String((start + 1) % 100).padStart(2, "0")}`;
}

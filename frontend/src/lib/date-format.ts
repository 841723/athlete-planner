import { format as dfFormat, isToday, parseISO } from "date-fns";
import { es } from "date-fns/locale";

type DateArg = Parameters<typeof dfFormat>[0];

export function format(date: DateArg, pattern: string, options?: { weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6 }) {
  return dfFormat(date, pattern, { ...options, locale: es });
}

export function formatChatTimestamp(value: string) {
  const date = parseISO(value);
  return isToday(date) ? format(date, "HH:mm") : format(date, "d MMM yyyy");
}

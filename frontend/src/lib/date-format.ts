import { format as dfFormat } from "date-fns";
import { es } from "date-fns/locale";

type DateArg = Parameters<typeof dfFormat>[0];

export function format(date: DateArg, pattern: string, options?: { weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6 }) {
  return dfFormat(date, pattern, { ...options, locale: es });
}

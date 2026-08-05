import type { QueryClient } from "@tanstack/react-query";

export function invalidateMany(qc: QueryClient, keys: string[]) {
  for (const key of keys) {
    void qc.invalidateQueries({ queryKey: [key] });
  }
}

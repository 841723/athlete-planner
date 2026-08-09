import { lineDiff, type DiffLine } from "@/lib/diff";

export interface ProfileDiff {
  left: DiffLine[];
  right: DiffLine[];
}

export function computeProfileDiff(current: unknown, target: unknown): ProfileDiff {
  const currentJson = JSON.stringify(current, null, 2);
  const targetJson = JSON.stringify(target, null, 2);
  return {
    left: lineDiff(currentJson, targetJson),
    right: lineDiff(targetJson, currentJson),
  };
}

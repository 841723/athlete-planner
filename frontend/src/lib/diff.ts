export type DiffLine = { kind: "same" | "removed" | "added"; text: string };

function lcsMatrix(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  return dp;
}

export function lineDiff(a: string, b: string): DiffLine[] {
  const aLines = a.split("\n");
  const bLines = b.split("\n");
  const dp = lcsMatrix(aLines, bLines);
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < aLines.length && j < bLines.length) {
    if (aLines[i] === bLines[j]) {
      out.push({ kind: "same", text: aLines[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ kind: "removed", text: aLines[i] });
      i++;
    } else {
      out.push({ kind: "added", text: bLines[j] });
      j++;
    }
  }
  while (i < aLines.length) {
    out.push({ kind: "removed", text: aLines[i] });
    i++;
  }
  while (j < bLines.length) {
    out.push({ kind: "added", text: bLines[j] });
    j++;
  }
  return out;
}

/**
 * Lightweight word-level diff for text comparison.
 * Uses a simple LCS-based approach — no external dependencies.
 */

export type DiffSegment = {
  type: "equal" | "added" | "removed";
  text: string;
};

/**
 * Compute word-level diff between two strings.
 * Returns an array of segments: equal, added, or removed.
 */
export function diffWords(oldText: string, newText: string): DiffSegment[] {
  if (!oldText && !newText) return [];
  if (!oldText) return [{ type: "added", text: newText }];
  if (!newText) return [{ type: "removed", text: oldText }];
  if (oldText === newText) return [{ type: "equal", text: oldText }];

  const oldWords = tokenize(oldText);
  const newWords = tokenize(newText);

  // Build LCS table
  const lcs = buildLCS(oldWords, newWords);

  // Backtrack to produce diff segments
  return backtrackDiff(oldWords, newWords, lcs);
}

function tokenize(text: string): string[] {
  // Split on word boundaries, preserving whitespace and punctuation as tokens
  return text.match(/\S+|\s+/g) || [];
}

function buildLCS(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;

  // For very long texts, use a simpler approach to avoid O(m*n) memory
  if (m * n > 500000) {
    return buildLCSSimplified(a, b);
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp;
}

/**
 * Simplified LCS for very long texts — only keeps 2 rows in memory.
 * Returns a fake dp table that works with a simplified backtrack.
 */
function buildLCSSimplified(a: string[], b: string[]): number[][] {
  // Fall back to sentence-level diff for very long texts
  return [];
}

function backtrackDiff(a: string[], b: string[], dp: number[][]): DiffSegment[] {
  // If dp is empty (simplified fallback), use simple sentence diff
  if (dp.length === 0) {
    return simpleDiff(a, b);
  }

  const segments: DiffSegment[] = [];
  let i = a.length;
  let j = b.length;

  const parts: DiffSegment[] = [];

  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      parts.push({ type: "equal", text: a[i - 1] });
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      parts.push({ type: "removed", text: a[i - 1] });
      i--;
    } else {
      parts.push({ type: "added", text: b[j - 1] });
      j--;
    }
  }

  while (i > 0) {
    parts.push({ type: "removed", text: a[i - 1] });
    i--;
  }
  while (j > 0) {
    parts.push({ type: "added", text: b[j - 1] });
    j--;
  }

  parts.reverse();

  // Merge consecutive segments of the same type
  for (const part of parts) {
    const last = segments[segments.length - 1];
    if (last && last.type === part.type) {
      last.text += part.text;
    } else {
      segments.push({ ...part });
    }
  }

  return segments;
}

/**
 * Simple diff fallback for very long texts — compares sentence by sentence.
 */
function simpleDiff(a: string[], b: string[]): DiffSegment[] {
  const oldText = a.join("");
  const newText = b.join("");

  // Split into sentences and compare
  const oldSentences = oldText.split(/(?<=[.!?\n])\s+/);
  const newSentences = newText.split(/(?<=[.!?\n])\s+/);

  const oldSet = new Set(oldSentences);
  const newSet = new Set(newSentences);

  const segments: DiffSegment[] = [];

  // Show removed sentences first, then added
  const removed = oldSentences.filter((s) => !newSet.has(s));
  const added = newSentences.filter((s) => !oldSet.has(s));
  const equal = newSentences.filter((s) => oldSet.has(s));

  if (removed.length > 0) segments.push({ type: "removed", text: removed.join(" ") });
  if (equal.length > 0) segments.push({ type: "equal", text: equal.join(" ") });
  if (added.length > 0) segments.push({ type: "added", text: added.join(" ") });

  return segments;
}

/**
 * Compute a concise summary of array changes.
 */
export function diffArraySummary(oldArr: string[], newArr: string[]): {
  added: string[];
  removed: string[];
} {
  const oldSet = new Set(oldArr);
  const newSet = new Set(newArr);
  return {
    added: newArr.filter((item) => !oldSet.has(item)),
    removed: oldArr.filter((item) => !newSet.has(item)),
  };
}

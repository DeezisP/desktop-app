/**
 * Electronics part-number extraction and scoring.
 *
 * Pattern: 2+ dash-separated alphanumeric segments, total stripped length ≥ 5,
 * must contain at least one letter AND one digit.
 *
 * Matches:  4710KL-05W-B59 · HW1483880-A · 04010SA-12N-ATD · 1608KL-05W-B59
 * Rejects:  90-1400 (digits only) · "50/60Hz" · single-word tokens
 */
const PART_NUM_RE = /\b([A-Z0-9]{1,10}(?:-[A-Z0-9]{1,12}){1,8})\b/g;

function hasLetterAndDigit(s: string): boolean {
  return /[A-Z]/.test(s) && /[0-9]/.test(s);
}

export function extractPartNumbersRaw(text: string): string[] {
  const upper = text.toUpperCase();
  const seen = new Set<string>();
  const results: string[] = [];
  PART_NUM_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PART_NUM_RE.exec(upper)) !== null) {
    const raw = m[1];
    const stripped = raw.replace(/-/g, '');
    if (stripped.length >= 5 && hasLetterAndDigit(stripped) && !seen.has(raw)) {
      seen.add(raw);
      results.push(raw);
    }
  }
  return results;
}

/** Uppercase and strip dashes — canonical form for equality checks */
export function normalizePartNumber(raw: string): string {
  return raw.toUpperCase().replace(/-/g, '');
}

/** All segments except the last one.  "HW1483880-A" → "HW1483880" */
export function partNumberStem(raw: string): string {
  const segs = raw.split('-');
  return segs.length > 1 ? segs.slice(0, -1).join('-') : raw;
}

// ─── Levenshtein (space-efficient O(n·m)) ────────────────────────────────────

export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  const curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] =
        a[i - 1] === b[j - 1]
          ? prev[j - 1]
          : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    prev = [...curr];
  }
  return prev[n];
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

export interface PartNumberScore {
  /** 0–50 */
  points: number;
  reasons: string[];
  /**
   * True when BOTH sides carry part numbers but none overlap.
   * Caps total score to prevent a high-scoring title/brand pulling through
   * a wrong product (e.g. same brand, same voltage, different part family).
   */
  mutualMiss: boolean;
}

export function scorePartNumbers(
  queryRaw: string[],
  candidateRaw: string[],
): PartNumberScore {
  if (queryRaw.length === 0 && candidateRaw.length === 0) {
    return { points: 0, reasons: [], mutualMiss: false };
  }

  const qNorm = queryRaw.map(normalizePartNumber);
  const cNorm = candidateRaw.map(normalizePartNumber);

  // ── 1. Exact normalized match ─────────────────────────────────────────────
  for (const q of qNorm) {
    for (const c of cNorm) {
      if (q === c) {
        return { points: 50, reasons: [`Part# exact: ${q}`], mutualMiss: false };
      }
    }
  }

  // ── 2. Near match — Levenshtein 1 on codes ≥ 7 chars (typos / OCR errors)
  for (let qi = 0; qi < qNorm.length; qi++) {
    for (let ci = 0; ci < cNorm.length; ci++) {
      const q = qNorm[qi], c = cNorm[ci];
      if (q.length >= 7 && c.length >= 7 && levenshtein(q, c) === 1) {
        return {
          points: 28,
          reasons: [`Part# near-match (1 edit): ${queryRaw[qi]} ~ ${candidateRaw[ci]}`],
          mutualMiss: false,
        };
      }
    }
  }

  // ── 3. Stem match — same prefix, different last segment ──────────────────
  //    HW1483880-A vs HW1483880-B  →  stem "HW1483880" matches
  //    This is intentionally low-scored: it flags a variant mismatch without
  //    hard-blocking, letting the operator decide.
  const qStems = queryRaw.map(r => normalizePartNumber(partNumberStem(r)));
  const cStems = candidateRaw.map(r => normalizePartNumber(partNumberStem(r)));
  for (let qi = 0; qi < qStems.length; qi++) {
    for (let ci = 0; ci < cStems.length; ci++) {
      const qs = qStems[qi], cs = cStems[ci];
      if (qs.length >= 6 && qs === cs) {
        return {
          points: 10,
          reasons: [
            `Part# stem match (variant suffix differs): ${queryRaw[qi]} vs ${candidateRaw[ci]}`,
          ],
          mutualMiss: false,
        };
      }
    }
  }

  // ── 4. Mutual miss — both sides have part numbers but none overlap ────────
  if (queryRaw.length > 0 && candidateRaw.length > 0) {
    return {
      points: 0,
      reasons: [`Part# conflict: [${queryRaw.join(', ')}] ≠ [${candidateRaw.join(', ')}]`],
      mutualMiss: true,
    };
  }

  // One side has no part numbers — neutral, let other signals decide
  return { points: 0, reasons: [], mutualMiss: false };
}

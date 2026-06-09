import type { ParsedProduct, MatchResult, MatchConfidence } from './types';
import { scorePartNumbers } from './partNumber';
import { scoreSpecs } from './techSpecs';
import { scoreBrand } from './brandDetector';

/**
 * Scoring weights summary (max 100 pts):
 *
 *  Part number exact match          50
 *  Part number near-match (1 edit)  28
 *  Part number stem match           10
 *  Tech specs (per spec, see below) 46 total
 *    voltage / capacitance           8 each
 *    rpm                             6
 *    current / resistance            5 each
 *    dimensions                      5
 *    mah                             4
 *    power                           3
 *    frequency                       2
 *  Brand match                      10
 *  Title Jaccard similarity         15
 *
 * Hard blocks (returns UNMATCHED regardless of other scores):
 *   - Any conflicting spec value (voltage, capacitance, dimensions, …)
 *
 * Mutual-miss cap (score capped at 22 → LOW/UNMATCHED):
 *   - Both sides have part numbers but none overlap
 *
 * Confidence thresholds:
 *   EXACT     ≥ 90   (requires part# exact OR full-title exact)
 *   VERY_HIGH ≥ 70
 *   HIGH      ≥ 45
 *   MEDIUM    ≥ 30
 *   LOW       ≥ 18
 *   UNMATCHED  < 18
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

function jaccard(a: string, b: string): number {
  const ta = new Set(a.split(/\s+/).filter(t => t.length >= 2));
  const tb = new Set(b.split(/\s+/).filter(t => t.length >= 2));
  if (ta.size === 0 && tb.size === 0) return 1;
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

const THRESHOLDS: [number, MatchConfidence][] = [
  [90, 'EXACT'],
  [70, 'VERY_HIGH'],
  [45, 'HIGH'],
  [30, 'MEDIUM'],
  [18, 'LOW'],
];

function toConfidence(score: number): MatchConfidence {
  for (const [threshold, level] of THRESHOLDS) {
    if (score >= threshold) return level;
  }
  return 'UNMATCHED';
}

// ─── Main scorer ─────────────────────────────────────────────────────────────

export function computeScore(query: ParsedProduct, candidate: ParsedProduct): MatchResult {
  const reasons: string[] = [];

  // ── 1. Part numbers (0–50 pts) ───────────────────────────────────────────
  const pn = scorePartNumbers(query.partNumbersRaw, candidate.partNumbersRaw);
  reasons.push(...pn.reasons);

  // ── 2. Tech specs (0–46 pts, hard-block on conflict) ─────────────────────
  const sp = scoreSpecs(query.specs, candidate.specs);
  if (sp.conflict) {
    return { score: 0, confidence: 'UNMATCHED', reasons: [sp.conflict] };
  }
  reasons.push(...sp.reasons);

  // ── 3. Brand (0–10 pts) ──────────────────────────────────────────────────
  const br = scoreBrand(query.brand, candidate.brand);
  reasons.push(...br.reasons);

  // ── 4. Title Jaccard similarity (0–15 pts) ───────────────────────────────
  const sim = jaccard(query.normalized, candidate.normalized);
  const titlePts = Math.round(sim * 15);
  if (sim >= 0.25) reasons.push(`Title similarity: ${Math.round(sim * 100)}%`);

  // ── 5. Sum ────────────────────────────────────────────────────────────────
  let score = pn.points + sp.points + br.points + titlePts;

  // Cap below MEDIUM when both sides have part numbers but none matched —
  // forces operator review rather than auto-deducting wrong stock.
  if (pn.mutualMiss) score = Math.min(score, 22);

  score = Math.min(score, 100);

  // ── 6. Confidence ────────────────────────────────────────────────────────
  // An exact part-number hit is sufficient for EXACT — the part number IS the
  // product identity in electronics.  A high spec+brand+title score alone
  // (no part number) never reaches EXACT.
  let confidence: MatchConfidence;
  if (pn.points === 50 && score >= 60) {
    confidence = 'EXACT';
  } else {
    confidence = toConfidence(score);
    if (confidence === 'EXACT') {
      confidence = query.normalized === candidate.normalized ? 'EXACT' : 'VERY_HIGH';
    }
  }

  return { score, confidence, reasons };
}

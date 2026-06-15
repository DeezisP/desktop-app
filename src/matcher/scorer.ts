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
 *  Title Jaccard similarity         15  (electronics) | 65 (pure-title mode)
 *
 * Hard blocks (returns UNMATCHED regardless of other scores):
 *   - Any conflicting spec value (voltage, capacitance, dimensions, …)
 *   - Explicit colour conflict ("สีดำ" vs "สีขาว", "black" vs "red")
 *   - Explicit size conflict ("xl" vs "xxl", "large" vs "small")
 *
 * Mutual-miss cap (score capped at 22 → LOW/UNMATCHED):
 *   - Both sides have part numbers but none overlap
 *
 * Pure-title mode (activated when neither side has part numbers or tech specs):
 *   - Jaccard max raised from 15 → 65 so consumer goods can reach HIGH/VERY_HIGH
 *   - Identical normalised titles → EXACT even without a part number
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

// ─── Variant attribute conflict detection ─────────────────────────────────────
// Prevents colour/size mismatches from being presented as match candidates.
// The conflict only fires when BOTH sides carry an explicit, different token in
// the same category — one side being silent does not block the match.

const THAI_COLORS = ['ฟ้า', 'น้ำเงิน', 'น้ำตาล', 'ชมพู', 'ม่วง', 'ส้ม', 'เทา', 'เหลือง', 'เขียว', 'ขาว', 'ดำ', 'แดง', 'ทอง', 'เงิน', 'ครีม'] as const;
const EN_COLORS   = ['black', 'white', 'red', 'blue', 'green', 'yellow', 'pink', 'purple', 'orange', 'gray', 'grey', 'brown', 'gold', 'silver', 'navy', 'cream', 'beige'] as const;
// Longest patterns first so "2xl" regex doesn't partially match the "xl" portion.
const SIZES       = ['2xl', '3xl', 'xxl', 'xl', 'xs', 'large', 'medium', 'small', 'lg', 'md', 'sm'] as const;

function extractVariantTokens(normalized: string): { colors: Set<string>; sizes: Set<string> } {
  const colors = new Set<string>();
  const sizes  = new Set<string>();
  // Thai colours require the "สี" prefix to avoid false positives ("ดำ" in "ดำเนิน").
  for (const c of THAI_COLORS) {
    if (normalized.includes('สี' + c)) colors.add(c);
  }
  // English colours: word-boundary matching is reliable.
  for (const c of EN_COLORS) {
    if (new RegExp(`\\b${c}\\b`).test(normalized)) colors.add(c);
  }
  for (const s of SIZES) {
    if (new RegExp(`\\b${s}\\b`).test(normalized)) sizes.add(s);
  }
  return { colors, sizes };
}

function setsConflict(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false; // one side is silent → no conflict
  for (const v of a) if (b.has(v)) return false;  // any overlap → same variant, no conflict
  return true;                                      // both non-empty and fully disjoint → conflict
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

  // ── 3. Variant attribute conflict (hard-block) ───────────────────────────
  const qv = extractVariantTokens(query.normalized);
  const cv = extractVariantTokens(candidate.normalized);
  if (setsConflict(qv.colors, cv.colors)) {
    return { score: 0, confidence: 'UNMATCHED', reasons: ['Colour conflict'] };
  }
  if (setsConflict(qv.sizes, cv.sizes)) {
    return { score: 0, confidence: 'UNMATCHED', reasons: ['Size conflict'] };
  }

  // ── 4. Brand (0–10 pts) ──────────────────────────────────────────────────
  const br = scoreBrand(query.brand, candidate.brand);
  reasons.push(...br.reasons);

  // ── 5. Title Jaccard similarity ──────────────────────────────────────────
  // Pure-title mode: when neither side has electronics signals (part numbers
  // or extracted spec values), title similarity is the only match signal.
  // Raise its ceiling from 15 → 65 so consumer goods reach meaningful levels.
  const hasQuerySignals     = query.partNumbers.length > 0 || Object.keys(query.specs).length > 0;
  const hasCandidateSignals = candidate.partNumbers.length > 0 || Object.keys(candidate.specs).length > 0;
  const pureTitleMode       = !hasQuerySignals && !hasCandidateSignals;

  const sim       = jaccard(query.normalized, candidate.normalized);
  const jaccardMax = pureTitleMode ? 65 : 15;
  const titlePts  = Math.round(sim * jaccardMax);
  if (sim >= 0.25) reasons.push(`Title similarity: ${Math.round(sim * 100)}%`);

  // ── 6. Sum ────────────────────────────────────────────────────────────────
  let score = pn.points + sp.points + br.points + titlePts;

  // Cap below MEDIUM when both sides have part numbers but none matched —
  // forces operator review rather than auto-deducting wrong stock.
  if (pn.mutualMiss) score = Math.min(score, 22);

  score = Math.min(score, 100);

  // ── 7. Confidence ────────────────────────────────────────────────────────
  let confidence: MatchConfidence;
  if (pn.points === 50 && score >= 60) {
    confidence = 'EXACT';
  } else {
    confidence = toConfidence(score);
    if (confidence === 'EXACT') {
      confidence = query.normalized === candidate.normalized ? 'EXACT' : 'VERY_HIGH';
    }
  }

  // In pure-title mode, identical normalised titles → EXACT even without a
  // part number ("สายชาร์จ USB-C สีดำ 1m" == "สายชาร์จ USB-C สีดำ 1m").
  if (pureTitleMode && query.normalized.length > 0 && query.normalized === candidate.normalized) {
    confidence = 'EXACT';
  }

  return { score, confidence, reasons };
}

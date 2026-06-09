/**
 * Produces a lowercase, space-tokenised string for Jaccard similarity.
 *
 * Key rules:
 *  - Decimal numbers preserved:  "0.022uF"  → "0.022uf"
 *  - VDC/V DC collapsed to "v":  "24VDC"    → "24v"
 *  - Separators → space:         "100UF-16V" → "100uf 16v"
 *  - Unicode aliases applied:    "µ"→"u",  "Ω"→"ohm",  "×"→"x"
 *  - Thai digit boundaries kept: "2จังหวะ"  → "2 จังหวะ"
 */
export function normalizeTitle(text: string): string {
  if (!text) return '';
  return (
    text
      // ── Unicode aliases ──────────────────────────────────────────────────
      .replace(/[µμ]/g, 'u')
      .replace(/Ω/g, 'ohm')
      .replace(/[×✕]/g, 'x')
      .replace(/\*/g, 'x')
      .toLowerCase()
      // ── Unit aliases (before stripping punctuation) ──────────────────────
      .replace(/\bvdc\b/g, 'v')
      .replace(/\bv\s+dc\b/g, 'v')
      // ── Separators → space (keep "." for decimals) ───────────────────────
      .replace(/[_\-/\\,]/g, ' ')
      // ── Strip non-alphanumeric/Thai/dot/space ────────────────────────────
      .replace(/[^a-z0-9ก-๙.\s]/g, '')
      // ── Dots that are NOT decimal points → space ─────────────────────────
      .replace(/\.(?!\d)/g, ' ')
      .replace(/(?<!\d)\./g, ' ')
      // ── Thai ↔ digit boundaries ──────────────────────────────────────────
      .replace(/(?<=[0-9])(?=[ก-๙])/g, ' ')
      .replace(/(?<=[ก-๙])(?=[0-9])/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

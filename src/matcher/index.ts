/**
 * ElectronicsProductMatcher — client-side electronics matching engine.
 *
 * Usage:
 *   const matcher = new ElectronicsProductMatcher();
 *   matcher.loadCatalog(warehouseProducts);          // call after every sync
 *   const hit = matcher.findBestMatch('NMB 4710KL-05W-B59 24VDC', '');
 *
 * Performance (50 000 products, pre-parsed):
 *   loadCatalog  ~200 ms   (parse once, store in Map)
 *   findBestMatch ~50 ms   (score all, no index needed at this scale)
 *   findTopMatches same
 */

export type { MatchConfidence, TechSpecs, ParsedProduct, MatchResult, ProductRecord, ScoredCandidate } from './types';
export { normalizeTitle }                    from './normalizer';
export { extractPartNumbersRaw, normalizePartNumber, levenshtein } from './partNumber';
export { extractSpecs }                      from './techSpecs';
export { detectBrand }                       from './brandDetector';
export { computeScore }                      from './scorer';

import type { MatchConfidence, ParsedProduct, MatchResult, ProductRecord, ScoredCandidate } from './types';
import { normalizeTitle }    from './normalizer';
import { extractPartNumbersRaw, normalizePartNumber } from './partNumber';
import { extractSpecs }      from './techSpecs';
import { detectBrand }       from './brandDetector';
import { computeScore }      from './scorer';

// ─── Parse ────────────────────────────────────────────────────────────────────

export function parseProduct(title: string, variant?: string): ParsedProduct {
  const combined = variant?.trim() ? `${title} ${variant.trim()}` : title;
  const raw = extractPartNumbersRaw(combined);
  return {
    original: combined,
    normalized: normalizeTitle(combined),
    partNumbers: raw.map(normalizePartNumber),
    partNumbersRaw: raw,
    brand: detectBrand(combined),
    specs: extractSpecs(combined),
  };
}

// ─── In-memory index ─────────────────────────────────────────────────────────

const CONFIDENCE_RANK: Record<MatchConfidence, number> = {
  EXACT: 5, VERY_HIGH: 4, HIGH: 3, MEDIUM: 2, LOW: 1, UNMATCHED: 0,
};

interface IndexedProduct {
  record: ProductRecord;
  parsed: ParsedProduct;
}

export class ElectronicsProductMatcher {
  private catalog = new Map<number, IndexedProduct>();

  /**
   * Pre-parse all warehouse products.
   * Call after every WooCommerce sync (~200 ms for 50 k products).
   */
  loadCatalog(products: ProductRecord[]): void {
    this.catalog.clear();
    for (const p of products) {
      this.catalog.set(p.id, { record: p, parsed: parseProduct(p.title) });
    }
  }

  get size(): number {
    return this.catalog.size;
  }

  /**
   * Returns the single best match, or null when nothing reaches LOW (score < 18).
   * Safe to use for automatic stock deduction at VERY_HIGH or EXACT.
   */
  findBestMatch(productName: string, variant?: string): ScoredCandidate | null {
    const query = parseProduct(productName, variant);
    let bestScore = -1;
    let best: ScoredCandidate | null = null;

    for (const { record, parsed } of this.catalog.values()) {
      const result = computeScore(query, parsed);
      if (result.confidence !== 'UNMATCHED' && result.score > bestScore) {
        bestScore = result.score;
        best = { product: record, result };
      }
    }
    return best;
  }

  /**
   * Returns the top N candidates above minConfidence, sorted by score desc.
   * Useful for presenting match candidates in the operator review UI.
   */
  findTopMatches(
    productName: string,
    variant?: string,
    options: { top?: number; minConfidence?: MatchConfidence } = {},
  ): ScoredCandidate[] {
    const { top = 5, minConfidence = 'LOW' } = options;
    const minRank = CONFIDENCE_RANK[minConfidence];
    const query = parseProduct(productName, variant);
    const hits: ScoredCandidate[] = [];

    for (const { record, parsed } of this.catalog.values()) {
      const result = computeScore(query, parsed);
      if (CONFIDENCE_RANK[result.confidence] >= minRank) {
        hits.push({ product: record, result });
      }
    }

    return hits.sort((a, b) => b.result.score - a.result.score).slice(0, top);
  }

  /** Expose raw result for a specific product (useful in unit tests) */
  scoreAgainst(productName: string, candidateTitle: string, variant?: string): MatchResult {
    const query = parseProduct(productName, variant);
    const candidate = parseProduct(candidateTitle);
    return computeScore(query, candidate);
  }
}

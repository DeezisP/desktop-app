export type MatchConfidence =
  | 'EXACT'
  | 'VERY_HIGH'
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'UNMATCHED';

export interface TechSpecs {
  /** Volts; ac=false means DC */
  voltage?: { value: number; ac: boolean };
  /** Amperes */
  current?: number;
  /** Picofarads (normalized from pF / nF / uF / mF) */
  capacitance?: number;
  /** Ohms (normalized from Ω / kΩ / MΩ) */
  resistance?: number;
  /** Watts */
  power?: number;
  rpm?: number;
  /** Milliamp-hours */
  mah?: number;
  /** Sorted mm values, e.g. [15, 40, 40] for a 40x40x15 fan */
  dimensions?: number[];
  /** Hertz */
  frequency?: number;
}

export interface ParsedProduct {
  original: string;
  /** Lowercase, space-tokenised — used for Jaccard similarity */
  normalized: string;
  /** Uppercase, dash-stripped — for O(1) equality checks */
  partNumbers: string[];
  /** Original form with dashes — for display and stem comparisons */
  partNumbersRaw: string[];
  brand?: string;
  specs: TechSpecs;
}

export interface MatchResult {
  /** 0–100 */
  score: number;
  confidence: MatchConfidence;
  reasons: string[];
}

export interface ProductRecord {
  id: number;
  title: string;
  sku?: string;
}

export interface ScoredCandidate {
  product: ProductRecord;
  result: MatchResult;
}

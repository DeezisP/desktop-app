/**
 * Code 128B encoder.
 * Supports full printable ASCII 0x20–0x7E (space through tilde).
 * Returns an array of module widths: [bar, space, bar, space, …]
 * starting and ending with a bar. Use quiet zones (≥10 modules) on both sides.
 *
 * Reference: ISO/IEC 15417 / GS1 General Specifications
 * Each symbol = 3 bars + 3 spaces = 11 modules (data); Stop = 13 modules.
 */

// Symbol patterns indexed 0–105 + stop.
// Each entry: [bar, space, bar, space, bar, space] widths (sum = 11).
// Indices 0–94  → Code B values (char code 32–126)
// Indices 95–102 → special functions / code-switches
// Index  103    → Start A
// Index  104    → Start B  ← we use this
// Index  105    → Start C
const SYM: readonly number[][] = [
  [2,1,2,2,2,2],[2,2,2,1,2,2],[2,2,2,2,2,1],[1,2,1,2,2,3],[1,2,1,3,2,2], //  0– 4
  [1,3,1,2,2,2],[1,2,2,2,1,3],[1,2,2,3,1,2],[1,3,2,2,1,2],[2,2,1,2,1,3], //  5– 9
  [2,2,1,3,1,2],[2,3,1,2,1,2],[1,1,2,2,3,2],[1,2,2,1,3,2],[1,2,2,2,3,1], // 10–14
  [1,1,3,2,2,2],[1,2,3,1,2,2],[1,2,3,2,2,1],[2,2,3,2,1,1],[2,2,1,1,3,2], // 15–19
  [2,2,1,2,3,1],[2,1,3,2,1,2],[2,2,3,1,1,2],[3,1,2,1,3,1],[3,1,1,2,2,2], // 20–24
  [3,2,1,1,2,2],[3,2,1,2,2,1],[3,1,2,2,1,2],[3,2,2,1,1,2],[3,2,2,2,1,1], // 25–29
  [2,1,2,1,2,3],[2,1,2,3,2,1],[2,3,2,1,2,1],[1,1,1,3,2,3],[1,3,1,1,2,3], // 30–34
  [1,3,1,3,2,1],[1,1,2,3,1,3],[1,3,2,1,1,3],[1,3,2,3,1,1],[2,1,1,3,1,3], // 35–39
  [2,3,1,1,1,3],[2,3,1,3,1,1],[1,1,2,1,3,3],[1,1,2,3,3,1],[1,3,2,1,3,1], // 40–44
  [1,1,3,1,2,3],[1,1,3,3,2,1],[1,3,3,1,2,1],[3,1,3,1,2,1],[2,1,1,3,3,1], // 45–49
  [2,3,1,1,3,1],[2,1,3,1,1,3],[2,1,3,3,1,1],[2,1,3,1,3,1],[3,1,1,1,2,3], // 50–54
  [3,1,1,3,2,1],[3,3,1,1,2,1],[3,1,2,1,1,3],[3,1,2,3,1,1],[3,3,2,1,1,1], // 55–59
  [3,1,4,1,1,1],[2,2,1,4,1,1],[4,3,1,1,1,1],[1,1,1,2,2,4],[1,1,1,4,2,2], // 60–64
  [1,2,1,1,2,4],[1,2,1,4,2,1],[1,4,1,1,2,2],[1,4,1,2,2,1],[1,1,2,2,1,4], // 65–69
  [1,1,2,4,1,2],[1,2,2,1,1,4],[1,2,2,4,1,1],[1,4,2,1,1,2],[1,4,2,2,1,1], // 70–74
  [2,4,1,2,1,1],[2,2,1,1,1,4],[4,1,3,1,1,1],[2,4,1,1,1,2],[1,3,4,1,1,1], // 75–79
  [1,1,1,2,4,2],[1,2,1,1,4,2],[1,2,1,2,4,1],[1,1,4,2,1,2],[1,2,4,1,1,2], // 80–84
  [1,2,4,2,1,1],[4,1,1,2,1,2],[4,2,1,1,1,2],[4,2,1,2,1,1],[2,1,2,1,4,1], // 85–89
  [2,1,4,1,2,1],[4,1,2,1,2,1],[1,1,1,1,4,3],[1,1,1,3,4,1],[1,3,1,1,4,1], // 90–94
  [1,1,4,1,1,3],[1,1,4,3,1,1],[4,1,1,1,1,3],[4,1,1,3,1,1],[1,1,3,1,4,1], // 95–99
  [1,1,4,1,3,1],[3,1,1,1,4,1],[4,1,1,1,3,1],[2,1,1,4,1,2],[2,1,1,2,1,4], // 100–104
  [2,1,1,2,3,2],                                                           // 105 Start C
];
const STOP = [2,3,3,1,1,1,2]; // 13 modules

/** Encode a string using Code 128B. Returns module-width array (bar, space, …). */
export function encodeCode128B(text: string): number[] {
  const widths: number[] = [];

  // Start B (index 104)
  widths.push(...SYM[104]);
  let checksum = 104;

  for (let i = 0; i < text.length; i++) {
    const cc = text.charCodeAt(i);
    if (cc < 32 || cc > 126) continue; // outside Code 128B range → skip
    const val = cc - 32;               // 0 = space, 94 = '~'
    widths.push(...SYM[val]);
    checksum += (i + 1) * val;
  }

  // Check character
  widths.push(...SYM[checksum % 103]);

  // Stop
  widths.push(...STOP);

  return widths;
}

/** Total module count for a given encoded width array (used to size the SVG). */
export function totalModules(widths: number[]): number {
  return widths.reduce((s, w) => s + w, 0);
}

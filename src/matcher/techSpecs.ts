import type { TechSpecs } from './types';

/**
 * 2% tolerance handles marketplace rounding: "23.9V" ≈ "24V".
 * It will NOT bridge 12V↔24V or 0.022uF↔0.047uF.
 */
const TOLERANCE = 0.02;

// ─── Unit converters ─────────────────────────────────────────────────────────

function toFarads(value: number, prefix: string): number {
  switch (prefix.toLowerCase()) {
    case 'p':             return value;           // picofarad
    case 'n':             return value * 1e3;     // nanofarad  → pF
    case 'u': case 'µ':  return value * 1e6;     // microfarad → pF
    case 'm':             return value * 1e9;     // millifarad → pF
    default:              return value * 1e12;    // bare F (very rare in electronics)
  }
}

function toOhms(value: number, prefix: string): number {
  switch (prefix.toLowerCase()) {
    case 'k':             return value * 1e3;
    case 'm':             return value * 1e6;
    case 'g':             return value * 1e9;
    default:              return value;
  }
}

// ─── Extraction ──────────────────────────────────────────────────────────────

/**
 * Extract structured technical specifications from a raw product title.
 *
 * Design notes:
 *  - Voltage:    24VDC → {24, false};  220VAC → {220, true}
 *  - Capacitance:normalised to picofarads so 0.022uF = 22000pF = 22nF
 *  - Power:      look-behind/look-ahead prevents matching "05W" inside a
 *                part number segment like "KL-05W-B59"
 *  - Dimensions: values sorted ascending so "40x15" == "15x40"
 */
export function extractSpecs(raw: string): TechSpecs {
  const specs: TechSpecs = {};
  const t = raw
    .replace(/[µμ]/g, 'u')
    .replace(/Ω/g, 'ohm')
    .replace(/[×✕]/g, 'x')
    .replace(/\*/g, 'x');

  // ── Voltage ────────────────────────────────────────────────────────────────
  // Handles: 24VDC · 24V DC · 24V · 220VAC · 3.3V
  const vM = /(?<!\w)(\d+(?:\.\d+)?)\s*V(?:(DC|dc)|(AC|ac))?\b/.exec(t);
  if (vM) {
    const raw_ac = (vM[3] ?? '').toUpperCase();
    const raw_dc = (vM[2] ?? '').toUpperCase();
    specs.voltage = {
      value: parseFloat(vM[1]),
      // explicit AC wins; explicit DC is false; bare V defaults to DC for low
      // voltages (≤60 V) and AC for high voltages (>60 V, e.g. 220V mains)
      ac: raw_ac === 'AC' ? true : raw_dc === 'DC' ? false : parseFloat(vM[1]) > 60,
    };
  }

  // ── Current ────────────────────────────────────────────────────────────────
  // Handles: 0.18A · 100mA  — negative look-ahead prevents matching "mAh"
  const aM = /(\d+(?:\.\d+)?)\s*(m)?A\b(?!h)/i.exec(t);
  if (aM) {
    specs.current = parseFloat(aM[1]) * (aM[2] ? 1e-3 : 1);
  }

  // ── Capacitance ────────────────────────────────────────────────────────────
  // Handles: 100uF · 0.022uF · 22pF · 10nF · 100µF · 1mF
  const cM = /(\d+(?:\.\d+)?)\s*(p|n|u|µ|m)F\b/i.exec(t);
  if (cM) {
    specs.capacitance = toFarads(parseFloat(cM[1]), cM[2]);
  }

  // ── Resistance ─────────────────────────────────────────────────────────────
  // Handles: 10kohm · 4.7K · 100ohm · 1Mohm · 1MΩ
  const rM = /(\d+(?:\.\d+)?)\s*(k|M|G)?(?:ohm|Ω)\b/i.exec(t);
  if (rM) {
    specs.resistance = toOhms(parseFloat(rM[1]), rM[2] ?? '');
  }
  // European notation: 4K7 = 4700 Ω,  2R2 = 2.2 Ω
  if (!specs.resistance) {
    const rEuM = /\b(\d+)(K)(\d)\b/i.exec(t);
    if (rEuM) {
      specs.resistance = (parseFloat(rEuM[1]) + parseFloat(rEuM[3]) / 10) * 1e3;
    }
  }

  // ── Power ──────────────────────────────────────────────────────────────────
  // Handles: 10W · 0.5W · 250W
  // Guards:
  //   look-behind  (?<![A-Z0-9\-])  prevents "05W" inside part-number segment
  //   look-ahead   (?![A-Z0-9\-])   prevents matching "W" followed by more code
  const wM = /(?<![A-Z0-9\-])(\d+(?:\.\d+)?)\s*W\b(?![A-Z0-9\-])/i.exec(t);
  if (wM) {
    specs.power = parseFloat(wM[1]);
  }

  // ── RPM ────────────────────────────────────────────────────────────────────
  const rpmM = /(\d+(?:\.\d+)?)\s*RPM\b/i.exec(t);
  if (rpmM) specs.rpm = parseFloat(rpmM[1]);

  // ── mAh ────────────────────────────────────────────────────────────────────
  const mahM = /(\d+(?:\.\d+)?)\s*mAh\b/i.exec(t);
  if (mahM) specs.mah = parseFloat(mahM[1]);

  // ── Dimensions ─────────────────────────────────────────────────────────────
  // Handles: 40x40x15mm · 80x25mm · 92x92x25
  const dimM = /(\d+)\s*x\s*(\d+)(?:\s*x\s*(\d+))?\s*m{0,2}\b/i.exec(t);
  if (dimM) {
    const dims = [parseInt(dimM[1]), parseInt(dimM[2])];
    if (dimM[3]) dims.push(parseInt(dimM[3]));
    specs.dimensions = dims.sort((a, b) => a - b);
  }

  // ── Frequency ──────────────────────────────────────────────────────────────
  const hzM = /(\d+)\s*Hz\b/i.exec(t);
  if (hzM) specs.frequency = parseFloat(hzM[1]);

  return specs;
}

// ─── Comparison ──────────────────────────────────────────────────────────────

function conflicts(a: number, b: number): boolean {
  const max = Math.max(Math.abs(a), Math.abs(b));
  if (max === 0) return false;
  return Math.abs(a - b) / max > TOLERANCE;
}

function dimConflicts(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return true;
  return a.some((v, i) => conflicts(v, b[i]));
}

export interface SpecScore {
  /** 0–46 (voltage 8, capacitance 8, current 5, resistance 5, rpm 6,
   *        dimensions 5, mah 4, power 3, frequency 2) */
  points: number;
  reasons: string[];
  /** Non-null = hard block → return UNMATCHED immediately, regardless of other scores */
  conflict: string | null;
}

export function scoreSpecs(q: TechSpecs, c: TechSpecs): SpecScore {
  const reasons: string[] = [];
  let points = 0;

  // A spec is only compared when BOTH sides have a value.
  // A missing spec on one side is not a conflict — the marketplace listing
  // may simply omit it.

  if (q.voltage !== undefined && c.voltage !== undefined) {
    if (conflicts(q.voltage.value, c.voltage.value))
      return { points: 0, reasons: [], conflict: `Voltage: ${q.voltage.value}V ≠ ${c.voltage.value}V` };
    if (q.voltage.ac !== c.voltage.ac)
      return { points: 0, reasons: [], conflict: `Voltage type: ${q.voltage.ac ? 'AC' : 'DC'} ≠ ${c.voltage.ac ? 'AC' : 'DC'}` };
    points += 8; reasons.push(`Voltage: ${q.voltage.value}V${q.voltage.ac ? 'AC' : 'DC'}`);
  }

  if (q.capacitance !== undefined && c.capacitance !== undefined) {
    if (conflicts(q.capacitance, c.capacitance))
      return { points: 0, reasons: [], conflict: `Capacitance: ${q.capacitance}pF ≠ ${c.capacitance}pF` };
    points += 8; reasons.push(`Capacitance: ${q.capacitance}pF`);
  }

  if (q.current !== undefined && c.current !== undefined) {
    if (conflicts(q.current, c.current))
      return { points: 0, reasons: [], conflict: `Current: ${q.current}A ≠ ${c.current}A` };
    points += 5; reasons.push(`Current: ${q.current}A`);
  }

  if (q.resistance !== undefined && c.resistance !== undefined) {
    if (conflicts(q.resistance, c.resistance))
      return { points: 0, reasons: [], conflict: `Resistance: ${q.resistance}Ω ≠ ${c.resistance}Ω` };
    points += 5; reasons.push(`Resistance: ${q.resistance}Ω`);
  }

  if (q.rpm !== undefined && c.rpm !== undefined) {
    if (conflicts(q.rpm, c.rpm))
      return { points: 0, reasons: [], conflict: `RPM: ${q.rpm} ≠ ${c.rpm}` };
    points += 6; reasons.push(`RPM: ${q.rpm}`);
  }

  if (q.dimensions !== undefined && c.dimensions !== undefined) {
    if (dimConflicts(q.dimensions, c.dimensions))
      return { points: 0, reasons: [], conflict: `Dimensions: [${q.dimensions.join('x')}]mm ≠ [${c.dimensions.join('x')}]mm` };
    points += 5; reasons.push(`Dimensions: [${q.dimensions.join('x')}]mm`);
  }

  if (q.mah !== undefined && c.mah !== undefined) {
    if (conflicts(q.mah, c.mah))
      return { points: 0, reasons: [], conflict: `mAh: ${q.mah} ≠ ${c.mah}` };
    points += 4; reasons.push(`mAh: ${q.mah}`);
  }

  if (q.power !== undefined && c.power !== undefined) {
    if (conflicts(q.power, c.power))
      return { points: 0, reasons: [], conflict: `Power: ${q.power}W ≠ ${c.power}W` };
    points += 3; reasons.push(`Power: ${q.power}W`);
  }

  if (q.frequency !== undefined && c.frequency !== undefined) {
    if (conflicts(q.frequency, c.frequency))
      return { points: 0, reasons: [], conflict: `Frequency: ${q.frequency}Hz ≠ ${c.frequency}Hz` };
    points += 2; reasons.push(`Frequency: ${q.frequency}Hz`);
  }

  return { points, reasons, conflict: null };
}

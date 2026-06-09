/**
 * Industrial electronics brand detection.
 *
 * Multi-word brands are listed before their single-word components to ensure
 * "SANYO DENKI" is preferred over a bare "SANYO" match.
 * The array is sorted longest-first at module load for the same reason.
 */
const BRANDS: readonly string[] = [
  'SANYO DENKI', 'SANYODENKI',
  'ORIENTAL MOTOR', 'ORIENTALMOTOR',
  'PHOENIX CONTACT',
  'TE CONNECTIVITY',
  'EBM-PAPST', 'EBMPAPST',
  'MEAN WELL', 'MEANWELL',
  'NMB', 'SUNON', 'DELTA', 'YASKAWA', 'WIMA',
  'OMRON', 'PANASONIC', 'MITSUBISHI', 'SIEMENS',
  'SCHNEIDER', 'ABB', 'NIDEC', 'MINEBEA',
  'COSEL', 'TDK', 'MURATA', 'KEMET',
  'VISHAY', 'BOURNS', 'MOLEX', 'HIROSE', 'JST',
  'SICK', 'KEYENCE', 'BANNER', 'BALLUFF',
  'IDEC', 'FUJI', 'EATON', 'ROCKWELL',
  'WAGO', 'PILZ', 'TURCK', 'IFM',
  'CHROMA', 'IOTECH', 'COGNEX',
].sort((a, b) => b.length - a.length);

// Pre-compile regexes once at module load
const BRAND_MATCHERS = BRANDS.map(brand => ({
  name: brand,
  re: new RegExp(`(?:^|[\\s(])${brand.replace(/[-\s]+/g, '[\\s\\-]+')}(?:[\\s),]|$)`, 'i'),
}));

export function detectBrand(text: string): string | undefined {
  for (const { name, re } of BRAND_MATCHERS) {
    if (re.test(text)) return name;
  }
  return undefined;
}

export function scoreBrand(
  queryBrand: string | undefined,
  candidateBrand: string | undefined,
): { points: number; reasons: string[] } {
  if (!queryBrand || !candidateBrand) return { points: 0, reasons: [] };
  if (queryBrand.toUpperCase() === candidateBrand.toUpperCase()) {
    return { points: 10, reasons: [`Brand: ${queryBrand}`] };
  }
  return { points: 0, reasons: [] };
}

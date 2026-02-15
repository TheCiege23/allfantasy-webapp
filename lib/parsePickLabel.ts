/**
 * Parse pick labels from various string formats into structured data
 * Examples it handles:
 * - "2026 3rd Rd"
 * - "2025 4th"
 * - "2025 1st Round"
 * - "2026 2nd Rd (TheCiege24)"
 * - "2025 Early 1st"
 * - "2026 Mid 2nd"
 * - "2024 Late 3rd"
 */

export type ParsedPick = {
  year: number;
  round: 1 | 2 | 3 | 4 | 5;
  bucket?: 'early' | 'mid' | 'late';
};

export function parsePickLabel(label: string): ParsedPick | null {
  if (!label || typeof label !== 'string') return null;
  
  const clean = label.replace(/\([^)]*\)/g, '').trim();
  
  const m = clean.match(/(20\d{2})(?:\s+(early|mid|late))?\s*(1st|2nd|3rd|4th|5th)/i);
  if (!m) return null;

  const year = Number(m[1]);
  const bucketRaw = m[2]?.toLowerCase() as 'early' | 'mid' | 'late' | undefined;
  const ord = m[3].toLowerCase();

  const round = (
    ord === '1st' ? 1 :
    ord === '2nd' ? 2 :
    ord === '3rd' ? 3 :
    ord === '4th' ? 4 : 5
  ) as 1 | 2 | 3 | 4 | 5;

  const result: ParsedPick = { year, round };
  if (bucketRaw) {
    result.bucket = bucketRaw;
  }
  
  return result;
}

export function formatPickForHistorical(parsed: ParsedPick): {
  year: number;
  round: number;
  tier: 'early' | 'mid' | 'late' | undefined;
} {
  return {
    year: parsed.year,
    round: parsed.round,
    tier: parsed.bucket
  };
}

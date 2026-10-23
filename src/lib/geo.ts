/**
 * Geographic calculations and Tehran Shopping Hubs (راسته بازارهای تهران).
 */

export function calculateDistanceKm(
  lat1: number | null,
  lon1: number | null,
  lat2: number | null,
  lon2: number | null
): number | null {
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) {
    return null;
  }
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Extracts floor, unit or mall name from Persian address string.
 */
export function extractAddressFloorUnit(address: string | null | undefined): string | null {
  if (!address) return null;
  const parts: string[] = [];

  // Match mall/passage
  const mallMatch = address.match(/(?:پاساژ|مجتمع|مرکز خرید)\s+([^\s،,]+)/);
  if (mallMatch) {
    parts.push(mallMatch[0]);
  }

  // Match floor
  const floorMatch = address.match(/(?:طبقه|همکف|زیرهمکف)\s*([^\s،,]+)?/);
  if (floorMatch) {
    parts.push(floorMatch[0]);
  }

  // Match unit/plaque
  const unitMatch = address.match(/(?:واحد|پلاک)\s*([۰-۹0-9]+)/);
  if (unitMatch) {
    parts.push(unitMatch[0]);
  }

  return parts.length > 0 ? parts.join("، ") : null;
}


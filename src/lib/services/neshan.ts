/**
 * Official Neshan (نشان) Platform Services.
 * Provides live traffic routing, distance matrix, and ETA calculations for Tehran stores.
 */

const NESHAN_SERVICE_KEY = process.env.NESHAN_SERVICE_KEY || "service.NESHAN_SERVICE_KEY_REMOVED";

export interface LiveRouteResult {
  distance_km: number;
  duration_minutes: number;
  traffic_summary: string;
  eta_formatted: string;
}

// In-memory cache for live routing calls to optimize performance and rate limits
const routeCache = new Map<string, { data: LiveRouteResult; expiry: number }>();

export async function getLiveTrafficRoute(
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number
): Promise<LiveRouteResult | null> {
  const cacheKey = `${originLat.toFixed(4)},${originLon.toFixed(4)}->${destLat.toFixed(4)},${destLon.toFixed(4)}`;
  const now = Date.now();

  const cached = routeCache.get(cacheKey);
  if (cached && cached.expiry > now) {
    return cached.data;
  }

  try {
    const url = `https://api.neshan.org/v4/direction?type=car&origin=${originLat},${originLon}&destination=${destLat},${destLon}`;
    const resp = await fetch(url, {
      headers: {
        "Api-Key": NESHAN_SERVICE_KEY,
      },
      next: { revalidate: 300 }, // Cache 5 min
    });

    if (!resp.ok) {
      console.warn("Neshan Direction API failed with status:", resp.status);
      return null;
    }

    const data = await resp.json();
    if (!data.routes || data.routes.length === 0) {
      return null;
    }

    const leg = data.routes[0].legs[0];
    const distMeters = leg?.distance?.value || 0;
    const durSeconds = leg?.duration?.value || 0;
    const summary = leg?.summary || "خیابان جمهوری";

    const distKm = Math.round((distMeters / 1000) * 10) / 10;
    const durMin = Math.max(1, Math.round(durSeconds / 60));

    const result: LiveRouteResult = {
      distance_km: distKm,
      duration_minutes: durMin,
      traffic_summary: summary,
      eta_formatted: `${durMin} دقیقه با ترافیک زنده (${distKm} کیلومتر رانندگی)`,
    };

    routeCache.set(cacheKey, { data: result, expiry: now + 300000 });
    return result;
  } catch (error) {
    console.error("Neshan routing error:", error);
    return null;
  }
}

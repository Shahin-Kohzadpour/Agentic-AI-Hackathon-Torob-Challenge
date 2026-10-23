/**
 * Official Neshan (نشان) Platform Services.
 * Fully integrates Neshan Routing, Distance Matrix, Reverse Geocoding (Traffic Zones),
 * and Pedestrian Navigation APIs.
 */

const NESHAN_SERVICE_KEY = process.env.NESHAN_SERVICE_KEY || "";

export interface LiveRouteResult {
  distance_km: number;
  duration_minutes: number;
  traffic_summary: string;
  eta_formatted: string;
}

export interface StoreLocationContext {
  neighbourhood: string;
  municipality_zone: string;
  formatted_address: string;
  in_traffic_zone: boolean; // داخل طرح ترافیک تهران
  in_odd_even_zone: boolean; // داخل طرح کنترل آلودگی هوا
}

export interface PedestrianRouteResult {
  walking_distance_meters: number;
  walking_duration_minutes: number;
  formatted: string;
}

// 1. Live Car Routing with Traffic
export async function getLiveTrafficRoute(
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number
): Promise<LiveRouteResult | null> {
  try {
    if (!NESHAN_SERVICE_KEY) return null;
    const url = `https://api.neshan.org/v4/direction?type=car&origin=${originLat},${originLon}&destination=${destLat},${destLon}`;
    const resp = await fetch(url, {
      headers: { "Api-Key": NESHAN_SERVICE_KEY },
      signal: AbortSignal.timeout(3500),
      cache: "no-store",
    });

    if (!resp.ok) return null;

    const data = await resp.json();
    if (!data.routes || data.routes.length === 0) return null;

    const leg = data.routes[0].legs[0];
    const distMeters = leg?.distance?.value;
    const durSeconds = leg?.duration?.value;
    if(!Number.isFinite(distMeters)||!Number.isFinite(durSeconds)||distMeters<0||durSeconds<0)return null;
    const summary = leg?.summary || "خیابان جمهوری";

    const distKm = Math.round((distMeters / 1000) * 10) / 10;
    const durMin = Math.ceil(durSeconds / 60);

    return {
      distance_km: distKm,
      duration_minutes: durMin,
      traffic_summary: summary,
      eta_formatted: `${durMin} دقیقه با ترافیک زنده (${distKm} کیلومتر)`,
    };
  } catch {
    console.warn("Neshan service unavailable");
    return null;
  }
}

// 2. Pedestrian Walking Route (مسیریابی پیاده نشان)
export async function getPedestrianRoute(
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number
): Promise<PedestrianRouteResult | null> {
  try {
    if (!NESHAN_SERVICE_KEY) return null;
    const url = `https://api.neshan.org/v4/direction?type=pedestrian&origin=${originLat},${originLon}&destination=${destLat},${destLon}`;
    const resp = await fetch(url, {
      headers: { "Api-Key": NESHAN_SERVICE_KEY },
      signal: AbortSignal.timeout(3500),
      cache: "no-store",
    });

    if (!resp.ok) return null;

    const data = await resp.json();
    if (!data.routes || data.routes.length === 0) return null;

    const leg = data.routes[0].legs[0];
    const distMeters = leg?.distance?.value;
    const durSeconds = leg?.duration?.value;
    if(!Number.isFinite(distMeters)||!Number.isFinite(durSeconds)||distMeters<0||durSeconds<0)return null;
    const durMin = Math.ceil(durSeconds / 60);

    return {
      walking_distance_meters: distMeters,
      walking_duration_minutes: durMin,
      formatted: `${durMin} دقیقه پیاده‌روی (${distMeters} متر)`,
    };
  } catch {
    console.warn("Neshan service unavailable");
    return null;
  }
}

// 3. Batch Distance Matrix API (ماتریس فاصله برای چند فروشگاه در یک درخواست)
export async function getBatchDistanceMatrix(
  originLat: number,
  originLon: number,
  destinations: Array<{ lat: number; lon: number }>
): Promise<Array<{ distance_km: number; duration_minutes: number } | null>> {
  if (destinations.length === 0) return [];

  const destStr = destinations.map((d) => `${d.lat},${d.lon}`).join("|");
  const url = `https://api.neshan.org/v1/distance-matrix?origins=${originLat},${originLon}&destinations=${destStr}&type=car`;

  try {
    const resp = await fetch(url, {
      headers: { "Api-Key": NESHAN_SERVICE_KEY },
      signal: AbortSignal.timeout(3500),
      cache: "no-store",
    });

    if (!resp.ok) return destinations.map(() => null);

    const data = await resp.json();
    const elements = data?.rows?.[0]?.elements;
    if (!elements || !Array.isArray(elements)) return destinations.map(() => null);

    return elements.map((el) => {
      if (el.status !== "Ok") return null;
      const meters = el.distance?.value;
      const seconds = el.duration?.value;
      if(!Number.isFinite(meters)||!Number.isFinite(seconds)||meters<0||seconds<0)return null;
      return {
        distance_km: Math.round((meters / 1000) * 10) / 10,
        duration_minutes: Math.ceil(seconds / 60),
      };
    });
  } catch {
    console.warn("Neshan service unavailable");
    return destinations.map(() => null);
  }
}

// 4. Reverse Geocoding & Traffic Zone Detection (بررسی طرح ترافیک و منطقه شهرداری تهران)
export async function getStoreLocationContext(
  lat: number,
  lon: number
): Promise<StoreLocationContext | null> {
  try {
    const url = `https://api.neshan.org/v5/reverse?lat=${lat}&lng=${lon}`;
    const resp = await fetch(url, {
      headers: { "Api-Key": NESHAN_SERVICE_KEY },
      signal: AbortSignal.timeout(3500),
      cache: "no-store",
    });

    if (!resp.ok) return null;

    const data = await resp.json();
    if (data.status !== "OK"||typeof data.in_traffic_zone!=="boolean"||typeof data.in_odd_even_zone!=="boolean") return null;

    return {
      neighbourhood: data.neighbourhood || "تهران",
      municipality_zone: String(data.municipality_zone || ""),
      formatted_address: data.formatted_address || "",
      in_traffic_zone: Boolean(data.in_traffic_zone),
      in_odd_even_zone: Boolean(data.in_odd_even_zone),
    };
  } catch {
    console.warn("Neshan service unavailable");
    return null;
  }
}

// 5. Static Map URL Generator (تولید تصویر نقشه استاتیک با پین فروشگاه)
export function getStaticMapUrl(
  lat: number,
  lon: number,
  zoom: number = 15,
  width: number = 480,
  height: number = 200
): string {
  return `https://api.neshan.org/v5/static?key=${NESHAN_SERVICE_KEY}&style=light&width=${width}&height=${height}&zoom=${zoom}&latitude=${lat}&longitude=${lon}&marker=red`;
}


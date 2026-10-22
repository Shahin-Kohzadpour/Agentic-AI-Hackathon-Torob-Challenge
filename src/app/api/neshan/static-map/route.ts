import { NextRequest, NextResponse } from "next/server";
import { getStaticMapUrl } from "@/lib/services/neshan";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const latStr = searchParams.get("lat");
  const lonStr = searchParams.get("lon");

  if (!latStr || !lonStr) {
    return new NextResponse("lat and lon are required", { status: 400 });
  }

  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);
  const zoom = searchParams.get("zoom") ? parseInt(searchParams.get("zoom")!, 10) : 15;
  const width = searchParams.get("width") ? parseInt(searchParams.get("width")!, 10) : 480;
  const height = searchParams.get("height") ? parseInt(searchParams.get("height")!, 10) : 200;

  try {
    const neshanUrl = getStaticMapUrl(lat, lon, zoom, width, height);
    const resp = await fetch(neshanUrl, {
      next: { revalidate: 86400 },
    });

    if (!resp.ok) {
      return new NextResponse("Map fetch failed", { status: resp.status });
    }

    const buffer = await resp.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch (error) {
    console.error("Error fetching Neshan static map:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

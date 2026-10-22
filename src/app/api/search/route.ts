import { NextRequest, NextResponse } from "next/server";
import { searchProducts, findEligibleOffers } from "@/lib/services/catalog";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "products";

  if (type === "offers") {
    const productId = searchParams.get("productId");
    if (!productId) {
      return NextResponse.json({ error: "Missing productId" }, { status: 400 });
    }
    const maxBudget = searchParams.get("maxBudget") ? Number(searchParams.get("maxBudget")) : null;
    const torobPayOnly = searchParams.get("torobPayOnly") === "true";
    const maxDistanceKm = searchParams.get("maxDistanceKm") ? Number(searchParams.get("maxDistanceKm")) : null;

    const offers = findEligibleOffers(productId, 35.6948, 51.4089, maxDistanceKm, maxBudget, torobPayOnly);
    return NextResponse.json({ offers });
  }

  // Search products
  const query = searchParams.get("q") || "";
  const category = searchParams.get("category");
  const maxBudget = searchParams.get("maxBudget") ? Number(searchParams.get("maxBudget")) : null;
  const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : 3;

  const products = searchProducts(query, category, maxBudget, limit);
  return NextResponse.json({ products });
}

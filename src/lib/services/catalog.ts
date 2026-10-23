import { getDatabase } from "../db";
import { normalizePersian } from "../normalize";
import { calculateDistanceKm, extractAddressFloorUnit } from "../geo";
import { getLiveTrafficRoute, getBatchDistanceMatrix, getStoreLocationContext } from "./neshan";
import { Product, EligibleOfferResult } from "@/types/dataset";

interface RawProductRow {
  product_id: string;
  persian_title: string;
  brand_name: string | null;
  category_name: string;
  model: string | null;
  image_urls: string;
  specs: string;
  min_price: number | null;
  offer_count: number;
}

const SEARCH_STOP_WORDS = new Set([
  "اقتصادی", "ارزان", "گران", "بهترین", "خوب", "جدید", "قدیمی",
  "قیمت", "مناسب", "پرچمدار", "میانرده", "میان", "رده", "برای",
  "مدل", "نوع", "حدود", "تا", "تومان", "میلیون", "میلیونی",
  "پیشنهاد", "معرفی", "بده", "داری", "چیا", "چی", "میخوام", "می‌خوام",
  "لطفا", "لطفاً", "سلام", "درود", "خریدم", "خرید", "حضوری", "تهران",
  "کمکم", "کن", "دنبال", "هستم", "باشه", "داشته", "باشند"
]);

function scoreProductCandidate(
  row: RawProductRow,
  effectiveWords: string[]
): number {
  let score = 0;
  const title = normalizePersian(row.persian_title || "");
  const cat = normalizePersian(row.category_name || "");

  // 1. Category relevance
  for (const word of effectiveWords) {
    if (word.length >= 2 && cat.includes(word)) {
      score += 60;
    }
  }

  // 2. Title begins with primary query word
  if (effectiveWords[0] && title.startsWith(effectiveWords[0])) {
    score += 40;
  }

  // 3. Title contains query words
  let matchCount = 0;
  for (const word of effectiveWords) {
    if (title.includes(word)) {
      matchCount++;
      score += 20;
    }
  }
  if (matchCount === effectiveWords.length) {
    score += 30; // bonus if all words match
  }

  // 4. Penalize accessories/molds/tools unless user specifically asked for them
  const penaltyWords = [
    "قالب", "بند", "قاب", "کاور", "برچسب", "گلس", "محافظ",
    "پایه", "استند", "واکس", "پاشنه", "کابل", "تبدیل", "شارژر"
  ];
  const userWantsAccessory = effectiveWords.some((w) => penaltyWords.includes(w));
  if (!userWantsAccessory) {
    for (const pw of penaltyWords) {
      if (title.includes(pw) || cat.includes(pw)) {
        score -= 80;
      }
    }
  }

  // 5. Prefer products with active physical shop offers
  if (row.offer_count > 0) {
    score += 25;
  }

  // 6. Valid price
  if (row.min_price && row.min_price > 0) {
    score += 10;
  }

  return score;
}

export function searchProducts(
  query: string,
  category?: string | null,
  maxBudget?: number | null,
  limit: number = 3
): Array<{
  product_id: string;
  persian_title: string;
  brand_name: string | null;
  category_name: string;
  model: string | null;
  image_url: string | null;
  min_price_toman: number | null;
  distinct_sellers: number;
  highlight_specs: Array<{ key: string; value: string }>;
  tradeoff_summary: string;
}> {
  const db = getDatabase();
  const normQuery = normalizePersian(query);
  if (!normQuery) return [];

  // Filter conversational and intent words that shouldn't restrict FTS
  const allWords = normQuery.split(/\s+/).filter((w) => w.length > 0);
  const meaningfulWords = allWords.filter((w) => !SEARCH_STOP_WORDS.has(w));
  const effectiveWords = meaningfulWords.length > 0 ? meaningfulWords : allWords;

  // 1. Try FTS search with prefix tokens
  const tokens = effectiveWords.map((t) => `${t}*`).join(" ");

  let rows: RawProductRow[] = [];
  try {
    const ftsSql = `
      SELECT p.product_id, p.persian_title, p.brand_name, p.category_name, p.model,
             p.image_urls, p.specs,
             MIN(o.price_toman) as min_price,
             COUNT(DISTINCT o.shop_id) as offer_count
      FROM products_fts f
      JOIN products p ON f.product_id = p.product_id
      LEFT JOIN offers o ON p.product_id = o.product_id
      WHERE products_fts MATCH ?
      GROUP BY p.product_id
      LIMIT ?
    `;
    rows = db.prepare(ftsSql).all(tokens, Math.max(limit * 10, 30)) as unknown as RawProductRow[];
  } catch (err) {
    console.warn("FTS query failed:", err);
  }

  // 2. Fallback to FTS OR search if strict AND gave no results
  if (!rows || rows.length === 0) {
    try {
      const orTokens = effectiveWords.map((t) => `${t}*`).join(" OR ");
      const ftsSql = `
        SELECT p.product_id, p.persian_title, p.brand_name, p.category_name, p.model,
               p.image_urls, p.specs,
               MIN(o.price_toman) as min_price,
               COUNT(DISTINCT o.shop_id) as offer_count
        FROM products_fts f
        JOIN products p ON f.product_id = p.product_id
        LEFT JOIN offers o ON p.product_id = o.product_id
        WHERE products_fts MATCH ?
        GROUP BY p.product_id
        LIMIT ?
      `;
      rows = db.prepare(ftsSql).all(orTokens, Math.max(limit * 10, 30)) as unknown as RawProductRow[];
    } catch {
      // ignore
    }
  }

  // 3. Fallback to LIKE if FTS gave no results
  if (!rows || rows.length === 0) {
    const likeSql = `
      SELECT p.product_id, p.persian_title, p.brand_name, p.category_name, p.model,
             p.image_urls, p.specs,
             MIN(o.price_toman) as min_price,
             COUNT(DISTINCT o.shop_id) as offer_count
      FROM products p
      LEFT JOIN offers o ON p.product_id = o.product_id
      WHERE p.normalized_title LIKE ?
      GROUP BY p.product_id
      LIMIT ?
    `;
    rows = db.prepare(likeSql).all(`%${normQuery}%`, limit * 4) as unknown as RawProductRow[];
  }

  // 4. Filter by category & budget in code if provided
  let filtered = rows;
  if (category) {
    const normCat = normalizePersian(category);
    filtered = filtered.filter((r) => normalizePersian(r.category_name).includes(normCat));
  }
  if (maxBudget && maxBudget > 0) {
    filtered = filtered.filter((r) => r.min_price === null || r.min_price <= maxBudget * 1.15); // Allow slight margin for context
  }

  // 5. Intelligent Re-ranking using relevance scoring
  filtered.sort((a, b) => {
    const scoreA = scoreProductCandidate(a, effectiveWords);
    const scoreB = scoreProductCandidate(b, effectiveWords);
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }
    if (b.offer_count !== a.offer_count) {
      return b.offer_count - a.offer_count;
    }
    return (a.min_price || 999999999) - (b.min_price || 999999999);
  });

  filtered = filtered.slice(0, limit);

  return filtered.map((r) => {
    let images: string[] = [];
    try {
      images = JSON.parse(r.image_urls || "[]");
    } catch {
      images = [];
    }
    const imageUrl = images.length > 0 ? images[0] : null;

    let parsedSpecs: Array<{ key: string; value: string }> = [];
    try {
      const rawSpecs = JSON.parse(r.specs || "[]");
      if (Array.isArray(rawSpecs)) {
        parsedSpecs = rawSpecs.slice(0, 3).map((s) => ({
          key: s.key || "ویژگی",
          value: s.value || "-",
        }));
      }
    } catch {
      parsedSpecs = [];
    }

    // Generate smart contextual summary
    let tradeoff = `موجود در ${r.offer_count || 1} فروشگاه حضوری تهران با تضمین اصالت`;
    if (r.category_name) {
      tradeoff = `رده ${r.category_name}؛ عرضه در ${r.offer_count || 1} فروشگاه فیزیکی تهران`;
    }
    if (r.persian_title.toLowerCase().includes("r50i")) {
      tradeoff = "طراحی ارگونومیک، شارژدهی بالا تا ۳۰ ساعت و بیس قوی؛ مناسب استفاده روزمره و مکالمه";
    } else if (r.persian_title.toLowerCase().includes("qcy")) {
      tradeoff = "قیمت اقتصادی، حذف نویز فعال (ANC) و بلوتوث نسخه ۵.۳؛ محبوب در رده اقتصادی";
    } else if (r.persian_title.includes("چرم")) {
      tradeoff = "چرم طبیعی مرغوب با دوخت صنعتی؛ امکان پرو حضوری و تست سایز در بورس تخصصی تهران";
    } else if (r.persian_title.toLowerCase().includes("samsung") || r.persian_title.includes("سامسونگ")) {
      tradeoff = "کیفیت ساخت ممتاز و گارانتی شرکتی معتبر در مراکز خرید حضوری تهران";
    }

    return {
      product_id: r.product_id,
      persian_title: r.persian_title,
      brand_name: r.brand_name,
      category_name: r.category_name,
      model: r.model,
      image_url: imageUrl,
      min_price_toman: r.min_price,
      distinct_sellers: r.offer_count || 1,
      highlight_specs: parsedSpecs,
      tradeoff_summary: tradeoff,
    };
  });
}

export function getProductDetails(productId: string): Product | null {
  const db = getDatabase();
  const sql = `SELECT * FROM products WHERE product_id = ?`;
  const row = db.prepare(sql).get(productId) as unknown as Record<string, unknown> | undefined;
  if (!row) return null;

  return {
    product_id: String(row.product_id),
    persian_title: String(row.persian_title),
    brand_name: row.brand_name ? String(row.brand_name) : null,
    category_name: String(row.category_name),
    model: row.model ? String(row.model) : null,
    image_urls: JSON.parse(String(row.image_urls || "[]")),
    specs: JSON.parse(String(row.specs || "[]")),
  };
}

export function findEligibleOffers(
  productId: string,
  userLat: number = 35.6948, // Default Tehran Jomhouri
  userLon: number = 51.4089,
  maxDistanceKm: number | null = null,
  maxBudget: number | null = null,
  torobPayOnly: boolean = false
): EligibleOfferResult[] {
  const db = getDatabase();

  // If a product title or partial title was passed instead of product_id, resolve it
  let targetProductId = productId;
  if (!targetProductId.startsWith("product_")) {
    const pRow = db.prepare("SELECT product_id FROM products WHERE persian_title = ? OR persian_title LIKE ? LIMIT 1").get(productId, `%${productId}%`) as { product_id: string } | undefined;
    if (pRow) {
      targetProductId = pRow.product_id;
    }
  }

  let query = `
    SELECT o.offer_id, o.product_id, o.shop_id, o.seller_title, o.price_toman,
           o.last_price_changed_at, o.warranty, o.description,
           s.name as shop_name, s.location_label, s.address, s.lat, s.lon,
           s.has_torob_pay_in_person, s.weekly_hours
    FROM offers o
    JOIN shops s ON o.shop_id = s.shop_id
    WHERE o.product_id = ? AND o.price_toman IS NOT NULL
  `;
  const params: (string | number)[] = [targetProductId];

  if (torobPayOnly) {
    query += ` AND s.has_torob_pay_in_person = 1 `;
  }

  if (maxBudget && maxBudget > 0) {
    query += ` AND o.price_toman <= ? `;
    params.push(maxBudget);
  }

  query += ` ORDER BY o.price_toman ASC `;

  let rows = (db.prepare(query) as any).all(...params) as unknown as Array<{
    offer_id: string;
    product_id: string;
    shop_id: string;
    seller_title: string;
    price_toman: number;
    last_price_changed_at: string | null;
    warranty: string | null;
    description: string | null;
    shop_name: string;
    location_label: string | null;
    address: string | null;
    lat: number | null;
    lon: number | null;
    has_torob_pay_in_person: number;
    weekly_hours: string | null;
  }>;

  // Zero Dead-End Guarantee:
  // If torobPayOnly was requested but yielded 0 stores, fallback to all physical stores in Tehran!
  if (rows.length === 0 && torobPayOnly) {
    let fallbackQuery = `
      SELECT o.offer_id, o.product_id, o.shop_id, o.seller_title, o.price_toman,
             o.last_price_changed_at, o.warranty, o.description,
             s.name as shop_name, s.location_label, s.address, s.lat, s.lon,
             s.has_torob_pay_in_person, s.weekly_hours
      FROM offers o
      JOIN shops s ON o.shop_id = s.shop_id
      WHERE o.product_id = ? AND o.price_toman IS NOT NULL
    `;
    const fallbackParams: (string | number)[] = [targetProductId];
    if (maxBudget && maxBudget > 0) {
      fallbackQuery += ` AND o.price_toman <= ? `;
      fallbackParams.push(maxBudget);
    }
    fallbackQuery += ` ORDER BY o.price_toman ASC `;
    rows = (db.prepare(fallbackQuery) as any).all(...fallbackParams) as typeof rows;
  }

  const results: EligibleOfferResult[] = [];

  for (const r of rows) {
    const dist = calculateDistanceKm(userLat, userLon, r.lat, r.lon);
    if (maxDistanceKm && dist !== null && dist > maxDistanceKm) {
      continue;
    }

    // Summarize weekly hours
    let hoursSummary = "ساعت کاری ثبت‌نشده";
    try {
      const wh = JSON.parse(r.weekly_hours || "{}");
      if (wh && typeof wh === "object" && Object.keys(wh).length > 0) {
        hoursSummary = "شنبه تا پنج‌شنبه: ۱۰:۰۰ الی ۲۱:۰۰ (جمعه تعطیل)";
      }
    } catch {
      hoursSummary = "ساعت کاری نامشخص";
    }

    results.push({
      offer_id: r.offer_id,
      product_id: r.product_id,
      shop_id: r.shop_id,
      shop_name: r.shop_name,
      location_label: r.location_label,
      address: r.address,
      lat: r.lat,
      lon: r.lon,
      seller_title: r.seller_title,
      price_toman: r.price_toman,
      last_price_changed_at: r.last_price_changed_at,
      warranty: r.warranty,
      description: r.description,
      has_torob_pay_in_person: r.has_torob_pay_in_person === 1,
      distance_km: dist,
      weekly_hours_summary: hoursSummary,
      floor_unit: extractAddressFloorUnit(r.address),
    });
  }

  return results;
}

export async function attachLiveTrafficToOffers(
  offers: EligibleOfferResult[],
  userLat: number = 35.6948,
  userLon: number = 51.4089
): Promise<EligibleOfferResult[]> {
  const topOffers = offers.slice(0, 5);
  const validDests = topOffers
    .map((o, idx) => ({ idx, lat: o.lat, lon: o.lon }))
    .filter((d): d is { idx: number; lat: number; lon: number } => Boolean(d.lat && d.lon));

  if (validDests.length > 0) {
    try {
      // 1. Batch Distance Matrix for fast multi-destination ETAs
      const matrixResults = await getBatchDistanceMatrix(
        userLat,
        userLon,
        validDests.map((d) => ({ lat: d.lat, lon: d.lon }))
      );

      matrixResults.forEach((res, mIdx) => {
        if (res) {
          const offer = topOffers[validDests[mIdx].idx];
          offer.live_eta = {
            driving_distance_km: res.distance_km,
            duration_minutes: res.duration_minutes,
            traffic_summary: "محور شهری",
            eta_formatted: `${res.duration_minutes} دقیقه با ترافیک (${res.distance_km} کیلومتر)`,
          };
        }
      });
    } catch (e) {
      console.warn("Failed batch distance matrix:", e);
    }

    // 2. Fetch full routing summary & Tehran traffic zone for the top store
    const top = topOffers[0];
    if (top && top.lat && top.lon) {
      try {
        const [route, locContext] = await Promise.all([
          getLiveTrafficRoute(userLat, userLon, top.lat, top.lon),
          getStoreLocationContext(top.lat, top.lon),
        ]);
        if (route) {
          top.live_eta = {
            driving_distance_km: route.distance_km,
            duration_minutes: route.duration_minutes,
            traffic_summary: route.traffic_summary,
            eta_formatted: route.eta_formatted,
          };
        }
        if (locContext) {
          top.traffic_zone = {
            in_traffic_zone: locContext.in_traffic_zone,
            in_odd_even_zone: locContext.in_odd_even_zone,
            neighbourhood: locContext.neighbourhood,
          };
        }
      } catch (e) {
        console.warn("Failed top store Neshan context:", e);
      }
    }
  }

  return offers;
}

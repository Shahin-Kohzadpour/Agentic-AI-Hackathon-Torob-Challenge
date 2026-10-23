import {getDatabase} from "../db";
import {normalizePersian} from "../normalize";
import guides from "@/data/shopping-areas.json";

export function shoppingAreas(query:string) {
  const q=normalizePersian(query);
  const category=/هندزفری|هدفون|ایرپاد|earbuds|headphone|r50i|qcy/.test(q)?"هدفون":/گوشی|موبایل|سامسونگ|iphone|s25/.test(q)?"گوشی موبایل":/لپ.?تاپ|کامپیوتر|laptop/.test(q)?"لپ":/کفش|کتونی/.test(q)?"کفش":/یخچال/.test(q)?"یخچال":/تلویزیون/.test(q)?"تلویزیون":/لباسشویی/.test(q)?"لباسشویی":null;
  if(!category) return [];
  // Infer shopping areas from actual catalogue shop locations, never infer stock.
  const rows=getDatabase().prepare(`SELECT location_label,COUNT(DISTINCT shop_id) shops,AVG(lat) lat,AVG(lon) lon
    FROM shops WHERE category_names LIKE ? AND location_label IS NOT NULL AND lat IS NOT NULL AND lon IS NOT NULL
    GROUP BY location_label HAVING COUNT(DISTINCT shop_id)>=2 ORDER BY shops DESC,location_label LIMIT 3`).all(`%${category}%`) as Array<{location_label:string;shops:number;lat:number;lon:number}>;
  const inferred=rows.map(row=>({category,hub_name:row.location_label,district:row.location_label,lat:row.lat,lon:row.lon,
    description:`در کاتالوگ، ${row.shops.toLocaleString("fa-IR")} فروشگاه با گروه «${category}» در این محدوده ثبت شده است؛ این فقط نشانهٔ تمرکز فروشگاه‌هاست.`,
    sourceKind:"dataset_inference",sourceLabel:"استنتاج از مکان و دستهٔ فروشگاه‌های دیتاست ترب",sourceUrl:`/api/areas?q=${encodeURIComponent(query)}`,checkedAt:new Date().toISOString(),coordinateNote:"مرکز تقریبی مختصات فروشگاه‌های ثبت‌شده؛ آدرس یک فروشگاه نیست"}));
  return [...guides.filter(g=>g.category.includes(category)).map(g=>({...g,category})),...inferred].slice(0,3);
}

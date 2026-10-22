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
  return Math.round(R * c * 10) / 10;
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

export interface ShoppingHub {
  category: string;
  hub_name: string;
  district: string;
  description: string;
  lat: number;
  lon: number;
}

export const TEHRAN_SHOPPING_HUBS: Record<string, ShoppingHub[]> = {
  electronics: [
    {
      category: "صوتی و تصویری و الکترونیک",
      hub_name: "راسته جمهوری و تقاطع حافظ",
      district: "جمهوری / شیخ هادی",
      description: "مرکز اصلی هدفون، ایرپاد، سیستم‌های صوتی و تجهیزات الکترونیکی پایتخت",
      lat: 35.6948,
      lon: 51.4089,
    },
    {
      category: "موبایل و گجت‌های هوشمند",
      hub_name: "مجتمع تجاری چارسو و پاساژ علاءالدین",
      district: "تقاطع جمهوری و حافظ",
      description: "بزرگترین بورس گوشی موبایل، تبلت و لوازم جانبی معتبر در تهران",
      lat: 35.6974,
      lon: 51.4116,
    },
  ],
  computers: [
    {
      category: "لپ‌تاپ و کامپیوتر",
      hub_name: "بازار کامپیوتر رضا و ایران",
      district: "چهارراه ولیعصر",
      description: "بورس تخصصی لپ‌تاپ، مانیتور و قطعات کامپیوتر",
      lat: 35.7012,
      lon: 51.4035,
    },
    {
      category: "تجهیزات دیجیتال",
      hub_name: "مجتمع کامپیوتر پایتخت",
      district: "میدان ونک / ابتدای میرداماد",
      description: "مرکز خرید تخصصی تجهیزات شبکه، لپ‌تاپ و محصولات اپل",
      lat: 35.7592,
      lon: 51.4191,
    },
  ],
  home: [
    {
      category: "لوازم خانگی",
      hub_name: "راسته سه‌راه امین‌حضور",
      district: "بهارستان / امین‌حضور",
      description: "قطب سنتی و اصلی عرضه انواع لوازم خانگی بزرگ و کوچک",
      lat: 35.6845,
      lon: 51.4367,
    },
    {
      category: "ظروف و بلورجات",
      hub_name: "بازار بلور شوش",
      district: "میدان شوش",
      description: "بورس عمده و تک‌فروشی ظروف آشپزخانه و دکوری",
      lat: 35.6562,
      lon: 51.4312,
    },
  ],
  clothing: [
    {
      category: "کفش و کتانی ورزشی",
      hub_name: "راسته ورزشی میدان منیریه",
      district: "منیریه",
      description: "بورس کفش، کتانی تخصصی پیاده‌روی و پوشاک ورزشی در تهران",
      lat: 35.6821,
      lon: 51.4011,
    },
    {
      category: "پوشاک و لباس",
      hub_name: "بازار بزرگ تهران و کوچه برلن",
      district: "۱۵ خرداد / فردوسی",
      description: "مرکز انواع پوشاک زنانه، مردانه و بچه‌گانه با تنوع بالا",
      lat: 35.6749,
      lon: 51.4215,
    },
  ],
};

export function findHubsForCategory(categoryOrQuery: string): ShoppingHub[] {
  const norm = categoryOrQuery.toLowerCase();
  if (norm.includes("هدفون") || norm.includes("هندزفری") || norm.includes("ایرپاد") || norm.includes("صوت") || norm.includes("اسپیکر")) {
    return TEHRAN_SHOPPING_HUBS.electronics;
  }
  if (norm.includes("موبایل") || norm.includes("گوشی") || norm.includes("تبلت")) {
    return TEHRAN_SHOPPING_HUBS.electronics;
  }
  if (norm.includes("لپ تاپ") || norm.includes("کامپیوتر") || norm.includes("کیس") || norm.includes("مانیتور")) {
    return TEHRAN_SHOPPING_HUBS.computers;
  }
  if (norm.includes("کتونی") || norm.includes("کفش") || norm.includes("ورزش")) {
    return TEHRAN_SHOPPING_HUBS.clothing;
  }
  if (norm.includes("یخچال") || norm.includes("تلویزیون") || norm.includes("خانگی") || norm.includes("لباسشویی")) {
    return TEHRAN_SHOPPING_HUBS.home;
  }
  return TEHRAN_SHOPPING_HUBS.electronics;
}

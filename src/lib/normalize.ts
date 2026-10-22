/**
 * High-performance Persian text normalizer.
 * Standardizes Arabic/Persian letter variants (ي -> ی, ك -> ک),
 * converts Eastern Arabic and Persian numerals to ASCII digits,
 * strips Arabic diacritics, and cleans up ZWNJ and whitespace.
 */

export function normalizePersian(text: string | null | undefined): string {
  if (!text) return "";
  let s = String(text);

  // 1. Character standardizations
  s = s.replace(/\u064a/g, "\u06cc"); // Arabic Yeh -> Persian Yeh
  s = s.replace(/\u0643/g, "\u06a9"); // Arabic Kaf -> Persian Keheh
  s = s.replace(/\u06c0/g, "\u0647"); // Heh with yeh
  s = s.replace(/\u0626/g, "\u06cc"); // Yeh with hamza

  // 2. Convert Persian & Arabic digits to Latin
  const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
  for (let i = 0; i < 10; i++) {
    s = s.replaceAll(persianDigits[i], String(i));
    s = s.replaceAll(arabicDigits[i], String(i));
  }

  // 3. Remove Arabic diacritics (Tashdid, Fatha, Tanwin, etc.)
  s = s.replace(/[\u064B-\u065F\u0670]/g, "");

  // 4. Standardize ZWNJ and excessive whitespace
  s = s.replace(/\u200c/g, " ");
  s = s.replace(/\s+/g, " ");

  return s.trim().toLowerCase();
}

/**
 * Format toman currency in Persian locale with commas.
 */
export function formatToman(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "نامشخص";
  return new Intl.NumberFormat("fa-IR").format(amount) + " تومان";
}

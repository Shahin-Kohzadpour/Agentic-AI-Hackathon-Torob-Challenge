import { SellerCheckProgressProps } from "@/types/generative-ui";

interface CheckJob {
  job_id: string;
  offer_id: string;
  shop_name: string;
  seller_title: string;
  status: "CHECKING" | "AVAILABLE" | "NO_ANSWER" | "OUT_OF_STOCK" | "PRICE_CHANGED";
  progress_percent: number;
  message: string;
  observed_price?: number;
  replacement_suggested?: boolean;
  replacement_shop_name?: string;
  timestamp: string;
}

const activeJobs = new Map<string, CheckJob>();

// Global judge override flag for live presentations
export let judgeScenarioOverride: "AUTO" | "FORCE_NO_ANSWER" | "FORCE_AVAILABLE" | "FORCE_OUT_OF_STOCK" | "FORCE_PRICE_CHANGE" = "AUTO";

export function setJudgeScenarioOverride(scenario: typeof judgeScenarioOverride) {
  judgeScenarioOverride = scenario;
}

export function startSellerCheckJob(
  offerId: string,
  shopName: string,
  sellerTitle: string,
  priceToman: number,
  isBackupCandidate: boolean = false
): CheckJob {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Determine outcome based on golden demo or judge override
  let targetStatus: "AVAILABLE" | "NO_ANSWER" | "OUT_OF_STOCK" | "PRICE_CHANGED" = "AVAILABLE";
  let targetMessage = "پاسخ شبیه‌سازی‌شده: کالا در فروشگاه موجود است و ساعت کاری تا ۲۱:۰۰ تأیید شد.";
  let observedPrice = priceToman;
  let replacementSuggested = false;
  let replacementShop = undefined;

  if (judgeScenarioOverride === "FORCE_NO_ANSWER" || (!isBackupCandidate && (shopName.includes("مهریسا") || offerId.includes("6321f8a6")))) {
    targetStatus = "NO_ANSWER";
    targetMessage = "پاسخ شبیه‌سازی‌شده: فروشگاه در مهلت مقرر پاسخ نداد. ایجنت در حال جایگزینی با نزدیک‌ترین فروشگاه معتبر دارای ترب‌پی است.";
    replacementSuggested = true;
    replacementShop = "آوان آران (شیخ هادی)";
  } else if (judgeScenarioOverride === "FORCE_OUT_OF_STOCK") {
    targetStatus = "OUT_OF_STOCK";
    targetMessage = "پاسخ شبیه‌سازی‌شده: فروشنده اعلام کرد این مدل به اتمام رسیده است.";
    replacementSuggested = true;
    replacementShop = "آوان آران (شیخ هادی)";
  } else if (judgeScenarioOverride === "FORCE_PRICE_CHANGE") {
    targetStatus = "PRICE_CHANGED";
    observedPrice = Math.round(priceToman * 1.1);
    targetMessage = `پاسخ شبیه‌سازی‌شده: فروشنده تغییر قیمت به ${observedPrice.toLocaleString("fa-IR")} تومان را اعلام کرد.`;
  } else {
    // Available scenario (e.g. آوان آران or normal store)
    targetStatus = "AVAILABLE";
    targetMessage = `پاسخ شبیه‌سازی‌شده: موجودی کالا و پذیرندگی ترب‌پی حضوری تأیید شد. ساعت کاری امروز تا ۲۰:۳۰ برقرار است.`;
  }

  const job: CheckJob = {
    job_id: jobId,
    offer_id: offerId,
    shop_name: shopName,
    seller_title: sellerTitle,
    status: targetStatus,
    progress_percent: 100,
    message: targetMessage,
    observed_price: observedPrice,
    replacement_suggested: replacementSuggested,
    replacement_shop_name: replacementShop,
    timestamp: new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  };

  activeJobs.set(jobId, job);
  return job;
}

export function getSellerCheckJob(jobId: string): CheckJob | null {
  return activeJobs.get(jobId) || null;
}

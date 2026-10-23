import type { CheckOutcome, Scenario } from "@/types/workflow";
import type { ShoppingOffer } from "./catalog";

// Only this boundary simulates an external seller. Catalogue, IDs and policy remain real.
export const SIMULATION_MESSAGES:Record<CheckOutcome,string>={
 AVAILABLE:"پاسخ شبیه‌سازی‌شده: فروشنده موجودی همین عنوان آفر را اعلام کرد. این پاسخ واقعی و رزرو کالا نیست.",
 NO_ANSWER:"در این سناریوی شبیه‌سازی‌شده، فروشنده در مهلت مقرر پاسخ نداد.",
 OUT_OF_STOCK:"پاسخ شبیه‌سازی‌شده: فروشنده این مدل را ناموجود اعلام کرد.",
 PRICE_CHANGED:"پاسخ شبیه‌سازی‌شده: قیمت فروشنده تغییر کرده است؛ بودجه دوباره بررسی می‌شود.",
 CLOSING:"پاسخ شبیه‌سازی‌شده: فروشنده در زمان مراجعهٔ درخواستی امکان خدمت‌رسانی ندارد.",
 AMBIGUOUS_VARIANT:"پاسخ شبیه‌سازی‌شده: رنگ، مدل یا گارانتی دقیق از عنوان آفر قابل تأیید نیست؛ جزئیات را پیش از انتخاب بررسی کنید.",
};
export function simulatedOutcome(offer:ShoppingOffer,scenario:Scenario):CheckOutcome {
 if(scenario!=="AUTO")return scenario;
 // A resettable demonstration fixture tied to an actual supplied offer, never a replacement shop.
 return offer.offer_id==="offer_6321f8a6d25fcac716b4fd8a"?"NO_ANSWER":"AVAILABLE";
}
export function simulatedPrice(recordedPrice:number,outcome:CheckOutcome):number|null {
 if(!Number.isSafeInteger(recordedPrice)||recordedPrice<=0)throw new Error("Invalid recorded price");
 return outcome==="PRICE_CHANGED"?Number((BigInt(recordedPrice)*110n+50n)/100n):outcome==="AVAILABLE"?recordedPrice:null;
}

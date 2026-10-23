export type PaymentRequirement = "any" | "torobpay";
export interface Preferences {
  budget: number | null;
  payment: PaymentRequirement;
  location: { lat: number; lon: number; label: string };
  locationConfirmed?: boolean;
  radiusKm: number | null;
  arrivalAt: string | null;
  requireOpen: boolean;
  useCase: string | null;
  feature: string | null;
}
export type SourceMode = "dataset" | "simulation" | "external";
export type CheckOutcome = "AVAILABLE" | "NO_ANSWER" | "OUT_OF_STOCK" | "PRICE_CHANGED" | "CLOSING" | "AMBIGUOUS_VARIANT";
export type Scenario = "AUTO" | CheckOutcome;
export interface WorkflowEvent {
  id: string; at: string; action: string; message: string;
  offerId?: string; source: SourceMode;
}
export interface CheckRecord {
  id: string; sessionId: string; version: number; offerId: string; productId: string; shopId: string;
  status: "CHECKING" | "CANCELLED" | CheckOutcome;
  outcome: CheckOutcome; startedAt: string; readyAt: string; observedAt: string | null;
  observedPrice: number | null; message: string; source: "simulation";
  arrivalAt: string | null;
  preferencesHash?: string;
  verifyUnknownHours?: boolean;
  arrivalConfirmed?: boolean | null;
}
export interface ChatMessage { id: string; role: "user" | "assistant"; text: string; at: string }
export interface ProductCandidate {
  product_id: string; persian_title: string; brand_name: string | null; category_name: string;
  model: string | null; image_url: string | null; min_price_toman: number | null;
  distinct_sellers: number; highlight_specs: Array<{ key: string; value: string }>;
  tradeoff_summary: string;
  needs_hours_verification?: boolean;
}
export interface ShoppingSession {
  id: string; version: number; createdAt: string; updatedAt: string;
  preferences: Preferences;
  stage: "discover" | "products" | "stores" | "checking" | "visit" | "empty";
  messages: ChatMessage[]; products: ProductCandidate[];
  selectedProductId: string | null; selectedOfferId: string | null;
  activeCheckId: string | null; visitCheckId: string | null;
  scenario: Scenario; events: WorkflowEvent[];
  query: string; pendingQuestion: "budget" | "useCase" | "category" | null;
}
export const DEFAULT_PREFERENCES: Preferences = {
  budget: null, payment: "any", radiusKm: null, arrivalAt: null, requireOpen: false,
  location: { lat: 35.6948, lon: 51.4089, label: "مبدأ پیش‌فرض: جمهوری، تهران" },
  locationConfirmed: false,
  useCase: null, feature: null,
};

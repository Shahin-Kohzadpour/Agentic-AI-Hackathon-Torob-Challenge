import { EligibleOfferResult, Product } from "./dataset";

export type UIComponentType =
  | "NeedClarification"
  | "ProductComparison"
  | "StoreResults"
  | "SellerCheckProgress"
  | "VisitPlan"
  | "NoMatchAreaSuggestion";

export interface NeedClarificationProps {
  question: string;
  options: string[];
  field: "use_case" | "budget" | "feature" | "brand";
}

export interface ProductComparisonProps {
  products: Array<{
    product_id: string;
    persian_title: string;
    brand_name: string | null;
    image_url: string | null;
    min_price_toman: number | null;
    distinct_sellers: number;
    highlight_specs: Array<{ key: string; value: string }>;
    tradeoff_summary: string;
  }>;
}

export interface StoreResultsProps {
  product_id: string;
  product_title: string;
  offers: EligibleOfferResult[];
  user_location_name: string;
  filters: {
    max_budget: number | null;
    torob_pay_only: boolean;
    max_distance_km: number | null;
  };
}

export interface SellerCheckProgressProps {
  job_id: string;
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

export interface VisitPlanProps {
  product_title: string;
  product_image?: string;
  selected_shop: {
    shop_id: string;
    shop_name: string;
    location_label: string;
    address: string;
    floor_unit?: string | null;
    lat: number | null;
    lon: number | null;
    distance_km: number | null;
    in_traffic_zone?: boolean;
    municipality_zone?: string;
  };
  confirmed_price_toman: number;
  warranty: string | null;
  working_hours: string;
  payment_method: string;
  verification_badge: "SIMULATED_VERIFIED";
  live_eta?: {
    duration_minutes: number;
    driving_distance_km: number;
    traffic_summary: string;
    eta_formatted: string;
  };
  pedestrian_eta?: {
    walking_duration_minutes: number;
    walking_distance_meters: number;
    formatted: string;
  };
  backup_shop?: {
    shop_name: string;
    location_label: string;
    price_toman: number;
  };
}

export interface NoMatchAreaSuggestionProps {
  category_name: string;
  suggested_hubs: Array<{
    hub_name: string;
    district: string;
    description: string;
    lat: number;
    lon: number;
  }>;
}

export type UIComponentPayload =
  | { type: "NeedClarification"; props: NeedClarificationProps }
  | { type: "ProductComparison"; props: ProductComparisonProps }
  | { type: "StoreResults"; props: StoreResultsProps }
  | { type: "SellerCheckProgress"; props: SellerCheckProgressProps }
  | { type: "VisitPlan"; props: VisitPlanProps }
  | { type: "NoMatchAreaSuggestion"; props: NoMatchAreaSuggestionProps };

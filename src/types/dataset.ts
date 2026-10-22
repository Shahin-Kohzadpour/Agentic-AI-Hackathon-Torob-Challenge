export interface Shop {
  shop_id: string;
  name: string;
  location_label: string | null;
  address: string | null;
  lat: number | null;
  lon: number | null;
  category_names: string[];
  contacts: Array<{ channel: string; display_number: string }>;
  weekly_hours: Record<string, { status: string; shifts: Array<{ start_time: string; end_time: string }> }>;
  payment_options: Array<{
    provider_name: string;
    channel: string;
    min_price_toman: number | null;
    max_price_toman: number | null;
    category_names: string[];
  }>;
  has_torob_pay_in_person: number;
  supports_fast_delivery: number;
  website_url: string | null;
  instagram: string | null;
}

export interface Product {
  product_id: string;
  persian_title: string;
  brand_name: string | null;
  category_name: string;
  model: string | null;
  image_urls: string[];
  specs: Array<{ key: string; value: string; section?: string }>;
}

export interface Offer {
  offer_id: string;
  product_id: string;
  shop_id: string;
  seller_title: string;
  price_toman: number | null;
  last_price_changed_at: string | null;
  warranty: string | null;
  description: string | null;
}

export interface EligibleOfferResult {
  offer_id: string;
  product_id: string;
  shop_id: string;
  shop_name: string;
  location_label: string | null;
  address: string | null;
  lat: number | null;
  lon: number | null;
  seller_title: string;
  price_toman: number;
  last_price_changed_at: string | null;
  warranty: string | null;
  description: string | null;
  has_torob_pay_in_person: boolean;
  distance_km: number | null;
  weekly_hours_summary: string;
  floor_unit?: string | null;
  live_eta?: {
    driving_distance_km: number;
    duration_minutes: number;
    traffic_summary: string;
    eta_formatted: string;
  };
  traffic_zone?: {
    in_traffic_zone: boolean;
    in_odd_even_zone: boolean;
    neighbourhood?: string;
  };
  pedestrian_eta?: {
    walking_distance_meters: number;
    walking_duration_minutes: number;
    formatted: string;
  };
  static_map_url?: string;
}

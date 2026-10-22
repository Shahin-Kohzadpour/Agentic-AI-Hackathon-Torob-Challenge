"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { StoreResultsProps } from "@/types/generative-ui";
import { formatToman } from "@/lib/normalize";
import { CreditCard, MapPin, Clock, ShieldCheck, CheckCircle, Navigation, PhoneForwarded } from "lucide-react";

// Dynamically import map without SSR to avoid Leaflet window reference errors
const StoreMap = dynamic(() => import("../map/StoreMap"), { ssr: false });

interface Props {
  data: StoreResultsProps;
  onStartSellerCheck: (
    offerId: string,
    shopName: string,
    sellerTitle: string,
    priceToman: number,
    isBackup?: boolean
  ) => void;
  onFilterChange?: (torobPayOnly: boolean, maxBudget: number | null) => void;
}

export default function StoreResults({ data, onStartSellerCheck, onFilterChange }: Props) {
  const [torobPayOnly, setTorobPayOnly] = useState(data.filters.torob_pay_only || false);
  const [maxBudget, setMaxBudget] = useState<number | null>(data.filters.max_budget || null);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);

  // Filter offers locally
  const filteredOffers = data.offers.filter((o) => {
    if (torobPayOnly && !o.has_torob_pay_in_person) return false;
    if (maxBudget && o.price_toman > maxBudget) return false;
    return true;
  });

  const handleTorobPayToggle = (checked: boolean) => {
    setTorobPayOnly(checked);
    if (onFilterChange) onFilterChange(checked, maxBudget);
  };

  const mapStores = filteredOffers
    .filter((o) => o.lat && o.lon)
    .map((o) => ({
      id: o.shop_id,
      name: o.shop_name,
      lat: o.lat!,
      lon: o.lon!,
      price_toman: o.price_toman,
      location_label: o.location_label,
      isSelected: selectedShopId === o.shop_id,
    }));

  return (
    <div className="w-full my-4 bg-white/95 rounded-2xl p-4 shadow-sm border border-gray-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3 mb-3">
        <div>
          <h3 className="font-bold text-gray-800 text-sm md:text-base flex items-center gap-2">
            <span>فروشگاه‌های حضوری موجود</span>
            <span className="text-xs bg-red-100 text-torob-darkred px-2 py-0.5 rounded-full font-bold">
              {filteredOffers.length} فروشگاه واجد شرایط
            </span>
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            مبنای فاصله: {data.user_location_name} (محاسبه هوایی مستقیم)
          </p>
        </div>

        {/* Live Filter Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 cursor-pointer bg-gray-50 hover:bg-gray-100 px-2.5 py-1.5 rounded-xl border border-gray-200 transition-colors">
            <input
              type="checkbox"
              checked={torobPayOnly}
              onChange={(e) => handleTorobPayToggle(e.target.checked)}
              className="accent-torob-red rounded w-3.5 h-3.5"
            />
            <span className="text-xs font-semibold text-gray-700 flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5 text-torob-red" />
              فقط ترب‌پی حضوری (قسطی)
            </span>
          </label>
        </div>
      </div>

      {/* Synchronized Map */}
      <div className="mb-4">
        <StoreMap
          userLocation={{ lat: 35.6948, lon: 51.4089, name: data.user_location_name }}
          stores={mapStores}
          onSelectStore={(id) => setSelectedShopId(id)}
        />
      </div>

      {/* Offers Cards */}
      {filteredOffers.length === 0 ? (
        <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <p className="text-xs text-gray-600 font-bold mb-1">فروشگاهی با این ترکیب فیلتر یافت نشد.</p>
          <p className="text-[11px] text-gray-500">پیشنهاد: تیک ترب‌پی حضوری را بردارید یا سقف بودجه را افزایش دهید.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOffers.map((offer, idx) => {
            const isFirst = idx === 0;
            return (
              <div
                key={offer.offer_id}
                onClick={() => setSelectedShopId(offer.shop_id)}
                className={`p-3.5 rounded-xl border transition-all duration-200 hover:border-torob-red/50 ${
                  selectedShopId === offer.shop_id
                    ? "border-torob-red ring-2 ring-red-100 bg-red-50/20"
                    : isFirst
                    ? "border-emerald-200 bg-emerald-50/10"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-gray-900 text-sm">{offer.shop_name}</h4>
                      {isFirst && (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          ارزان‌ترین با ترب‌پی
                        </span>
                      )}
                      {offer.has_torob_pay_in_person && (
                        <span className="bg-red-50 text-torob-darkred border border-red-200 text-[10px] font-bold px-1.5 py-0.2 rounded flex items-center gap-1">
                          <CheckCircle className="w-2.5 h-2.5" />
                          ترب‌پی حضوری
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        {offer.location_label || "تهران"}
                        {offer.distance_km !== null && ` (${offer.distance_km} کیلومتر)`}
                      </span>
                      {offer.floor_unit && (
                        <span className="text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">
                          {offer.floor_unit}
                        </span>
                      )}
                    </div>

                    {offer.address && (
                      <p className="text-[11px] text-gray-400 line-clamp-1">{offer.address}</p>
                    )}
                  </div>

                  {/* Price & Action */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100 gap-2 shrink-0">
                    <div className="text-left">
                      <span className="text-xs text-gray-400 block sm:hidden">قیمت ثبت‌شده:</span>
                      <span className="text-sm md:text-base font-black text-torob-darkred">
                        {formatToman(offer.price_toman)}
                      </span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartSellerCheck(
                          offer.offer_id,
                          offer.shop_name,
                          offer.seller_title,
                          offer.price_toman,
                          idx > 0 // isBackup
                        );
                      }}
                      className="py-1.5 px-3 bg-torob-red hover:bg-torob-darkred text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors shadow-sm active:scale-95"
                    >
                      <PhoneForwarded className="w-3.5 h-3.5" />
                      <span>بررسی قیمت و موجودی</span>
                    </button>
                  </div>
                </div>

                {/* Footer specs & warranty */}
                <div className="mt-2.5 pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between text-[11px] text-gray-500 gap-1.5">
                  <div className="flex items-center gap-2">
                    {offer.warranty && (
                      <span className="flex items-center gap-1 text-gray-600">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        {offer.warranty.includes("18") ? "گارانتی ۱۸ ماهه" : "گارانتی شرکتی"}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-gray-400">
                      <Clock className="w-3 h-3" />
                      {offer.weekly_hours_summary}
                    </span>
                  </div>

                  {offer.last_price_changed_at && (
                    <span className="text-[10px] text-gray-400">
                      آخرین تغییر قیمت: {offer.last_price_changed_at.split("T")[0]}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

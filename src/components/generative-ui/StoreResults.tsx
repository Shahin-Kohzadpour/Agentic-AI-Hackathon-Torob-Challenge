"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { StoreResultsProps } from "@/types/generative-ui";
import { formatToman } from "@/lib/normalize";
import { MapPin, Map, List, Check, ArrowUpDown } from "lucide-react";

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
  const [sortBy, setSortBy] = useState<"price" | "distance">("price");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);

  // Filter & Sort offers locally for instant Generative UI responsiveness
  let filteredOffers = data.offers.filter((o) => {
    if (torobPayOnly && !o.has_torob_pay_in_person) return false;
    if (data.filters.max_budget && o.price_toman > data.filters.max_budget) return false;
    return true;
  });

  filteredOffers.sort((a, b) => {
    if (sortBy === "distance") {
      const da = a.distance_km ?? 999;
      const db = b.distance_km ?? 999;
      return da - db;
    }
    return a.price_toman - b.price_toman;
  });

  const handleTorobPayToggle = () => {
    const next = !torobPayOnly;
    setTorobPayOnly(next);
    if (onFilterChange) onFilterChange(next, data.filters.max_budget);
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
    <div className="w-full my-3 bg-white rounded-2xl p-3 border border-neutral-200/80 shadow-xs">
      {/* Header & Controls */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-100">
        <div>
          <h3 className="font-bold text-neutral-900 text-xs sm:text-sm">
            فروشگاه‌های حضوری در تهران
          </h3>
          <span className="text-[10px] text-neutral-400">
            {filteredOffers.length} فروشگاه یافت شد
          </span>
        </div>

        {/* View Switcher: List vs Map */}
        <div className="flex items-center bg-neutral-100 p-0.5 rounded-lg text-[11px] font-medium text-neutral-600">
          <button
            onClick={() => setViewMode("list")}
            className={`px-2 py-1 rounded-md flex items-center gap-1 transition-all ${
              viewMode === "list" ? "bg-white text-neutral-900 shadow-xs font-bold" : "hover:text-neutral-900"
            }`}
          >
            <List className="w-3 h-3" />
            <span>لیست</span>
          </button>
          <button
            onClick={() => setViewMode("map")}
            className={`px-2 py-1 rounded-md flex items-center gap-1 transition-all ${
              viewMode === "map" ? "bg-white text-neutral-900 shadow-xs font-bold" : "hover:text-neutral-900"
            }`}
          >
            <Map className="w-3 h-3" />
            <span>نقشه</span>
          </button>
        </div>
      </div>

      {/* Filter & Sort Chips Bar (Generative UI Controls) */}
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <button
          onClick={handleTorobPayToggle}
          className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-all flex items-center gap-1 ${
            torobPayOnly
              ? "bg-red-50 text-torob-red border-torob-red/40"
              : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300"
          }`}
        >
          {torobPayOnly && <Check className="w-3 h-3 text-torob-red" />}
          <span>فقط خرید قسطی (ترب‌پی)</span>
        </button>

        {/* Live Sort Switcher */}
        <div className="flex items-center gap-1 text-[10px] text-neutral-500">
          <ArrowUpDown className="w-3 h-3 text-neutral-400" />
          <button
            onClick={() => setSortBy("price")}
            className={`px-1.5 py-0.5 rounded ${sortBy === "price" ? "font-bold text-neutral-900 bg-neutral-100" : "hover:text-neutral-700"}`}
          >
            ارزان‌ترین
          </button>
          <span>|</span>
          <button
            onClick={() => setSortBy("distance")}
            className={`px-1.5 py-0.5 rounded ${sortBy === "distance" ? "font-bold text-neutral-900 bg-neutral-100" : "hover:text-neutral-700"}`}
          >
            نزدیک‌ترین
          </button>
        </div>
      </div>

      {/* Content: Map or List */}
      {viewMode === "map" ? (
        <div className="rounded-xl overflow-hidden border border-neutral-200 mb-2">
          <StoreMap
            userLocation={{ lat: 35.6948, lon: 51.4089, name: data.user_location_name }}
            stores={mapStores}
            onSelectStore={(id) => setSelectedShopId(id)}
            className="h-60 w-full"
          />
        </div>
      ) : null}

      {filteredOffers.length === 0 ? (
        <div className="text-center py-6 text-neutral-400 text-xs">
          فروشگاهی با این فیلترها یافت نشد.
        </div>
      ) : (
        <div className="space-y-2">
          {filteredOffers.map((offer, idx) => {
            const isFirst = idx === 0;

            return (
              <div
                key={offer.offer_id}
                onClick={() => setSelectedShopId(offer.shop_id)}
                className={`p-3 rounded-xl border transition-all ${
                  selectedShopId === offer.shop_id
                    ? "border-torob-red bg-red-50/10 ring-1 ring-torob-red/20"
                    : "border-neutral-200/90 bg-white hover:border-neutral-300"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="font-bold text-neutral-900 text-xs">
                        {offer.shop_name}
                      </h4>
                      {offer.has_torob_pay_in_person && (
                        <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                          ترب‌پی حضوری
                        </span>
                      )}
                      {offer.traffic_zone?.in_traffic_zone && (
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                          ⚠️ طرح ترافیک
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-neutral-500 flex-wrap">
                      <span>{offer.location_label || "تهران"}</span>
                      {offer.live_eta ? (
                        <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.2 rounded">
                          🚗 {offer.live_eta.duration_minutes} دقیقه با ترافیک زنده نشان ({offer.live_eta.driving_distance_km} کیلومتر)
                        </span>
                      ) : (
                        offer.distance_km !== null && (
                          <>
                            <span>•</span>
                            <span>{offer.distance_km} کیلومتر هوایی</span>
                          </>
                        )
                      )}
                    </div>

                    {offer.floor_unit ? (
                      <p className="text-[10px] text-neutral-500 bg-neutral-50 px-1.5 py-0.5 rounded inline-block">
                        {offer.floor_unit}
                      </p>
                    ) : (
                      offer.address && (
                        <p className="text-[10px] text-neutral-400 line-clamp-1">
                          {offer.address}
                        </p>
                      )
                    )}
                  </div>

                  {/* Price & Action */}
                  <div className="text-left shrink-0">
                    <span className="font-black text-neutral-900 text-xs sm:text-sm block">
                      {formatToman(offer.price_toman)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartSellerCheck(
                          offer.offer_id,
                          offer.shop_name,
                          offer.seller_title,
                          offer.price_toman,
                          idx > 0
                        );
                      }}
                      className="mt-1 py-1 px-2.5 bg-torob-red hover:bg-torob-darkred text-white text-[11px] font-bold rounded-lg transition-transform active:scale-95 shadow-xs"
                    >
                      استعلام موجودی
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

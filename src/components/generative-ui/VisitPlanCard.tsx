"use client";

import React, { useState } from "react";
import { VisitPlanProps } from "@/types/generative-ui";
import { formatToman } from "@/lib/normalize";
import { MapPin, Navigation, Clock, CreditCard, ChevronDown } from "lucide-react";

interface Props {
  data: VisitPlanProps;
}

export default function VisitPlanCard({ data }: Props) {
  const shop = data.selected_shop;
  const [showNavOptions, setShowNavOptions] = useState(false);

  const neshanUrl = `https://neshan.org/maps/@${shop.lat || 35.6948},${shop.lon || 51.4089},16z`;
  const baladUrl = `https://balad.ir/location?latitude=${shop.lat || 35.6948}&longitude=${shop.lon || 51.4089}`;
  const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${shop.lat || 35.6948},${shop.lon || 51.4089}`;

  return (
    <div className="w-full my-3 bg-white rounded-2xl p-4 border border-neutral-300 shadow-xs space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
        <div>
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full inline-block mb-1">
            کارت آماده مراجعه حضوری
          </span>
          <h3 className="font-bold text-neutral-900 text-sm">
            {shop.shop_name}
          </h3>
        </div>

        <div className="text-left">
          <span className="text-[10px] text-neutral-400 block">قیمت قطعی</span>
          <span className="text-sm sm:text-base font-black text-torob-red">
            {formatToman(data.confirmed_price_toman)}
          </span>
        </div>
      </div>

      {/* Product & Warranty */}
      <div className="text-xs text-neutral-700 space-y-0.5">
        <span className="text-neutral-500 text-[11px] block">کالا:</span>
        <p className="font-semibold">{data.product_title}</p>
        <p className="text-[11px] text-neutral-500">{data.warranty || "گارانتی معتبر شرکتی"}</p>
      </div>

      {/* Address & Indoor location */}
      <div className="p-2.5 bg-neutral-50 rounded-xl space-y-1.5 text-xs text-neutral-700">
        <div className="flex items-start gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{shop.address}</span>
        </div>

        {shop.floor_unit && (
          <div className="text-[11px] font-bold text-neutral-800 pr-5">
            موقعیت در مرکز خرید: {shop.floor_unit}
          </div>
        )}
      </div>

      {/* Details Bar */}
      <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-neutral-400" />
          {data.working_hours}
        </span>
        <span className="flex items-center gap-1">
          <CreditCard className="w-3 h-3 text-neutral-400" />
          {data.payment_method}
        </span>
      </div>

      {/* Single Obvious Navigation Action */}
      <div className="pt-2 border-t border-neutral-100 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <a
            href={neshanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-2 px-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>مسیریابی با نشان</span>
          </a>

          <button
            onClick={() => setShowNavOptions(!showNavOptions)}
            className="p-2 border border-neutral-200 hover:bg-neutral-50 rounded-xl text-neutral-600 transition-colors"
            title="سایر مسیریاب‌ها"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${showNavOptions ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Secondary Navigation Options */}
        {showNavOptions && (
          <div className="grid grid-cols-2 gap-2 pt-1 animate-in fade-in">
            <a
              href={baladUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-1.5 px-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-lg text-[11px] font-bold text-center"
            >
              مسیریاب بلد
            </a>
            <a
              href={googleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-1.5 px-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-lg text-[11px] font-bold text-center"
            >
              Google Maps
            </a>
          </div>
        )}
      </div>

      {/* Backup Shop */}
      {data.backup_shop && (
        <div className="text-[10px] text-neutral-400 border-t border-neutral-100 pt-2 flex items-center justify-between">
          <span>فروشگاه پشتیبان (رزرو):</span>
          <span className="font-semibold text-neutral-600">
            {data.backup_shop.shop_name} ({data.backup_shop.location_label})
          </span>
        </div>
      )}
    </div>
  );
}

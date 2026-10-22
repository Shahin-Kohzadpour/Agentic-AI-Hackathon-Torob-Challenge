"use client";

import React, { useState } from "react";
import { VisitPlanProps } from "@/types/generative-ui";
import { formatToman } from "@/lib/normalize";
import { MapPin, Navigation, Clock, CreditCard, ChevronDown, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";

interface Props {
  data: VisitPlanProps;
}

export default function VisitPlanCard({ data }: Props) {
  const shop = data.selected_shop;
  const [showNavOptions, setShowNavOptions] = useState(false);
  const [routeMode, setRouteMode] = useState<"car" | "pedestrian">("car");

  const shopLat = shop.lat || 35.6974;
  const shopLon = shop.lon || 51.4116;

  const neshanUrl = `https://neshan.org/maps/@${shopLat},${shopLon},17z`;
  const baladUrl = `https://balad.ir/location?latitude=${shopLat}&longitude=${shopLon}`;
  const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${shopLat},${shopLon}`;

  const isNearbyForWalking = shop.distance_km !== null && shop.distance_km <= 3.0;

  return (
    <div className="w-full my-3 bg-white rounded-2xl p-4 border border-neutral-300 shadow-sm space-y-3.5 text-right font-sans">
      {/* Header Badge & Store Name */}
      <div className="flex items-start justify-between pb-2 border-b border-neutral-100 gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>موجودی و قیمت قطعی تأیید شد</span>
            </span>
          </div>
          <h3 className="font-black text-neutral-900 text-sm sm:text-base leading-snug">
            {shop.shop_name}
          </h3>
        </div>

        <div className="text-left shrink-0">
          <span className="text-[10px] text-neutral-400 block font-medium">مبلغ قابل پرداخت</span>
          <span className="text-base sm:text-lg font-black text-torob-red">
            {formatToman(data.confirmed_price_toman)}
          </span>
        </div>
      </div>

      {/* Product Spec & Warranty */}
      <div className="text-xs text-neutral-800 bg-neutral-50/80 p-2.5 rounded-xl border border-neutral-100 space-y-1">
        <div className="text-neutral-500 text-[10px] font-medium">کالای انتخابی شما:</div>
        <div className="font-bold text-neutral-900 text-xs sm:text-[13px]">{data.product_title}</div>
        <div className="text-[11px] text-neutral-600 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>{data.warranty || "گارانتی رسمی شرکتی"}</span>
        </div>
      </div>

      {/* Address & Mall Floor/Unit */}
      <div className="p-3 bg-neutral-50/80 rounded-xl space-y-2 text-xs text-neutral-700 border border-neutral-100">
        <div className="flex items-start gap-1.5">
          <MapPin className="w-4 h-4 text-torob-red shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-medium text-neutral-800 leading-relaxed block">
              {shop.address}
            </span>
            {shop.floor_unit && (
              <span className="inline-block text-[11px] font-bold text-neutral-900 bg-white px-2 py-0.5 rounded-md border border-neutral-200 shadow-2xs">
                📍 {shop.floor_unit}
              </span>
            )}
          </div>
        </div>

        {/* Traffic Zone Indicator */}
        {shop.in_traffic_zone && (
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800 bg-amber-50/90 border border-amber-200/80 p-2 rounded-lg">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>
              فروشگاه داخل «محدوده طرح ترافیک تهران» است. (پیشنهاد: مترو یا پیاده‌روی)
            </span>
          </div>
        )}
      </div>

      {/* Neshan Static Map Preview */}
      <div className="rounded-xl overflow-hidden border border-neutral-200 relative bg-neutral-100 h-40">
        <img
          src={`/api/neshan/static-map?lat=${shopLat}&lon=${shopLon}&zoom=15&width=480&height=200`}
          alt={`نقشه دسترسی به ${shop.shop_name}`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute bottom-2 right-2 bg-white/95 backdrop-blur-xs px-2 py-0.5 rounded-md text-[10px] font-bold text-neutral-700 shadow-sm flex items-center gap-1 border border-neutral-200/70">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>نقشه ترافیک زنده نشان</span>
        </div>
      </div>

      {/* Neshan Route Selector (Driving vs Pedestrian) */}
      <div className="p-2.5 bg-sky-50/80 border border-sky-100 rounded-xl space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-sky-900">تخمین زمان رسیدن (نشان):</span>
          <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-sky-200 shadow-2xs">
            <button
              onClick={() => setRouteMode("car")}
              className={`text-[10px] font-bold px-2 py-1 rounded-md transition-all ${
                routeMode === "car"
                  ? "bg-sky-600 text-white shadow-2xs"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              🚗 رانندگی
            </button>
            {isNearbyForWalking && (
              <button
                onClick={() => setRouteMode("pedestrian")}
                className={`text-[10px] font-bold px-2 py-1 rounded-md transition-all ${
                  routeMode === "pedestrian"
                    ? "bg-sky-600 text-white shadow-2xs"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                🚶 پیاده‌روی
              </button>
            )}
          </div>
        </div>

        {routeMode === "car" ? (
          <div className="flex items-center justify-between text-[11px] text-sky-950 pt-0.5">
            <span className="font-bold">
              {data.live_eta ? `${data.live_eta.duration_minutes} دقیقه` : "۱۵-۲۰ دقیقه با ترافیک جاری"}
            </span>
            <span className="text-sky-800">
              {data.live_eta
                ? `${data.live_eta.driving_distance_km} کیلومتر (${data.live_eta.traffic_summary})`
                : `${shop.distance_km || 1.2} کیلومتر`}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between text-[11px] text-sky-950 pt-0.5">
            <span className="font-bold">
              {data.pedestrian_eta
                ? `${data.pedestrian_eta.walking_duration_minutes} دقیقه پیاده‌روی`
                : "۱۰-۱۵ دقیقه پیاده"}
            </span>
            <span className="text-sky-800">
              {data.pedestrian_eta
                ? `${data.pedestrian_eta.walking_distance_meters} متر بدون ترافیک`
                : `${Math.round((shop.distance_km || 0.8) * 1000)} متر`}
            </span>
          </div>
        )}
      </div>

      {/* Details Bar: Hours & Installments */}
      <div className="flex items-center justify-between text-[11px] text-neutral-600 pt-0.5">
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-neutral-400" />
          <span>{data.working_hours}</span>
        </span>
        <span className="flex items-center gap-1 font-bold text-neutral-800">
          <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
          <span>{data.payment_method}</span>
        </span>
      </div>

      {/* Primary 1-Click Action: Navigation */}
      <div className="pt-2 border-t border-neutral-100 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <a
            href={neshanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-2.5 px-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-2 shadow-xs"
          >
            <Navigation className="w-4 h-4 text-emerald-400" />
            <span>مسیریابی با نشان</span>
          </a>

          <button
            onClick={() => setShowNavOptions(!showNavOptions)}
            className="p-2.5 border border-neutral-200 hover:bg-neutral-50 rounded-xl text-neutral-600 transition-colors"
            title="سایر مسیریاب‌ها"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${showNavOptions ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Secondary Navigation Dropdown */}
        {showNavOptions && (
          <div className="grid grid-cols-2 gap-2 pt-1 animate-in fade-in">
            <a
              href={baladUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2 px-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-lg text-[11px] font-bold text-center transition-colors"
            >
              مسیریاب بلد
            </a>
            <a
              href={googleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2 px-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-lg text-[11px] font-bold text-center transition-colors"
            >
              Google Maps
            </a>
          </div>
        )}
      </div>

      {/* Backup Shop Guarantee */}
      {data.backup_shop && (
        <div className="text-[10px] text-neutral-500 border-t border-neutral-100 pt-2 flex items-center justify-between">
          <span>فروشگاه پشتیبان (رزرو بدون معطلی):</span>
          <span className="font-bold text-neutral-700">
            {data.backup_shop.shop_name} ({data.backup_shop.location_label})
          </span>
        </div>
      )}
    </div>
  );
}

"use client";

import React from "react";
import { VisitPlanProps } from "@/types/generative-ui";
import { formatToman } from "@/lib/normalize";
import {
  MapPin,
  Clock,
  CreditCard,
  ShieldCheck,
  Navigation,
  Share2,
  CheckCircle,
  Building,
  Store,
  Compass,
} from "lucide-react";

interface Props {
  data: VisitPlanProps;
}

export default function VisitPlanCard({ data }: Props) {
  const shop = data.selected_shop;
  const neshanUrl = `https://neshan.org/maps/@${shop.lat || 35.6948},${shop.lon || 51.4089},16z`;
  const baladUrl = `https://balad.ir/location?latitude=${shop.lat || 35.6948}&longitude=${shop.lon || 51.4089}`;
  const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${shop.lat || 35.6948},${shop.lon || 51.4089}`;

  return (
    <div className="w-full my-4 bg-gradient-to-b from-white to-gray-50 rounded-2xl p-4 shadow-md border-2 border-emerald-500/30 overflow-hidden">
      {/* Golden Card Header */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900 text-sm md:text-base">
              کارت نهایی مراجعه حضوری (Visit Plan)
            </h3>
            <p className="text-[11px] text-gray-500">آماده برای حرکت به سمت فروشگاه</p>
          </div>
        </div>

        <span className="text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
          استعلام تأیید شده
        </span>
      </div>

      {/* Main Details Grid */}
      <div className="space-y-3">
        {/* Product & Price */}
        <div className="p-3 bg-white rounded-xl border border-gray-100 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-gray-400 block mb-0.5">محصول انتخابی:</span>
            <h4 className="font-bold text-gray-900 text-xs md:text-sm">{data.product_title}</h4>
            <span className="text-[11px] text-emerald-700 font-medium">{data.warranty || "گارانتی شرکتی"}</span>
          </div>

          <div className="text-left shrink-0">
            <span className="text-[11px] text-gray-400 block mb-0.5">قیمت تأییدشده:</span>
            <span className="text-base md:text-lg font-black text-torob-darkred">
              {formatToman(data.confirmed_price_toman)}
            </span>
          </div>
        </div>

        {/* Store & Exact Address */}
        <div className="p-3 bg-white rounded-xl border border-gray-100 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Store className="w-4 h-4 text-torob-red" />
              <span className="font-bold text-gray-900 text-xs md:text-sm">{shop.shop_name}</span>
            </div>
            <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
              منطقه: {shop.location_label}
            </span>
          </div>

          <div className="flex items-start gap-1.5 text-xs text-gray-600">
            <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{shop.address}</span>
          </div>

          {shop.floor_unit && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 p-2 rounded-lg">
              <Building className="w-3.5 h-3.5 shrink-0" />
              <span>موقعیت دقیق در مرکز خرید: {shop.floor_unit}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-gray-100 text-[11px] text-gray-600">
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-emerald-600" />
              <span>{data.working_hours}</span>
            </div>
            <div className="flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5 text-torob-red" />
              <span>{data.payment_method}</span>
            </div>
          </div>
        </div>

        {/* 1-Click Navigation Buttons */}
        <div>
          <span className="text-xs font-bold text-gray-700 block mb-1.5 flex items-center gap-1">
            <Compass className="w-3.5 h-3.5 text-torob-red" />
            مسیریابی مستقیم با یک کلیک:
          </span>
          <div className="grid grid-cols-3 gap-2">
            <a
              href={neshanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2 px-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-center text-xs font-bold transition-transform active:scale-95 shadow-sm flex items-center justify-center gap-1"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>مسیریاب نشان</span>
            </a>
            <a
              href={baladUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2 px-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-center text-xs font-bold transition-transform active:scale-95 shadow-sm flex items-center justify-center gap-1"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>مسیریاب بلد</span>
            </a>
            <a
              href={googleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2 px-2 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-center text-xs font-bold transition-transform active:scale-95 shadow-sm flex items-center justify-center gap-1"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>گوگل مپ</span>
            </a>
          </div>
        </div>

        {/* Backup Store Note */}
        {data.backup_shop && (
          <div className="p-2.5 bg-gray-100/80 rounded-xl text-[11px] text-gray-600 border border-gray-200">
            <span className="font-bold text-gray-800 block mb-0.5">فروشگاه پشتیبان (رزرو):</span>
            <span>
              در صورت تغییر برنامه، فروشگاه «{data.backup_shop.shop_name}» در {data.backup_shop.location_label} با قیمت {formatToman(data.backup_shop.price_toman)} آماده مراجعه است.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

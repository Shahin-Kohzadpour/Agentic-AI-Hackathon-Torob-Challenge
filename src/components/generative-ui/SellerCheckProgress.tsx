"use client";

import React, { useState, useEffect } from "react";
import { SellerCheckProgressProps } from "@/types/generative-ui";
import { formatToman } from "@/lib/normalize";
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  PhoneCall,
  ArrowRight,
  Sparkles,
  RefreshCw,
  FileCheck,
} from "lucide-react";

interface Props {
  data: SellerCheckProgressProps;
  onSelectBackupStore?: () => void;
  onGenerateVisitPlan?: () => void;
}

export default function SellerCheckProgress({
  data,
  onSelectBackupStore,
  onGenerateVisitPlan,
}: Props) {
  const [animProgress, setAnimProgress] = useState(25);

  useEffect(() => {
    const t1 = setTimeout(() => setAnimProgress(65), 400);
    const t2 = setTimeout(() => setAnimProgress(100), 900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const isFailed = data.status === "NO_ANSWER" || data.status === "OUT_OF_STOCK";
  const isSuccess = data.status === "AVAILABLE";

  return (
    <div className="w-full my-4 bg-white/95 rounded-2xl p-4 shadow-sm border border-gray-100 overflow-hidden">
      {/* Simulation Banner Warning (Required by Judges!) */}
      <div className="flex items-center justify-between bg-amber-50 border border-amber-200 text-amber-900 px-3 py-1.5 rounded-xl text-xs mb-3">
        <div className="flex items-center gap-1.5 font-bold">
          <PhoneCall className="w-3.5 h-3.5 text-amber-700 animate-pulse" />
          <span>استعلام ارتباط با فروشنده (شبیه‌سازی‌شده - Mock)</span>
        </div>
        <span className="text-[10px] text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-full font-medium">
          شفافیت دیتاست ترب
        </span>
      </div>

      {/* Target Shop Title */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h4 className="font-bold text-gray-800 text-sm">
            استعلام از: {data.shop_name}
          </h4>
          <p className="text-[11px] text-gray-500">{data.seller_title}</p>
        </div>
        <span className="text-xs text-gray-400">{data.timestamp}</span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full transition-all duration-700 ease-out ${
            isFailed
              ? "bg-rose-500"
              : isSuccess
              ? "bg-emerald-500"
              : "bg-torob-red"
          }`}
          style={{ width: `${animProgress}%` }}
        />
      </div>

      {/* Result Status Box */}
      <div
        className={`p-3 rounded-xl border flex items-start gap-2.5 ${
          isFailed
            ? "bg-rose-50/60 border-rose-200 text-rose-900"
            : isSuccess
            ? "bg-emerald-50/60 border-emerald-200 text-emerald-900"
            : "bg-gray-50 border-gray-200 text-gray-800"
        }`}
      >
        {isFailed ? (
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
        ) : isSuccess ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        ) : (
          <Clock className="w-5 h-5 text-torob-red shrink-0 mt-0.5 animate-spin" />
        )}

        <div className="space-y-1 text-xs">
          <p className="font-bold">
            {data.status === "NO_ANSWER" && "فروشگاه پاسخ نداد (تماس بی‌پاسخ)"}
            {data.status === "OUT_OF_STOCK" && "عدم موجودی کالا در فروشگاه"}
            {data.status === "PRICE_CHANGED" && "تغییر قیمت اعلامی توسط فروشنده"}
            {data.status === "AVAILABLE" && "موجودی و ساعت کاری تأیید شد"}
          </p>
          <p className="leading-relaxed opacity-90">{data.message}</p>
        </div>
      </div>

      {/* Smart Agent Recovery Box (The Crucial Hackathon Feature!) */}
      {data.replacement_suggested && (
        <div className="mt-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl space-y-2">
          <div className="flex items-center gap-1.5 text-blue-900 font-bold text-xs">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span>هوشمندی ایجنت: بازیابی و جایگزینی فوری (Recovery)</span>
          </div>
          <p className="text-[11px] text-blue-800 leading-relaxed">
            گزینه اول پاسخ نداد؛ برای اینکه وقت شما در مراجعه حضوری تلف نشود، فوراً نزدیک‌ترین فروشگاه با همان شرایط ترب‌پی و سقف بودجه جایگزین شد.
          </p>

          <button
            onClick={onSelectBackupStore}
            className="w-full mt-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-98"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>استعلام از فروشگاه دوم ({data.replacement_shop_name || "آوان آران"})</span>
          </button>
        </div>
      )}

      {/* Success -> Go to Visit Plan */}
      {isSuccess && onGenerateVisitPlan && (
        <div className="mt-3">
          <button
            onClick={onGenerateVisitPlan}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-98"
          >
            <FileCheck className="w-4 h-4" />
            <span>تولید کارت نهایی مراجعه حضوری (Visit Plan)</span>
          </button>
        </div>
      )}
    </div>
  );
}

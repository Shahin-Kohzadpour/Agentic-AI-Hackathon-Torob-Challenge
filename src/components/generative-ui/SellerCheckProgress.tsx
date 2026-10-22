"use client";

import React from "react";
import { SellerCheckProgressProps } from "@/types/generative-ui";
import { ArrowLeft, Clock, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

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
  const isFailed = data.status === "NO_ANSWER" || data.status === "OUT_OF_STOCK";
  const isSuccess = data.status === "AVAILABLE";

  return (
    <div className="w-full my-3 bg-white rounded-2xl p-3.5 border border-neutral-200 shadow-xs space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
        <div className="flex items-center gap-2">
          {isSuccess ? (
            <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          ) : isFailed ? (
            <div className="w-5 h-5 rounded-full bg-rose-100 flex items-center justify-center text-rose-700">
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
          ) : (
            <Clock className="w-4 h-4 text-neutral-400 animate-spin" />
          )}

          <div>
            <h4 className="font-bold text-xs text-neutral-900">
              استعلام وضعیت از: {data.shop_name}
            </h4>
            <span className="text-[10px] text-neutral-400">
              پاسخ شبیه‌سازی‌شده فروشنده ({data.timestamp})
            </span>
          </div>
        </div>

        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            isSuccess
              ? "bg-emerald-50 text-emerald-700"
              : isFailed
              ? "bg-rose-50 text-rose-700"
              : "bg-neutral-100 text-neutral-600"
          }`}
        >
          {isSuccess ? "موجودی تأیید شد" : isFailed ? "عدم پاسخگویی" : "در حال استعلام..."}
        </span>
      </div>

      {/* Message explanation */}
      <p className="text-xs text-neutral-600 leading-relaxed">
        {data.message}
      </p>

      {/* Recovery Action if Failed */}
      {data.replacement_suggested && onSelectBackupStore && (
        <div className="pt-2 border-t border-neutral-100 flex items-center justify-between gap-2">
          <span className="text-[11px] text-neutral-500">
            فروشگاه جایگزین واجد شرایط:
          </span>

          <button
            onClick={onSelectBackupStore}
            className="py-1.5 px-3 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-transform active:scale-95 shadow-xs"
          >
            <RefreshCw className="w-3 h-3" />
            <span>استعلام از {data.replacement_shop_name || "فروشگاه دوم"}</span>
          </button>
        </div>
      )}

      {/* Action if Success */}
      {isSuccess && onGenerateVisitPlan && (
        <button
          onClick={onGenerateVisitPlan}
          className="w-full py-2 px-3 bg-torob-red hover:bg-torob-darkred text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-transform active:scale-95 shadow-xs"
        >
          <span>مشاهده کارت نهایی مراجعه حضوری</span>
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

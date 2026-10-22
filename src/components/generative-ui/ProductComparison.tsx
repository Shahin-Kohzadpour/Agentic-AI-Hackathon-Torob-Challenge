"use client";

import React, { useState } from "react";
import { ProductComparisonProps } from "@/types/generative-ui";
import { formatToman } from "@/lib/normalize";
import { Store, ChevronDown, Check } from "lucide-react";

interface Props {
  data: ProductComparisonProps;
  onSelectProduct: (productId: string, productTitle: string) => void;
}

export default function ProductComparison({ data, onSelectProduct }: Props) {
  const [selectedId, setSelectedId] = useState<string>(data.products[0]?.product_id || "");
  const [showSpecMatrix, setShowSpecMatrix] = useState(false);

  return (
    <div className="w-full my-3 bg-neutral-50/80 rounded-2xl p-3 border border-neutral-200/80">
      <div className="flex items-center justify-between mb-2.5 px-0.5">
        <h3 className="text-xs font-bold text-neutral-800">
          مقایسه ۳ مدل پیشنهادی
        </h3>
        <button
          onClick={() => setShowSpecMatrix(!showSpecMatrix)}
          className="text-[11px] text-torob-red hover:underline font-bold flex items-center gap-0.5"
        >
          <span>{showSpecMatrix ? "بستن جدول مشخصات" : "جدول مشخصات"}</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSpecMatrix ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Horizontal Carousel for Mobile */}
      <div className="flex gap-2.5 overflow-x-auto pb-2 scroll-snap-x no-scrollbar -mx-1 px-1">
        {data.products.map((p, idx) => {
          const isSelected = selectedId === p.product_id;
          const isTop = idx === 0;

          return (
            <div
              key={p.product_id}
              onClick={() => setSelectedId(p.product_id)}
              className={`scroll-snap-item shrink-0 w-[240px] bg-white rounded-xl p-3 border cursor-pointer transition-all flex flex-col justify-between ${
                isSelected
                  ? "border-torob-red shadow-sm ring-1 ring-torob-red/20"
                  : "border-neutral-200 hover:border-neutral-300"
              }`}
            >
              <div>
                {/* Header: Top Badge & Seller count */}
                <div className="flex items-center justify-between mb-2">
                  {isTop ? (
                    <span className="text-[10px] font-bold text-torob-red bg-red-50 px-1.5 py-0.5 rounded">
                      پیشنهاد برتر
                    </span>
                  ) : (
                    <span className="text-[10px] text-neutral-400">گزینه {idx + 1}</span>
                  )}
                  <span className="text-[10px] text-neutral-500 flex items-center gap-0.5">
                    <Store className="w-3 h-3 text-neutral-400" />
                    {p.distinct_sellers} فروشگاه
                  </span>
                </div>

                {/* Product Image */}
                <div className="w-full h-24 bg-neutral-50 rounded-lg flex items-center justify-center overflow-hidden mb-2">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.persian_title}
                      className="h-full w-full object-contain p-1"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <span className="text-2xl text-neutral-400">🎧</span>
                  )}
                </div>

                {/* Title */}
                <h4 className="font-bold text-neutral-800 text-xs line-clamp-2 leading-relaxed mb-1" title={p.persian_title}>
                  {p.persian_title}
                </h4>

                {/* Key feature tag */}
                <p className="text-[10px] text-neutral-500 line-clamp-1 mb-2">
                  {p.highlight_specs?.[0]?.value || p.tradeoff_summary.slice(0, 30)}
                </p>
              </div>

              {/* Price & Selection */}
              <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-neutral-400 block leading-tight">شروع از</span>
                  <span className="text-xs font-black text-neutral-900">
                    {formatToman(p.min_price_toman)}
                  </span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectProduct(p.product_id, p.persian_title);
                  }}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    isSelected
                      ? "bg-torob-red text-white hover:bg-torob-darkred shadow-xs"
                      : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3" />}
                  <span>انتخاب</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Generative UI Spec Matrix */}
      {showSpecMatrix && (
        <div className="mt-3 pt-3 border-t border-neutral-200 overflow-x-auto text-[11px] animate-in fade-in">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-400">
                <th className="py-1 px-1.5 font-medium">مدل</th>
                <th className="py-1 px-1.5 font-medium">قیمت پایه</th>
                <th className="py-1 px-1.5 font-medium">فروشنده</th>
                <th className="py-1 px-1.5 font-medium">مزیت اصلی</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {data.products.map((p) => (
                <tr key={p.product_id} className="text-neutral-700">
                  <td className="py-1.5 px-1.5 font-bold line-clamp-1 max-w-[120px]">{p.persian_title}</td>
                  <td className="py-1.5 px-1.5 font-black text-torob-red whitespace-nowrap">{formatToman(p.min_price_toman)}</td>
                  <td className="py-1.5 px-1.5 whitespace-nowrap">{p.distinct_sellers} فروشگاه</td>
                  <td className="py-1.5 px-1.5 text-neutral-500">{p.tradeoff_summary.slice(0, 35)}...</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

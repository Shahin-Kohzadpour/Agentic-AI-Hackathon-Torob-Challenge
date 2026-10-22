"use client";

import React from "react";
import { ProductComparisonProps } from "@/types/generative-ui";
import { formatToman } from "@/lib/normalize";
import { CheckCircle2, Store, Sparkles, ArrowLeft } from "lucide-react";

interface Props {
  data: ProductComparisonProps;
  onSelectProduct: (productId: string, productTitle: string) => void;
}

export default function ProductComparison({ data, onSelectProduct }: Props) {
  return (
    <div className="w-full my-4 bg-white/95 rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-torob-red" />
          <h3 className="font-bold text-gray-800 text-sm md:text-base">
            مقایسه گزینه‌های پیشنهادی متناسب با نیاز شما
          </h3>
        </div>
        <span className="text-xs text-gray-400 font-medium">۳ مدل برتر</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {data.products.map((p, idx) => (
          <div
            key={p.product_id}
            className={`flex flex-col justify-between p-3.5 rounded-xl border transition-all duration-200 hover:shadow-md ${
              idx === 0
                ? "border-torob-red/40 bg-gradient-to-b from-red-50/30 to-white"
                : "border-gray-200 bg-white"
            }`}
          >
            <div>
              {/* Badge for top pick */}
              {idx === 0 && (
                <div className="inline-flex items-center gap-1 bg-torob-red text-white text-[11px] font-bold px-2 py-0.5 rounded-full mb-2">
                  <span>پیشنهاد اول دستیار</span>
                </div>
              )}

              {/* Product Image / Placeholder */}
              <div className="w-full h-28 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden mb-2.5">
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt={p.persian_title}
                    className="h-full object-contain p-1"
                    onError={(e) => {
                      // Fallback icon
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <span className="text-3xl">🎧</span>
                )}
              </div>

              {/* Title & Brand */}
              <h4 className="font-bold text-gray-800 text-xs md:text-sm line-clamp-2 leading-relaxed mb-1.5" title={p.persian_title}>
                {p.persian_title}
              </h4>
              {p.brand_name && (
                <span className="text-[11px] text-gray-500 font-medium">برند: {p.brand_name}</span>
              )}

              {/* Price & Sellers Count */}
              <div className="mt-2.5 py-1.5 px-2 bg-gray-50 rounded-lg flex items-center justify-between">
                <span className="text-[11px] text-gray-500">قیمت از:</span>
                <span className="font-bold text-torob-darkred text-xs md:text-sm">
                  {formatToman(p.min_price_toman)}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-gray-600 mt-2">
                <Store className="w-3.5 h-3.5 text-gray-400" />
                <span>{p.distinct_sellers.toLocaleString("fa-IR")} فروشنده حضوری در تهران</span>
              </div>

              {/* Key Specs */}
              {p.highlight_specs && p.highlight_specs.length > 0 && (
                <div className="mt-2.5 space-y-1">
                  {p.highlight_specs.slice(0, 2).map((s, i) => (
                    <div key={i} className="flex items-start gap-1 text-[11px] text-gray-600">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 mt-0.5 shrink-0" />
                      <span className="line-clamp-1">{s.key}: {s.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Tradeoff description */}
              <p className="mt-2 text-[11px] text-gray-500 leading-relaxed bg-gray-50/70 p-1.5 rounded">
                💡 {p.tradeoff_summary}
              </p>
            </div>

            {/* Select Button */}
            <button
              onClick={() => onSelectProduct(p.product_id, p.persian_title)}
              className="mt-3 w-full py-2 px-3 bg-torob-red hover:bg-torob-darkred text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-sm active:scale-98"
            >
              <span>مشاهده و مقایسه فروشگاه‌ها</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { Sliders, CheckCircle2, AlertTriangle, Shield, ChevronDown, ChevronUp, Sparkles, RefreshCw } from "lucide-react";

interface Props {
  onTriggerDemoScenario: (prompt: string) => void;
}

export default function JudgeDemoPanel({ onTriggerDemoScenario }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [overrideScenario, setOverrideScenario] = useState<string>("AUTO");

  const handleSetOverride = async (scen: string) => {
    setOverrideScenario(scen);
    try {
      await fetch("/api/seller-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "override_scenario", scenario: scen }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-50">
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 py-1.5 px-3 bg-gray-900/90 hover:bg-gray-900 text-white text-xs font-bold rounded-full shadow-lg backdrop-blur border border-gray-700 transition-all hover:scale-105"
      >
        <Sliders className="w-3.5 h-3.5 text-amber-400" />
        <span>پنل داوری و تست سناریوها</span>
        {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
      </button>

      {/* Expanded Panel */}
      {isOpen && (
        <div className="absolute bottom-10 left-0 w-80 bg-gray-900/95 text-white rounded-2xl p-3.5 shadow-2xl border border-gray-700 backdrop-blur z-50 animate-in fade-in slide-in-from-bottom-2 space-y-3">
          <div className="flex items-center justify-between border-b border-gray-800 pb-2">
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              کنترل دمو هکاتون ترب (۳۰۰ امتیاز)
            </span>
            <span className="text-[10px] text-gray-400">Judge Panel</span>
          </div>

          {/* Quick 1-Click Golden Demos */}
          <div>
            <span className="text-[11px] text-gray-300 font-semibold block mb-1.5">
              🚀 اجرای سناریوی طلایی دمو:
            </span>
            <button
              onClick={() => {
                handleSetOverride("AUTO");
                onTriggerDemoScenario(
                  "برای رفت‌وآمد هندزفری می‌خواهم، بودجه‌ام ۴٫۲ میلیون تومان است و حتماً می‌خواهم با ترب‌پی حضوری (قسطی) در محدوده جمهوری خرید کنم."
                );
                setIsOpen(false);
              }}
              className="w-full text-right p-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white text-[11px] font-bold shadow transition-all active:scale-98"
            >
              🌟 اجرای سناریوی کامل انکر R50i + ترب‌پی + بازیابی خودکار
            </button>
          </div>

          {/* Direct Model Search */}
          <div>
            <button
              onClick={() => {
                onTriggerDemoScenario("گوشی سامسونگ s25 fe در تهران چه فروشگاه‌هایی موجود دارند؟");
                setIsOpen(false);
              }}
              className="w-full text-right p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-[11px] transition-colors"
            >
              🔍 تست جستجوی مستقیم مدل (Samsung S25 FE)
            </button>
          </div>

          {/* Out of Catalog Hub Recommendation */}
          <div>
            <button
              onClick={() => {
                onTriggerDemoScenario("برای خرید کتونی ورزشی اصل کجای تهران برم؟");
                setIsOpen(false);
              }}
              className="w-full text-right p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-[11px] transition-colors"
            >
              📍 تست پیشنهاد بورس بازار (منیریه برای کتونی ورزشی)
            </button>
          </div>

          {/* Simulator Outcome Override */}
          <div className="border-t border-gray-800 pt-2">
            <span className="text-[10px] text-gray-400 font-semibold block mb-1">
              تنظیم دستی نتیجه استعلام شبیه‌ساز فروشنده:
            </span>
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              <button
                onClick={() => handleSetOverride("AUTO")}
                className={`p-1 rounded text-center border ${
                  overrideScenario === "AUTO"
                    ? "bg-amber-500/20 border-amber-500 text-amber-300 font-bold"
                    : "border-gray-700 text-gray-400 hover:bg-gray-800"
                }`}
              >
                حالت خودکار طلایی
              </button>
              <button
                onClick={() => handleSetOverride("FORCE_NO_ANSWER")}
                className={`p-1 rounded text-center border ${
                  overrideScenario === "FORCE_NO_ANSWER"
                    ? "bg-rose-500/20 border-rose-500 text-rose-300 font-bold"
                    : "border-gray-700 text-gray-400 hover:bg-gray-800"
                }`}
              >
                اجبار به عدم پاسخ
              </button>
              <button
                onClick={() => handleSetOverride("FORCE_OUT_OF_STOCK")}
                className={`p-1 rounded text-center border ${
                  overrideScenario === "FORCE_OUT_OF_STOCK"
                    ? "bg-rose-500/20 border-rose-500 text-rose-300 font-bold"
                    : "border-gray-700 text-gray-400 hover:bg-gray-800"
                }`}
              >
                اجبار به اتمام موجودی
              </button>
              <button
                onClick={() => handleSetOverride("FORCE_PRICE_CHANGE")}
                className={`p-1 rounded text-center border ${
                  overrideScenario === "FORCE_PRICE_CHANGE"
                    ? "bg-blue-500/20 border-blue-500 text-blue-300 font-bold"
                    : "border-gray-700 text-gray-400 hover:bg-gray-800"
                }`}
              >
                اجبار به افزایش قیمت
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

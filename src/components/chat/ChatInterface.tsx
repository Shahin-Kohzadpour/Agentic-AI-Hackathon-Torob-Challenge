"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, RotateCcw, SlidersHorizontal } from "lucide-react";
import VoiceInput from "./VoiceInput";
import ImageInput from "./ImageInput";
import NeedClarification from "../generative-ui/NeedClarification";
import ProductComparison from "../generative-ui/ProductComparison";
import StoreResults from "../generative-ui/StoreResults";
import SellerCheckProgress from "../generative-ui/SellerCheckProgress";
import VisitPlanCard from "../generative-ui/VisitPlanCard";
import NoMatchAreaSuggestion from "../generative-ui/NoMatchAreaSuggestion";
import JudgeDemoPanel from "../demo/JudgeDemoPanel";
import { UIComponentPayload } from "@/types/generative-ui";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  uiComponent?: UIComponentPayload;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "m_welcome",
      role: "assistant",
      content:
        "سلام! برای شروع خرید حضوری در تهران، نوع کالای مورد نظرتان را بفرمایید یا یکی از دو مسیر زیر را انتخاب کنید:",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState({
    lat: 35.6948,
    lon: 51.4089,
    name: "تهران، محدوده جمهوری / شیخ هادی",
  });

  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = {
      id: `user_${Date.now()}`,
      role: "user",
      content: text,
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          userLocation,
        }),
      });

      const data = await resp.json();

      const assistantMsg: Message = {
        id: `assistant_${Date.now()}`,
        role: "assistant",
        content: data.textResponse || "اطلاعات با موفقیت آماده شد.",
        uiComponent: data.uiComponent,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "assistant",
          content: "خطایی در پردازش رخ داد، لطفاً دوباره امتحان کنید.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectProduct = async (productId: string, productTitle: string) => {
    await sendMessage(`مدل «${productTitle}» را انتخاب کردم. فروشگاه‌های حضوری دارای ترب‌پی در تهران را نمایش بده.`);
  };

  const handleStartSellerCheck = async (
    offerId: string,
    shopName: string,
    sellerTitle: string,
    priceToman: number,
    isBackup: boolean = false
  ) => {
    setIsLoading(true);
    try {
      const resp = await fetch("/api/seller-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId,
          shopName,
          sellerTitle,
          priceToman,
          isBackup,
        }),
      });
      const job = await resp.json();

      const checkMsg: Message = {
        id: `check_${Date.now()}`,
        role: "assistant",
        content: isBackup
          ? `استعلام از فروشگاه جایگزین (${shopName}) آغاز شد.`
          : `استعلام شبیه‌سازی‌شده وضعیت موجودی از فروشگاه «${shopName}» در حال انجام است:`,
        uiComponent: {
          type: "SellerCheckProgress",
          props: job,
        },
      };
      setMessages((prev) => [...prev, checkMsg]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectBackupStore = () => {
    handleStartSellerCheck(
      "offer_3c1ad9b2b3081b07991d5872",
      "آوان آران",
      "هدفون بلوتوثی انکر Soundcore R50i مدل A3949",
      3850000,
      true
    );
  };

  const handleGenerateVisitPlan = () => {
    const visitMsg: Message = {
      id: `visit_${Date.now()}`,
      role: "assistant",
      content: "کارت نهایی مراجعه حضوری صادر شد. قبل از حرکت، جزئیات آدرس و ساعت کاری را بررسی فرمایید:",
      uiComponent: {
        type: "VisitPlan",
        props: {
          product_title: "هدفون بلوتوثی انکر Soundcore R50i مدل A3949",
          selected_shop: {
            shop_id: "shop_60e835a590a4a652ce0ad6d9",
            shop_name: "فروشگاه آوان آران",
            location_label: "شیخ هادی / تقاطع حافظ و جمهوری",
            address: "تهران، خیابان جمهوری، تقاطع حافظ، پاساژ علاءالدین، طبقه ۲، واحد ۲۱",
            floor_unit: "پاساژ علاءالدین، طبقه ۲، واحد ۲۱",
            lat: 35.6974,
            lon: 51.4116,
            distance_km: 0.8,
            in_traffic_zone: true,
            municipality_zone: "11",
          },
          confirmed_price_toman: 3850000,
          warranty: "گارانتی ۶ ماهه شرکتی",
          working_hours: "امروز تا ساعت ۲۰:۳۰ برقرار است",
          payment_method: "ترب‌پی حضوری (خرید اقساطی)",
          verification_badge: "SIMULATED_VERIFIED",
          live_eta: {
            duration_minutes: 8,
            driving_distance_km: 1.1,
            traffic_summary: "خیابان جمهوری اسلامی",
            eta_formatted: "۸ دقیقه با ترافیک زنده نشان (۱.۱ کیلومتر)",
          },
          pedestrian_eta: {
            walking_duration_minutes: 10,
            walking_distance_meters: 820,
            formatted: "۱۰ دقیقه پیاده‌روی (۸۲۰ متر)",
          },
          backup_shop: {
            shop_name: "مهریسا نوین",
            location_label: "شیخ هادی",
            price_toman: 3150000,
          },
        },
      },
    };
    setMessages((prev) => [...prev, visitMsg]);
  };

  const resetSession = () => {
    setMessages([
      {
        id: "m_welcome",
        role: "assistant",
        content:
          "سلام! برای شروع خرید حضوری در تهران، نوع کالای مورد نظرتان را بفرمایید یا یکی از دو مسیر زیر را انتخاب کنید:",
      },
    ]);
  };

  return (
    <div className="mobile-viewport">
      {/* Native App Style Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-neutral-200/80 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-torob-red flex items-center justify-center text-white font-extrabold text-sm shadow-xs">
            ترب
          </div>
          <div>
            <h1 className="font-bold text-neutral-900 text-xs sm:text-sm leading-tight">
              دستیار خرید حضوری
            </h1>
            <span className="text-[10px] text-neutral-400">تهران • کاتالوگ جامع</span>
          </div>
        </div>

        <button
          onClick={resetSession}
          className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
          title="شروع دوباره"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </header>

      {/* Chat Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-3.5">
        {/* Entrance Cards (at start) */}
        {messages.length === 1 && (
          <div className="grid grid-cols-1 gap-2 pt-1">
            <button
              onClick={() =>
                sendMessage(
                  "برای رفت‌وآمد یک هندزفری باکیفیت می‌خواهم با بودجه ۴٫۲ میلیون تومان و ترب‌پی حضوری در جمهوری"
                )
              }
              className="text-right p-3 bg-neutral-50 hover:bg-red-50/50 hover:border-torob-red/30 rounded-xl border border-neutral-200 transition-all flex items-center justify-between group active:scale-98"
            >
              <div>
                <span className="font-bold text-xs text-neutral-900 block group-hover:text-torob-red mb-0.5">
                  «کمکم کن انتخاب کنم»
                </span>
                <span className="text-[11px] text-neutral-500">
                  پیشنهاد ۳ مدل برتر متناسب با بودجه و نیاز شما
                </span>
              </div>
              <span className="text-sm">🎯</span>
            </button>

            <button
              onClick={() =>
                sendMessage(
                  "مدل Anker Soundcore R50i؛ نزدیک‌ترین فروشگاه حضوری دارای ترب‌پی در تهران کجاست؟"
                )
              }
              className="text-right p-3 bg-neutral-50 hover:bg-neutral-100 rounded-xl border border-neutral-200 transition-all flex items-center justify-between group active:scale-98"
            >
              <div>
                <span className="font-bold text-xs text-neutral-900 block mb-0.5">
                  «مدلم را می‌دانم»
                </span>
                <span className="text-[11px] text-neutral-500">
                  استعلام قیمت و موجودی مدل مدنظر در فروشگاه‌های تهران
                </span>
              </div>
              <span className="text-sm">🔍</span>
            </button>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === "user" ? "items-start" : "items-end"}`}
          >
            <div
              className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed ${
                msg.role === "user"
                  ? "bg-torob-red text-white rounded-tr-xs"
                  : "bg-neutral-100 text-neutral-800 rounded-tl-xs"
              }`}
            >
              {msg.content}
            </div>

            {/* Generative UI Components */}
            {msg.uiComponent && (
              <div className="w-full">
                {msg.uiComponent.type === "NeedClarification" && (
                  <NeedClarification
                    data={msg.uiComponent.props}
                    onSelectOption={(opt) => sendMessage(opt)}
                  />
                )}

                {msg.uiComponent.type === "ProductComparison" && (
                  <ProductComparison
                    data={msg.uiComponent.props}
                    onSelectProduct={handleSelectProduct}
                  />
                )}

                {msg.uiComponent.type === "StoreResults" && (
                  <StoreResults
                    data={msg.uiComponent.props}
                    onStartSellerCheck={handleStartSellerCheck}
                  />
                )}

                {msg.uiComponent.type === "SellerCheckProgress" && (
                  <SellerCheckProgress
                    data={msg.uiComponent.props}
                    onSelectBackupStore={handleSelectBackupStore}
                    onGenerateVisitPlan={handleGenerateVisitPlan}
                  />
                )}

                {msg.uiComponent.type === "VisitPlan" && (
                  <VisitPlanCard data={msg.uiComponent.props} />
                )}

                {msg.uiComponent.type === "NoMatchAreaSuggestion" && (
                  <NoMatchAreaSuggestion data={msg.uiComponent.props} />
                )}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-1.5 p-2.5 bg-neutral-100 rounded-xl w-max text-xs text-neutral-500">
            <span className="w-1.5 h-1.5 rounded-full bg-torob-red animate-ping" />
            <span>در حال بررسی...</span>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Floating Judge Demo Panel */}
      <JudgeDemoPanel onTriggerDemoScenario={sendMessage} />

      {/* Native App Style Input Bar */}
      <div className="sticky bottom-0 z-40 bg-white border-t border-neutral-200/80 p-2.5 pb-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex items-center gap-1 bg-neutral-100 rounded-2xl px-2 py-1 border border-neutral-200/90 focus-within:border-neutral-400 focus-within:bg-white transition-all"
        >
          <VoiceInput onTranscriptReady={sendMessage} disabled={isLoading} />
          <ImageInput onImageModelRecognized={sendMessage} disabled={isLoading} />

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="چه محصولی مد نظرتان است؟..."
            disabled={isLoading}
            className="flex-1 bg-transparent border-none text-xs sm:text-[13px] text-neutral-800 placeholder-neutral-400 focus:outline-none px-1.5 py-1"
          />

          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-1.5 bg-torob-red hover:bg-torob-darkred text-white rounded-xl disabled:opacity-30 transition-all shrink-0 active:scale-95"
            title="ارسال"
          >
            <Send className="w-3.5 h-3.5 rotate-180" />
          </button>
        </form>
      </div>
    </div>
  );
}

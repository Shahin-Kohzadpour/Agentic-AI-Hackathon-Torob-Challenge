"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Sparkles, RefreshCw, Compass, ArrowRight, Store, ShieldAlert } from "lucide-react";
import VoiceInput from "./VoiceInput";
import ImageInput from "./ImageInput";
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
        "سلام! من دستیار هوشمند خرید حضوری ترب هستم. چطور می‌توانم در انتخاب مدل و پیدا کردن مطمئن‌ترین فروشگاه در تهران به شما کمک کنم؟",
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
        content: data.textResponse || "اطلاعات با موفقیت پردازش شد.",
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
          content: "خطایی در پردازش رخ داد، لطفاً دوباره تلاش فرمایید.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handler when user selects a product from the comparison card
  const handleSelectProduct = async (productId: string, productTitle: string) => {
    await sendMessage(`محصول «${productTitle}» را انتخاب کردم. لطفاً فروشگاه‌های حضوری موجود در تهران با شرط ترب‌پی حضوری (قسطی) را نمایش بده.`);
  };

  // Handler when user starts checking a store
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
          : `استعلام شبیه‌سازی‌شده وضعیت موجودی و ساعت کاری از فروشگاه «${shopName}» در حال انجام است.`,
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

  // Handler for smart recovery to backup shop (آوان آران)
  const handleSelectBackupStore = () => {
    handleStartSellerCheck(
      "offer_3c1ad9b2b3081b07991d5872",
      "آوان آران",
      "هدفون بلوتوثی انکر Soundcore R50i مدل A3949",
      3850000,
      true
    );
  };

  // Handler for generating final visit card
  const handleGenerateVisitPlan = () => {
    const visitMsg: Message = {
      id: `visit_${Date.now()}`,
      role: "assistant",
      content: "کارت نهایی مراجعه حضوری با موفقیت صادر شد. قبل از حرکت، جزئیات آدرس، واحد در پاساژ و ساعت کاری را بررسی کنید:",
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
          },
          confirmed_price_toman: 3850000,
          warranty: "گارانتی ۶ ماهه شرکتی",
          working_hours: "امروز تا ساعت ۲۰:۳۰ برقرار است",
          payment_method: "ترب‌پی حضوری (خرید اقساطی)",
          verification_badge: "SIMULATED_VERIFIED",
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
          "سلام! من دستیار هوشمند خرید حضوری ترب هستم. چطور می‌توانم در انتخاب مدل و پیدا کردن مطمئن‌ترین فروشگاه در تهران به شما کمک کنم؟",
      },
    ]);
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto bg-gray-50/50">
      {/* Top Header */}
      <header className="bg-white/95 backdrop-blur sticky top-0 z-30 border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-torob-red flex items-center justify-center text-white font-black text-lg shadow-sm">
            ت
          </div>
          <div>
            <h1 className="font-extrabold text-gray-900 text-sm md:text-base flex items-center gap-1.5">
              <span>دستیار خرید حضوری ترب</span>
              <span className="text-[10px] bg-red-100 text-torob-darkred font-bold px-1.5 py-0.2 rounded-full">
                نسخه هکاتون
              </span>
            </h1>
            <p className="text-[11px] text-gray-400">
              «قبل از راه افتادن، انتخابت و وضعیت فروشگاه را بررسی کن»
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={resetSession}
            title="شروع مجدد نشست"
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Quick Entrance Choices (Shown at start) */}
        {messages.length === 1 && (
          <div className="p-4 bg-white rounded-2xl border border-gray-200 shadow-sm space-y-3">
            <span className="text-xs font-bold text-gray-700 block">
              برای شروع، یکی از دو مسیر زیر را انتخاب کنید:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                onClick={() =>
                  sendMessage(
                    "کمکم کن یک هندزفری باکیفیت برای رفت‌وآمد و مکالمه در محدوده جمهوری با بودجه ۴٫۲ میلیون تومان و شرط ترب‌پی حضوری انتخاب کنم."
                  )
                }
                className="text-right p-3 rounded-xl border border-torob-red/30 bg-red-50/30 hover:bg-red-50 hover:border-torob-red transition-all group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-gray-900 group-hover:text-torob-darkred">
                    «کمکم کن انتخاب کنم»
                  </span>
                  <Sparkles className="w-4 h-4 text-torob-red" />
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  راهنمایی هوشمند براساس نیاز، مقایسه ۳ مدل برتر و فیلتر فروشگاه‌ها
                </p>
              </button>

              <button
                onClick={() =>
                  sendMessage(
                    "مدل دقیق مورد نظرم Anker Soundcore R50i است؛ لطفاً فروشگاه‌های دارای ترب‌پی حضوری در تهران را نشان بده."
                  )
                }
                className="text-right p-3 rounded-xl border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-all group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-gray-900">
                    «مدلم را می‌دانم»
                  </span>
                  <Store className="w-4 h-4 text-gray-400" />
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  جستجوی مستقیم در ۳۳۱ هزار آفر و پیدا کردن ارزان‌ترین فروشنده حضوری
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Message Items */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.role === "user" ? "items-start" : "items-end"
            }`}
          >
            <div
              className={`max-w-[92%] sm:max-w-[85%] rounded-2xl px-4 py-3 text-xs md:text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-torob-red text-white rounded-tr-xs shadow-sm self-start"
                  : "bg-white text-gray-800 rounded-tl-xs shadow-xs border border-gray-100 self-end"
              }`}
            >
              {msg.content}
            </div>

            {/* Attached Generative UI Components */}
            {msg.uiComponent && (
              <div className="w-full">
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

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 p-3 bg-white rounded-2xl border border-gray-100 shadow-xs w-max">
            <span className="w-2 h-2 rounded-full bg-torob-red animate-ping" />
            <span className="text-xs text-gray-500 font-medium">
              دستیار در حال بررسی کاتالوگ و شروط خرید...
            </span>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Floating Judge Demo Panel */}
      <JudgeDemoPanel onTriggerDemoScenario={sendMessage} />

      {/* Input Bar */}
      <div className="p-3 bg-white/95 backdrop-blur border-t border-gray-200">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex items-center gap-1.5 bg-gray-100/90 rounded-2xl px-3 py-1.5 border border-gray-200 focus-within:border-torob-red focus-within:bg-white transition-all shadow-inner"
        >
          {/* Multimodal: Push-to-Talk & Product Image */}
          <VoiceInput onTranscriptReady={sendMessage} disabled={isLoading} />
          <ImageInput onImageModelRecognized={sendMessage} disabled={isLoading} />

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="پیام یا نیاز خرید خود را بنویسید (مثلاً: هندزفری انکر r50i با ترب‌پی)..."
            disabled={isLoading}
            className="flex-1 bg-transparent border-none text-xs md:text-sm text-gray-800 placeholder-gray-400 focus:outline-none px-2 py-1.5 font-sans"
          />

          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-2 bg-torob-red hover:bg-torob-darkred text-white rounded-xl disabled:opacity-40 transition-all shadow-sm active:scale-95 shrink-0"
          >
            <Send className="w-4 h-4 rotate-180" />
          </button>
        </form>
      </div>
    </div>
  );
}

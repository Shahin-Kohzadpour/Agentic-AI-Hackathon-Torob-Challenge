"use client";

import React, { useState, useRef } from "react";
import { Image as ImageIcon, X, Sparkles, Check } from "lucide-react";

interface Props {
  onImageModelRecognized: (modelQuery: string) => void;
  disabled?: boolean;
}

export default function ImageInput({ onImageModelRecognized, disabled }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recognizedModel, setRecognizedModel] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
      setIsProcessing(true);

      // Extract model candidate from image (for demo recognition)
      setTimeout(() => {
        setIsProcessing(false);
        setRecognizedModel("Anker Soundcore R50i A3949");
      }, 1200);
    };
    reader.readAsDataURL(file);
  };

  const handleConfirm = () => {
    if (recognizedModel) {
      onImageModelRecognized(recognizedModel);
      handleCancel();
    }
  };

  const handleCancel = () => {
    setPreview(null);
    setRecognizedModel(null);
    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="relative inline-flex items-center">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        title="ورودی عکس محصول (تصویر/جعبه کالا)"
        className="p-2 text-gray-500 hover:text-torob-red hover:bg-red-50 rounded-xl transition-all"
      >
        <ImageIcon className="w-5 h-5" />
      </button>

      {/* Preview & Recognition Dialog */}
      {preview && (
        <div className="absolute bottom-12 right-0 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-gray-200 p-3 z-50 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between border-b border-gray-100 pb-1.5 mb-2">
            <span className="text-[11px] font-bold text-gray-700">تشخیص هوشمند مدل از تصویر:</span>
            <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="relative w-full h-32 bg-gray-100 rounded-xl overflow-hidden mb-2.5 flex items-center justify-center">
            <img src={preview} alt="Upload preview" className="h-full object-contain" />
            {isProcessing && (
              <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white text-xs gap-1">
                <Sparkles className="w-5 h-5 animate-spin text-amber-400" />
                <span>در حال تحلیل تصویر و تطبیق با کاتالوگ...</span>
              </div>
            )}
          </div>

          {recognizedModel && (
            <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-xs mb-2">
              <span className="text-[10px] text-emerald-700 block">مدل شناسایی‌شده در کاتالوگ ترب:</span>
              <span className="font-bold">{recognizedModel}</span>
            </div>
          )}

          <div className="flex justify-end gap-1.5">
            <button
              onClick={handleCancel}
              className="px-2 py-1 text-[11px] text-gray-500 hover:bg-gray-100 rounded-lg"
            >
              انصراف
            </button>
            <button
              onClick={handleConfirm}
              disabled={isProcessing}
              className="px-3 py-1 bg-torob-red hover:bg-torob-darkred text-white text-[11px] font-bold rounded-lg flex items-center gap-1 disabled:opacity-50"
            >
              <Check className="w-3 h-3" />
              <span>جستجوی این مدل</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

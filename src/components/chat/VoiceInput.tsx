"use client";

import React, { useState, useEffect } from "react";
import { Mic, MicOff, Check, X } from "lucide-react";

interface Props {
  onTranscriptReady: (transcript: string) => void;
  disabled?: boolean;
}

export default function VoiceInput({ onTranscriptReady, disabled }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [hasSpeechRecognition, setHasSpeechRecognition] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        setHasSpeechRecognition(true);
        const recog = new SpeechRecognition();
        recog.continuous = false;
        recog.interimResults = true;
        recog.lang = "fa-IR";

        recog.onresult = (event: any) => {
          let current = "";
          for (let i = 0; i < event.results.length; i++) {
            current += event.results[i][0].transcript;
          }
          setTranscript(current);
        };

        recog.onerror = () => {
          setIsRecording(false);
        };

        recog.onend = () => {
          setIsRecording(false);
        };

        setRecognition(recog);
      }
    }
  }, []);

  const toggleRecording = () => {
    if (!hasSpeechRecognition) {
      // Mock voice input for demonstration if browser doesn't have Web Speech API
      setIsRecording(true);
      setTimeout(() => {
        setTranscript("برای رفت‌وآمد هندزفری می‌خواهم، بودجه‌ام چهار میلیون و دویست هزار تومان است و ترب‌پی حضوری می‌خواهم");
        setIsRecording(false);
      }, 1500);
      return;
    }

    if (isRecording) {
      recognition?.stop();
      setIsRecording(false);
    } else {
      setTranscript("");
      recognition?.start();
      setIsRecording(true);
    }
  };

  const handleConfirm = () => {
    if (transcript.trim()) {
      onTranscriptReady(transcript.trim());
      setTranscript("");
    }
  };

  const handleCancel = () => {
    setTranscript("");
    setIsRecording(false);
  };

  return (
    <div className="relative inline-flex items-center">
      {/* Mic Button */}
      <button
        type="button"
        onClick={toggleRecording}
        disabled={disabled}
        title={isRecording ? "توقف ضبط" : "ورودی صوتی (Push-to-Talk)"}
        className={`p-2 rounded-xl transition-all ${
          isRecording
            ? "bg-rose-500 text-white animate-pulse shadow-md"
            : "text-gray-500 hover:text-torob-red hover:bg-red-50"
        }`}
      >
        {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
      </button>

      {/* Editable Transcript Popup */}
      {transcript && (
        <div className="absolute bottom-12 right-0 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-gray-200 p-3 z-50 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between border-b border-gray-100 pb-1.5 mb-2">
            <span className="text-[11px] font-bold text-gray-700">متن تبدیل‌شده صوت (قابل ویرایش):</span>
            <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={2}
            className="w-full text-xs text-gray-800 p-2 rounded-lg border border-gray-200 focus:outline-none focus:border-torob-red resize-none font-sans"
          />

          <div className="flex justify-end gap-1.5 mt-2">
            <button
              onClick={handleCancel}
              className="px-2 py-1 text-[11px] text-gray-500 hover:bg-gray-100 rounded-lg"
            >
              انصراف
            </button>
            <button
              onClick={handleConfirm}
              className="px-3 py-1 bg-torob-red hover:bg-torob-darkred text-white text-[11px] font-bold rounded-lg flex items-center gap-1"
            >
              <Check className="w-3 h-3" />
              <span>ارسال متن</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

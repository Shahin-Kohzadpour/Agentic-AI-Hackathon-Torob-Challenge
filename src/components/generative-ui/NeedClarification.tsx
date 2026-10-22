"use client";

import React from "react";
import { NeedClarificationProps } from "@/types/generative-ui";
import { HelpCircle, ChevronLeft } from "lucide-react";

interface Props {
  data: NeedClarificationProps;
  onSelectOption: (option: string) => void;
}

export default function NeedClarification({ data, onSelectOption }: Props) {
  return (
    <div className="w-full my-2.5 bg-neutral-50/90 rounded-2xl p-3 border border-neutral-200/90 shadow-2xs">
      <div className="flex items-center gap-1.5 mb-2.5 px-0.5">
        <HelpCircle className="w-3.5 h-3.5 text-torob-red shrink-0" />
        <h4 className="font-bold text-neutral-800 text-xs">
          {data.question}
        </h4>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {data.options.map((opt, idx) => (
          <button
            key={idx}
            onClick={() => onSelectOption(opt)}
            className="py-1.5 px-3 bg-white hover:bg-red-50/60 hover:border-torob-red/40 border border-neutral-200/90 text-neutral-800 text-[11px] font-semibold rounded-xl transition-all shadow-2xs active:scale-95 flex items-center gap-1"
          >
            <span>{opt}</span>
            <ChevronLeft className="w-3 h-3 text-neutral-400" />
          </button>
        ))}
      </div>
    </div>
  );
}

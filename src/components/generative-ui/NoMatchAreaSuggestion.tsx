"use client";

import React from "react";
import { NoMatchAreaSuggestionProps } from "@/types/generative-ui";
import { MapPin, Store, Navigation, Compass } from "lucide-react";

interface Props {
  data: NoMatchAreaSuggestionProps;
}

export default function NoMatchAreaSuggestion({ data }: Props) {
  return (
    <div className="w-full my-4 bg-white/95 rounded-2xl p-4 shadow-sm border border-amber-200">
      <div className="flex items-center gap-2 border-b border-gray-100 pb-2.5 mb-3">
        <Compass className="w-5 h-5 text-amber-600" />
        <div>
          <h3 className="font-bold text-gray-800 text-sm md:text-base">
            پیشنهاد راسته بازار و بورس تخصصی کالا در تهران
          </h3>
          <p className="text-[11px] text-gray-500">
            با توجه به محدودیت ثبت این کالا در دیتاست، مراکز اصلی این صنف در تهران پیشنهاد می‌شوند:
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        {data.suggested_hubs.map((hub, idx) => {
          const neshanUrl = `https://neshan.org/maps/@${hub.lat},${hub.lon},15z`;
          const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${hub.lat},${hub.lon}`;

          return (
            <div
              key={idx}
              className="p-3 rounded-xl border border-gray-200 bg-gray-50/50 hover:bg-white hover:border-torob-red/40 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-gray-900 text-xs md:text-sm">
                    <Store className="w-4 h-4 text-torob-red" />
                    <span>{hub.hub_name}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-gray-500">
                    <MapPin className="w-3 h-3 text-gray-400" />
                    <span>محدوده: {hub.district}</span>
                  </div>
                  <p className="text-[11px] text-gray-600 leading-relaxed pt-1">
                    {hub.description}
                  </p>
                </div>

                <div className="flex flex-col gap-1 shrink-0">
                  <a
                    href={neshanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-1 px-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-[10px] font-bold text-center flex items-center justify-center gap-1"
                  >
                    <Navigation className="w-3 h-3" />
                    <span>نشان</span>
                  </a>
                  <a
                    href={googleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-1 px-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-[10px] font-bold text-center flex items-center justify-center gap-1"
                  >
                    <Navigation className="w-3 h-3" />
                    <span>گوگل</span>
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

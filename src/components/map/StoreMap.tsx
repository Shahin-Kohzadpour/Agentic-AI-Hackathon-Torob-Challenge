"use client";

import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapStorePin {
  id: string;
  name: string;
  lat: number;
  lon: number;
  price_toman: number;
  location_label?: string | null;
  isSelected?: boolean;
}

interface StoreMapProps {
  userLocation: { lat: number; lon: number; name: string };
  stores: MapStorePin[];
  onSelectStore?: (storeId: string) => void;
  className?: string;
}

export default function StoreMap({
  userLocation,
  stores,
  onSelectStore,
  className = "h-64 w-full rounded-2xl overflow-hidden shadow-inner border border-gray-200",
}: StoreMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [userLocation.lat, userLocation.lon],
        zoom: 14,
        zoomControl: false,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://openstreetmap.org">OSM</a>',
        maxZoom: 19,
      }).addTo(map);

      markersRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
    }

    const map = mapRef.current;
    const markers = markersRef.current;
    if (!map || !markers) return;

    markers.clearLayers();

    // Custom user icon (Blue pulse)
    const userIcon = L.divIcon({
      className: "custom-user-marker",
      html: `
        <div style="background-color: #2563eb; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(37,99,235,0.6); animation: pulse 2s infinite;"></div>
      `,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    L.marker([userLocation.lat, userLocation.lon], { icon: userIcon })
      .bindPopup(`<div style="direction: rtl; font-family: sans-serif; text-align: center; font-size: 12px; font-weight: bold;">موقعیت شما: ${userLocation.name}</div>`)
      .addTo(markers);

    // Add store markers
    stores.forEach((store) => {
      const isSel = store.isSelected;
      const markerColor = isSel ? "#b71c1c" : "#d32f2f";
      const markerSize = isSel ? 28 : 22;

      const storeIcon = L.divIcon({
        className: "custom-store-marker",
        html: `
          <div style="background-color: ${markerColor}; color: white; width: ${markerSize}px; height: ${markerSize}px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); cursor: pointer;">
            🏪
          </div>
        `,
        iconSize: [markerSize, markerSize],
        iconAnchor: [markerSize / 2, markerSize / 2],
      });

      const neshanUrl = `https://neshan.org/maps/@${store.lat},${store.lon},16z`;
      const baladUrl = `https://balad.ir/location?latitude=${store.lat}&longitude=${store.lon}`;
      const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lon}`;

      const popupContent = `
        <div style="direction: rtl; font-family: sans-serif; min-width: 170px; padding: 4px;">
          <div style="font-weight: bold; font-size: 13px; color: #1f2937;">${store.name}</div>
          <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">${store.location_label || "تهران"}</div>
          <div style="font-size: 12px; font-weight: bold; color: #d32f2f; margin: 6px 0;">
            ${store.price_toman.toLocaleString("fa-IR")} تومان
          </div>
          <div style="display: flex; gap: 4px; margin-top: 8px;">
            <a href="${neshanUrl}" target="_blank" rel="noopener noreferrer" style="flex: 1; text-align: center; background: #e0f2fe; color: #0284c7; padding: 3px 6px; border-radius: 6px; font-size: 10px; text-decoration: none; font-weight: bold;">مسیریاب نشان</a>
            <a href="${baladUrl}" target="_blank" rel="noopener noreferrer" style="flex: 1; text-align: center; background: #fef3c7; color: #d97706; padding: 3px 6px; border-radius: 6px; font-size: 10px; text-decoration: none; font-weight: bold;">بلد</a>
            <a href="${googleUrl}" target="_blank" rel="noopener noreferrer" style="flex: 1; text-align: center; background: #f3f4f6; color: #374151; padding: 3px 6px; border-radius: 6px; font-size: 10px; text-decoration: none; font-weight: bold;">Google</a>
          </div>
        </div>
      `;

      const m = L.marker([store.lat, store.lon], { icon: storeIcon })
        .bindPopup(popupContent)
        .addTo(markers);

      m.on("click", () => {
        if (onSelectStore) {
          onSelectStore(store.id);
        }
      });
    });

    // Fit bounds if stores exist
    if (stores.length > 0) {
      const group = L.featureGroup([
        L.marker([userLocation.lat, userLocation.lon]),
        ...stores.map((s) => L.marker([s.lat, s.lon])),
      ]);
      map.fitBounds(group.getBounds().pad(0.2));
    }
  }, [userLocation, stores, onSelectStore]);

  return <div ref={mapContainerRef} className={className} />;
}

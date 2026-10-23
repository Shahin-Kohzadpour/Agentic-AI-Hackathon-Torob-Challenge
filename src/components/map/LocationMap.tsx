"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Preferences } from "@/types/workflow";

type Point = Preferences["location"];
export default function LocationMap({initialLocation,onChange}:{initialLocation:Point;onChange:(point:Point)=>void}) {
  const container = useRef<HTMLDivElement>(null);
  const callback = useRef(onChange);
  callback.current = onChange;
  const initial = useRef(initialLocation);
  useEffect(() => {
    if (!container.current) return;
    let disposed=false;
    const map = L.map(container.current, {center:[initial.current.lat,initial.current.lon],zoom:14,zoomControl:false,
      maxBounds:[[35.3,50.7],[36.1,52]],maxBoundsViscosity:1,minZoom:10,inertia:false,zoomAnimation:false});
    L.control.zoom({position:"bottomleft"}).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',maxZoom:19,
    }).addTo(map);
    const update = () => {
      if(disposed)return;
      const point=map.getCenter();
      callback.current({lat:point.lat,lon:point.lng,label:"موقعیت انتخابی روی نقشه"});
    };
    map.on("moveend",update);
    map.on("click",event=>map.panTo(event.latlng,{animate:false}));
    const observer = new ResizeObserver(()=>{if(!disposed)map.invalidateSize();});
    observer.observe(container.current);
    const timer=setTimeout(()=>{if(!disposed)map.invalidateSize();},0);
    return()=>{disposed=true;clearTimeout(timer);observer.disconnect();map.stop();map.remove();};
  },[]);
  return <div ref={container} className="location-map" role="region" aria-label="نقشهٔ انتخاب موقعیت؛ نقشه را جابه‌جا کنید یا نقطهٔ دلخواه را لمس کنید"/>;
}

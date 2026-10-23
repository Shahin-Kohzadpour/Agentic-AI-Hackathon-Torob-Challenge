"use client";
import {useEffect,useRef} from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
export interface MapStorePin {id:string;name:string;lat:number;lon:number;price_toman:number|null;location_label?:string|null;isSelected?:boolean;kind?:"shop"|"area"}
export default function StoreMap({userLocation,stores,onSelectStore,className="store-map"}:{userLocation:{lat:number;lon:number;name:string};stores:MapStorePin[];onSelectStore?:(id:string)=>void;className?:string}) {
  const container=useRef<HTMLDivElement>(null),mapRef=useRef<L.Map|null>(null),layer=useRef<L.LayerGroup|null>(null),boundsKey=useRef("");
  const callback=useRef(onSelectStore);callback.current=onSelectStore;
  const initial=useRef(userLocation);
  useEffect(()=>{
    if(!container.current)return;let disposed=false;
    const map=L.map(container.current,{center:[initial.current.lat,initial.current.lon],zoom:14,zoomControl:false,inertia:false,zoomAnimation:false});
    mapRef.current=map;layer.current=L.layerGroup().addTo(map);L.control.zoom({position:"bottomleft"}).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
    const resize=new ResizeObserver(()=>{if(!disposed)map.invalidateSize()});resize.observe(container.current);
    return()=>{disposed=true;resize.disconnect();map.stop();map.remove();mapRef.current=null;layer.current=null;boundsKey.current=""};
  },[]);
  const key=JSON.stringify({userLocation,stores});
  useEffect(()=>{
    const map=mapRef.current,markers=layer.current;if(!map||!markers)return;
    const current: {userLocation:typeof userLocation;stores:MapStorePin[]}=JSON.parse(key);
    markers.clearLayers();
    L.marker([current.userLocation.lat,current.userLocation.lon],{icon:L.divIcon({className:"user-map-pin",html:'<span></span>',iconSize:[22,22],iconAnchor:[11,11]})}).bindPopup(`مبدأ: ${escape(current.userLocation.name)}`).addTo(markers);
    current.stores.forEach((pin,index)=>{
      const marker=L.marker([pin.lat,pin.lon],{title:pin.name,alt:pin.name,icon:L.divIcon({className:`decision-map-pin ${pin.kind==="area"?"hub-pin":"shop-pin"} ${pin.isSelected?"active":""}`,html:`<span>${pin.kind==="area"?"◆":String(index+1).replace(/\d/g,c=>"۰۱۲۳۴۵۶۷۸۹"[Number(c)])}</span>`,iconSize:[44,44],iconAnchor:[22,22]})}).addTo(markers);
      marker.bindTooltip(escape(pin.name),{direction:"top"});marker.on("click",()=>callback.current?.(pin.id));
      if(pin.isSelected)L.polyline([[current.userLocation.lat,current.userLocation.lon],[pin.lat,pin.lon]],{color:pin.kind==="area"?"#176e72":"#d32f2f",weight:2,dashArray:"4,7"}).addTo(markers);
    });
    const topology=JSON.stringify([current.userLocation.lat,current.userLocation.lon,...current.stores.flatMap(p=>[p.id,p.lat,p.lon])]);
    if(topology!==boundsKey.current&&current.stores.length){map.fitBounds(L.latLngBounds([[current.userLocation.lat,current.userLocation.lon],...current.stores.map(p=>[p.lat,p.lon] as [number,number])]).pad(.2),{animate:false,maxZoom:15});boundsKey.current=topology;}
    else {const selected=current.stores.find(p=>p.isSelected);if(selected&&!map.getBounds().contains([selected.lat,selected.lon]))map.panTo([selected.lat,selected.lon],{animate:false});}
  },[key]);
  return <div ref={container} className={className} role="region" aria-label="نقشهٔ تعاملی مبدأ، فروشگاه‌ها و محدوده‌های خرید"/>;
}

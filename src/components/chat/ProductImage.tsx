"use client";
import {useEffect,useState} from "react";
import {PackageSearch} from "lucide-react";
export default function ProductImage({src,title}:{src:string|null;title:string}) {
  const [status,setStatus]=useState<"loading"|"ready"|"unavailable">(src?"loading":"unavailable");
  useEffect(()=>{setStatus(src?"loading":"unavailable");const timer=setTimeout(()=>setStatus(s=>s==="loading"?"unavailable":s),6500);return()=>clearTimeout(timer)},[src]);
  return <div className="product-image">{status!=="ready"&&<div className="product-image-placeholder"><PackageSearch size={38}/><span>{status==="loading"?"در حال بارگذاری تصویر":"تصویر در دسترس نیست"}</span></div>}{src&&<img src={src} alt={title} style={{opacity:status==="ready"?1:0}} onLoad={()=>setStatus("ready")} onError={()=>setStatus("unavailable")}/>}</div>;
}

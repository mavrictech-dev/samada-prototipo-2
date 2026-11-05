"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import {applyTheme,preferredTheme,THEME_EVENT,THEME_KEY} from "@/lib/theme";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const sync=()=>setDark(document.documentElement.dataset.theme==="dark");
    const updatePreference=()=>applyTheme(preferredTheme());
    const storage=(event:StorageEvent)=>{if(event.key===THEME_KEY||event.key===null)updatePreference();};
    const media=window.matchMedia("(prefers-color-scheme: dark)");
    updatePreference();
    window.addEventListener(THEME_EVENT,sync);
    window.addEventListener("storage",storage);
    media.addEventListener("change",updatePreference);
    sync();
    return()=>{window.removeEventListener(THEME_EVENT,sync);window.removeEventListener("storage",storage);media.removeEventListener("change",updatePreference);};
  }, []);

  const toggle = () => {
    applyTheme(document.documentElement.dataset.theme==="dark"?"light":"dark",true);
  };

  return <button type="button" onClick={toggle} className={`theme-toggle ${compact ? "size-10" : "h-10 px-3"}`} aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"} title={dark ? "Modo claro" : "Modo oscuro"}>
    {dark ? <Sun size={17}/> : <Moon size={17}/>} {!compact && <span className="hidden sm:inline">{dark ? "Claro" : "Oscuro"}</span>}
  </button>;
}

export function SamadaLogo({ className = "" }: { className?: string }) {
  return <span className={`samada-logo ${className}`} aria-label="Samada">
    <img src="/assets/samada-logo.webp" alt="Samada" className="logo-positive"/>
    <img src="/assets/samada-logo-negative.webp" alt="" className="logo-negative" aria-hidden="true"/>
  </span>;
}

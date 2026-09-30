"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const THEME_KEY = "samada-theme";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    const next = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = next ? "dark" : "light";
    setDark(next);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    localStorage.setItem(THEME_KEY, next ? "dark" : "light");
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

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, MessageCircle, PackageCheck } from "lucide-react";
import type { CatalogPage, Product } from "@/lib/types";

declare global {
  interface Window {
    jQuery?: JQueryTurnFactory;
    $?: JQueryTurnFactory;
  }
}

type TurnCommand = string | Record<string, unknown>;
type JQueryTurnInstance = { turn: (command: TurnCommand, ...args: unknown[]) => unknown };
type JQueryTurnFactory = ((element: HTMLElement) => JQueryTurnInstance) & { fn?: { turn?: unknown } };

type Sheet = { id: string; label: string; node: React.ReactNode };

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const found = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (found?.dataset.loaded === "true") return resolve();
    const script = found || document.createElement("script");
    script.src = src; script.async = false;
    script.onload = () => { script.dataset.loaded = "true"; resolve(); };
    script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    if (!found) document.body.appendChild(script);
  });
}

function PageHeader({ label }: { label: string }) {
  return <div className="mb-5 flex items-center justify-between text-[10px] text-[#747b70]"><img src="/assets/samada-logo.webp" alt="Samada" className="w-20"/><span>{label}</span></div>;
}

export function TurnBook({ pages, products, onProduct, onContact }: {
  pages: CatalogPage[];
  products: Product[];
  onProduct: (product: Product) => void;
  onContact: () => void;
}) {
  const bookRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(2);
  const [ready, setReady] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 920, height: 652 });
  const syncAccessibility = useCallback((page: number, single: boolean) => {
    const visible = single ? [page] : page % 2 === 0 ? [page,page+1] : [page-1,page];
    bookRef.current?.querySelectorAll<HTMLElement>(".book-sheet").forEach((sheet,index) => {
      const shown = visible.includes(index + 1);
      sheet.inert = !shown;
      sheet.setAttribute("aria-hidden",String(!shown));
    });
  },[]);

  const sheets = useMemo<Sheet[]>(() => {
    const result: Sheet[] = [
      { id:"cover-photo", label:"Portada", node:<div className="book-photo-page"><img src="/assets/editorial.png" alt="Colección de cuidado Samada"/><div className="absolute inset-0 flex flex-col bg-gradient-to-b from-black/10 via-transparent to-black/35 p-[9%] text-white"><img src="/assets/samada-logo-negative.webp" alt="Samada" className="w-36"/><span className="mt-2 text-[9px] tracking-[.28em]">CATÁLOGO MAYORISTA / 2026</span><h2 className="mt-auto text-3xl font-medium leading-[1.08] tracking-[-.05em]">Productos que<br/>mueven tu negocio.</h2><p className="mt-4 text-[10px]">Selección para distribuidores</p></div></div> },
      { id:"cover-copy", label:"Bienvenida", node:<div className="book-page"><PageHeader label="Distribuidores · 2026"/><div className="mt-[12%] text-[#558B2F]"><PackageCheck size={36} strokeWidth={1.3}/></div><h2 className="mt-6 text-[clamp(30px,4vw,54px)] font-medium leading-[1.02] tracking-[-.065em]">Tu catálogo.<br/>Tu próxima venta.</h2><p className="mt-6 max-w-sm text-sm leading-6 text-[#596056]">Descubre precios mayoristas, pedidos mínimos y una selección organizada para encontrar cada producto sin fricción.</p><button onClick={onContact} className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#7CB342] px-5 py-3 text-xs font-semibold text-[#18240e]"><MessageCircle size={16}/>Hablar con un asesor</button><div className="mt-auto border-t border-[#e0e4dc] pt-5 text-[10px] text-[#747b70]">Compra inteligente para tu punto de venta.</div></div> }
    ];
    pages.filter(page => page.published && page.type === "products").forEach(page => {
      const items = page.productIds.map(id => products.find(product => product.id === id)).filter(Boolean) as Product[];
      if (!items.length) return;
      const [hero, ...rest] = items;
      result.push({ id:`${page.id}-hero`, label:page.title, node:
        <div className={`book-page page-theme-${page.theme}`}><PageHeader label={page.subtitle}/><span className="inline-flex rounded-full bg-[#7CB342] px-3 py-1 text-[9px] font-semibold">Selección para tu negocio</span><h2 className="mt-2 text-xl font-medium leading-[1.08] tracking-[-.055em] sm:text-2xl md:mt-4 md:text-3xl">{page.title}</h2><button className="my-2 grid min-h-0 flex-1 place-items-center overflow-hidden md:my-4" onClick={()=>onProduct(hero)}><img src={hero.image} alt={hero.name} className="max-h-44 w-auto max-w-full object-contain drop-shadow-xl sm:max-h-52 md:max-h-64"/></button><h3 className="line-clamp-1 text-base font-semibold md:text-lg">{hero.name}</h3><p className="mt-0.5 text-[9px] text-[#6f766b] md:text-[10px]">{hero.sku} · {hero.presentation} · mínimo {hero.minOrder} u.</p><div className="mt-3 flex items-end justify-between md:mt-4"><div><span className="text-[8px] text-[#6f766b] md:text-[9px]">Precio distribuidor</span><p className="text-xl font-semibold md:text-2xl">S/ {hero.wholesalePrice.toFixed(2)}</p></div><button onClick={()=>onProduct(hero)} className="rounded-lg bg-[#7CB342] px-3.5 py-2 text-[9px] font-semibold md:px-4 md:py-2.5 md:text-[10px]">Ver producto</button></div></div> });
      result.push({ id:`${page.id}-grid`, label:page.title, node:
        <div className="book-page"><PageHeader label={page.subtitle}/><h2 className="text-xl font-medium tracking-[-.04em] sm:text-2xl">Listos para rotar.</h2><div className="mt-3 grid min-h-0 flex-1 grid-cols-2 gap-2 sm:gap-3 md:mt-5">{rest.slice(0,6).map(product=><button key={product.id} onClick={()=>onProduct(product)} className="group relative flex min-h-0 flex-col border-b border-[#e2e5de] pb-1.5 text-left md:pb-2"><span className="absolute right-1 top-1 z-10 grid size-5 place-items-center rounded-full bg-white text-xs font-bold text-[#333] shadow-sm md:size-6 md:text-sm">+</span><span className="grid h-16 w-full place-items-center overflow-hidden rounded-md bg-[#f1f4ec] p-1 sm:h-20 md:h-24"><img src={product.image} alt="" className="h-full w-full object-contain transition-transform group-hover:-rotate-3 group-hover:scale-105"/></span><span className="mt-1 line-clamp-2 text-[9px] font-semibold leading-tight md:text-[10px]">{product.name}</span><span className="mt-auto flex justify-between pt-1 text-[8px] text-[#747b70]"><span>{product.sku}</span><b className="text-[#30352f]">S/ {product.wholesalePrice.toFixed(2)}</b></span></button>)}</div><div className="mt-2 flex justify-between text-[8px] text-[#747b70] md:mt-4 md:text-[9px]"><span>{items.length} productos en esta página</span><span>Stock sujeto a confirmación</span></div></div> });
    });
    result.push(
      { id:"closing", label:"Asesoría", node:<div className="book-page"><PageHeader label="Tu siguiente pedido"/><h2 className="mt-[15%] text-4xl font-medium leading-[1.05] tracking-[-.06em]">Construyamos una selección que sí se mueve.</h2><p className="mt-6 max-w-sm text-sm leading-6 text-[#596056]">Comparte tu lista con una sede y recibe apoyo para ajustar cantidades, disponibilidad y surtido.</p><button onClick={onContact} className="mt-8 inline-flex items-center gap-2 rounded-xl border border-[#252b23] px-5 py-3 text-xs font-semibold"><MessageCircle size={16}/>Solicitar asesoría</button><div className="mt-auto text-2xl font-semibold tracking-[-.07em] text-[#558B2F]">samada</div></div> },
      { id:"back", label:"Contraportada", node:<div className="book-back"><img src="/assets/samada-logo.webp" alt="Samada" className="w-52"/><p className="mt-3 text-xs">Bienestar que se siente.<br/>Negocios que crecen.</p></div> }
    );
    return result;
  }, [pages, products, onContact, onProduct]);

  useEffect(() => {
    let cancelled = false;
    const bookElement = bookRef.current;
    const setup = async () => {
      await loadScript("/vendor/jquery-1.7.js");
      await loadScript("/vendor/turn.js");
      if (cancelled || !bookElement || !window.jQuery?.fn?.turn) return;
      const isMobile = window.innerWidth < 900;
      setMobile(isMobile);
      const stage = bookElement.closest<HTMLElement>(".relative") || bookElement.parentElement;
      const available = Math.min((stage?.clientWidth ? stage.clientWidth - (isMobile ? 32 : 120) : 1000), isMobile ? 470 : 1050);
      const width = isMobile ? available : Math.min(available, 920);
      const height = width / (isMobile ? .705 : 1.41);
      setDimensions({ width, height });
      const $book = window.jQuery(bookElement);
      if ($book.turn("is")) $book.turn("destroy");
      $book.turn({
        width,
        height,
        display: isMobile ? "single" : "double",
        page: 2,
        autoCenter: true,
        elevation: 70,
        gradients: true,
        duration: 700,
        when: {
          turning: (_: unknown, page: number) => {
            setActive(page);
            syncAccessibility(page, isMobile);
          },
          turned: (_: unknown, page: number) => {
            setActive(page);
            syncAccessibility(page, isMobile);
          }
        }
      });
      syncAccessibility(2, isMobile);
      setReady(true);
    };
    setup().catch(()=>setReady(false));
    return () => {
      cancelled = true;
      try { const $book = bookElement && window.jQuery?.(bookElement); if ($book?.turn("is")) $book.turn("destroy"); } catch { /* Turn.js cleanup */ }
    };
  }, [sheets.length,syncAccessibility]);

  useEffect(() => {
    const resize = () => {
      const bookElement = bookRef.current;
      if (!bookElement || !window.jQuery?.fn?.turn) return;
      const nextMobile = window.innerWidth < 900;
      const stage = bookElement.closest<HTMLElement>(".relative") || bookElement.parentElement;
      const available = Math.min((stage?.clientWidth ? stage.clientWidth - (nextMobile ? 32 : 120) : 1000), nextMobile ? 470 : 1050);
      const width = nextMobile ? available : Math.min(available, 920);
      const height = width / (nextMobile ? .705 : 1.41);
      setDimensions({ width, height });
      const $book = window.jQuery(bookElement);
      try {
        $book.turn("display", nextMobile ? "single" : "double");
        $book.turn("size", width, height);
        setMobile(nextMobile);
        syncAccessibility(active, nextMobile);
      } catch { /* not initialized */ }
    };
    window.addEventListener("resize",resize);
    return ()=>window.removeEventListener("resize",resize);
  },[active,syncAccessibility]);

  const move = (direction:"next"|"previous") => { const bookElement=bookRef.current; if(!bookElement)return; try { window.jQuery?.(bookElement).turn(direction); } catch { /* no-op */ } };
  const view = mobile ? [active] : active % 2 === 0 ? [active,active+1] : [active-1,active];
  const canPrevious = active > 1;
  const canNext = active < sheets.length;
  const isCover = !mobile && active === 1;
  const isBack = !mobile && active === sheets.length;
  const frameClass = mobile ? "book-frame-single" : isCover ? "book-frame-cover" : isBack ? "book-frame-back" : "book-frame-spread";

  return <div className="w-full">
    <div className="relative mx-auto flex max-w-[1100px] items-center justify-center px-8 md:px-16">
      <button onClick={()=>move("previous")} disabled={!canPrevious} className="book-arrow left-0" aria-label="Página anterior"><ChevronLeft/></button>
      <div className={`book-frame ${frameClass}`} style={{ width: dimensions.width, height: dimensions.height }}><div ref={bookRef} className="flipbook">{sheets.map((sheet,index)=><article key={sheet.id} className="book-sheet" aria-label={`Página ${index+1}: ${sheet.label}`}>{sheet.node}</article>)}</div></div>
      <button onClick={()=>move("next")} disabled={!canNext} className="book-arrow right-0" aria-label="Página siguiente"><ChevronRight/></button>
    </div>
    <div className="mx-auto mt-6 flex max-w-3xl items-center justify-center gap-4 text-xs text-[#6f766b]"><button onClick={()=>move("previous")} disabled={!canPrevious} className="disabled:opacity-30 disabled:pointer-events-none" aria-label="Retroceder una página"><ChevronLeft size={18}/></button><span className="min-w-24 text-center font-medium text-[#353a33]">{view.filter(n=>n>0&&n<=sheets.length).map(n=>String(n).padStart(2,"0")).join("–")} / {String(sheets.length).padStart(2,"0")}</span><button onClick={()=>move("next")} disabled={!canNext} className="disabled:opacity-30 disabled:pointer-events-none" aria-label="Avanzar una página"><ChevronRight size={18}/></button><div className="ml-3 flex gap-1">{sheets.map((sheet,index)=><button key={sheet.id} onClick={()=>{const bookElement=bookRef.current;if(!bookElement)return;try{window.jQuery?.(bookElement).turn("page",index+1)}catch{}}} className={`h-1.5 rounded-full transition-all ${view.includes(index+1)?"w-5 bg-[#558B2F]":"w-1.5 bg-[#b9beb5]"}`} aria-label={`Ir a página ${index+1}`}/>)}</div></div>
    {!ready && <p className="mt-3 text-center text-xs text-[#747b70]">Preparando la revista…</p>}
  </div>;
}

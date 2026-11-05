export const THEME_KEY="samada-theme";
export const THEME_EVENT="samada-theme-change";
export type Theme="light"|"dark";
export function preferredTheme():Theme{
 let saved:string|null=null;
 try{saved=localStorage.getItem(THEME_KEY);}catch{}
 if(saved==="dark"||saved==="light")return saved;
 return window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
}
export function applyTheme(theme:Theme,persist=false){
 document.documentElement.dataset.theme=theme;
 document.documentElement.style.colorScheme=theme;
 if(persist)try{localStorage.setItem(THEME_KEY,theme);}catch{}
 window.dispatchEvent(new Event(THEME_EVENT));
}
// Runs before the page content is painted, including when storage is unavailable.
export const themeBootstrap=`(()=>{let t;try{t=localStorage.getItem("samada-theme")}catch{}if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t})()`;

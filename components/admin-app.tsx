"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect,useState } from "react";
import { LayoutDashboard,Package,Tags,BookOpen,FileSpreadsheet,Images,Users,Shield,KeyRound,History,Settings,UserRound,LogOut,ArrowUpRight,Menu,X,ArrowRight } from "lucide-react";
import { useCms } from "./cms-provider";
import { ThemeToggle } from "./theme-toggle";
import { authClient } from "@/lib/auth-client";
import { ProductsPanel } from "./cms/products";
import { TaxonomyPanel } from "./cms/taxonomy";
import { PagesPanel } from "./cms/pages";
import { JobsPanel } from "./cms/jobs";
import { SecurityPanel } from "./cms/security";
import { SettingsPanel,AccountPanel } from "./cms/settings";
import { AuditPanel } from "./cms/audit";
import { Badge,PageHeading } from "./cms/ui";
import type { CurrentUser } from "@/lib/types";
const nav=[
 {id:'dashboard',label:'Resumen',icon:LayoutDashboard,permission:''},
 {id:'products',label:'Productos',icon:Package,permission:'products.read'},
 {id:'taxonomy',label:'Marcas y tamaños',icon:Tags,permission:'taxonomy.read'},
 {id:'pages',label:'Distribución',icon:BookOpen,permission:'pages.read'},
 {id:'imports',label:'Excel y CSV',icon:FileSpreadsheet,permission:'imports.read'},
 {id:'media',label:'Imágenes por SKU',icon:Images,permission:'media.read'},
 {id:'users',label:'Usuarios',icon:Users,permission:'users.read'},
 {id:'roles',label:'Roles',icon:Shield,permission:'roles.read'},
 {id:'permissions',label:'Permisos',icon:KeyRound,permission:'permissions.read'},
 {id:'audit',label:'Actividad',icon:History,permission:'audit.read'},
 {id:'settings',label:'Configuración',icon:Settings,permission:'settings.read'},
 {id:'account',label:'Mi cuenta',icon:UserRound,permission:''},
];
export function AdminApp({user}:{user:CurrentUser}){
 const router=useRouter();
 const [catalogUrl,setCatalogUrl]=useState('/');useEffect(()=>{if(location.hostname==='gestion.samadaperu.com')setCatalogUrl('https://samadaperu.com');},[]);
 const {state,ready,error,refresh}=useCms();const [section,setSection]=useState('dashboard'),[mobile,setMobile]=useState(false),[notice,setNotice]=useState('');
 const notify=(text:string)=>{setNotice(text);setTimeout(()=>setNotice(''),5000);};
 const active=nav.find(item=>item.id===section);
 return <div className="cms-shell">
  {mobile&&<button className="cms-nav-scrim" aria-label="Cerrar menú" onClick={()=>setMobile(false)}/>}
  <aside className={`cms-sidebar ${mobile?'is-open':''}`}><Link href="/admin" className="cms-brand"><img src="/assets/samada-logo-negative.webp" alt="Samada"/><span>GESTIÓN DE CATÁLOGO</span></Link><nav>{nav.filter(item=>!item.permission||user.permissions.includes(item.permission)).map(({id,label,icon:Icon})=><button key={id} className={section===id?'active':''} onClick={()=>{setSection(id);setMobile(false);}}><Icon size={17}/>{label}{id==='products'&&<small>{state.products.length}</small>}</button>)}</nav><div className="cms-sidebar-user"><span className="cms-avatar">{user.name.slice(0,1)}</span><div><b>{user.name}</b><small>{user.email}</small></div><button aria-label="Cerrar sesión" onClick={async()=>{await authClient.signOut();router.push('/login');router.refresh();}}><LogOut size={16}/></button></div></aside>
  <div className="cms-workspace"><header className="cms-topbar"><button className="cms-icon-button cms-mobile-menu" aria-label="Abrir menú" onClick={()=>setMobile(true)}><Menu size={19}/></button><div><span className="cms-eyebrow">SAMADA / ADMINISTRACIÓN</span><h1>{active?.label}</h1></div><div className="ml-auto flex items-center gap-2"><ThemeToggle compact/><a href={catalogUrl} target="_blank" rel="noreferrer" className="cms-button-secondary"><span className="hidden sm:inline">Ver catálogo</span><ArrowUpRight size={16}/></a></div></header>
  <main className="cms-main">{!ready?<div className="cms-empty">Cargando tu espacio de trabajo…</div>:error?<div className="cms-error">{error}<button onClick={()=>void refresh()} className="cms-button-secondary ml-4">Reintentar</button></div>:<>
   {section==='dashboard'&&<><PageHeading eyebrow="ESTADO ACTUAL DEL CATÁLOGO" title="Cada producto, en su lugar." description="Organiza el surtido, prepara cargas masivas y publica una selección lista para tus distribuidores."/><div className="cms-stats">{[{n:state.products.length,label:'SKU en catálogo',note:`${state.products.filter(p=>p.active).length} publicados`,icon:Package},{n:state.brands.length,label:'Marcas',note:`${state.categories.length} categorías`,icon:Tags},{n:state.sizes.length,label:'Tamaños',note:'Presentaciones configurables',icon:BookOpen},{n:state.products.filter(p=>p.stock<12).length,label:'Por revisar',note:'Menos de 12 unidades de stock',icon:History}].map(({n,label,note,icon:Icon})=><article className="cms-card" key={label}><div className="flex justify-between"><span className="cms-icon"><Icon size={20}/></span><strong>{n}</strong></div><h3>{label}</h3><p className="cms-muted">{note}</p></article>)}</div><div className="cms-dashboard-grid"><section className="cms-card"><h3 className="text-lg font-semibold">Tu siguiente carga</h3><p className="cms-muted mt-2 text-sm leading-6">La plantilla usa las marcas, categorías y tamaños actuales. Primero revisas las filas; después confirmas los cambios.</p><div className="cms-flow"><span>Configurar surtido</span><ArrowRight size={14}/><span>Rellenar Excel</span><ArrowRight size={14}/><span>Revisar y aplicar</span></div>{user.permissions.includes('imports.read')&&<button className="cms-button" onClick={()=>setSection('imports')}>Preparar importación<ArrowRight size={16}/></button>}</section><section className="cms-card"><h3 className="text-lg font-semibold">Stock por revisar</h3><div className="mt-4">{state.products.filter(p=>p.stock<12).slice(0,6).map(p=><div className="cms-stock-row" key={p.id}><img src={p.image} alt=""/><div><b>{p.name}</b><small>{p.sku}</small></div><Badge tone={p.stock?'amber':'red'}>{p.stock} u.</Badge></div>)}{!state.products.some(p=>p.stock<12)&&<p className="cms-muted text-sm">No hay alertas de stock.</p>}</div></section></div>{!user.permissions.length&&<p className="cms-notice">Tu cuenta está activa. Solicita al administrador que te asigne un rol para trabajar con el catálogo.</p>}</>}
   {section==='products'&&<ProductsPanel user={user} notify={notify}/>}
   {section==='taxonomy'&&<TaxonomyPanel user={user} notify={notify}/>}
   {section==='pages'&&<PagesPanel user={user} notify={notify}/>}
   {section==='imports'&&<JobsPanel key="imports" kind="products" user={user} notify={notify}/>}
   {section==='media'&&<JobsPanel key="media" kind="media" user={user} notify={notify}/>}
   {(section==='users'||section==='roles'||section==='permissions')&&<SecurityPanel key={section} resource={section} user={user} notify={notify}/>}
   {section==='settings'&&<SettingsPanel notify={notify}/>}
   {section==='audit'&&<AuditPanel/>}
   {section==='account'&&<AccountPanel user={user} notify={notify}/>}
  </>}</main></div>
  {notice&&<div className="cms-toast" role="status">{notice}<button aria-label="Cerrar aviso" onClick={()=>setNotice('')}><X size={15}/></button></div>}
 </div>;
}

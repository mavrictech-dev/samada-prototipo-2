"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect,useState } from "react";
import { ArrowLeft,ArrowRight,CheckCircle2,LockKeyhole,Eye,EyeOff } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { SamadaLogo,ThemeToggle } from "./theme-toggle";

export function AuthScreen({mode}:{mode:'login'|'register'|'forgot'|'reset'}){
  const router=useRouter();
  const [name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[show,setShow]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[token,setToken]=useState('');
  useEffect(()=>{const query=new URLSearchParams(location.search);setToken(query.get('token')||'');if(query.get('error'))setError('El enlace no es válido o venció. Solicita uno nuevo.');},[]);
  const title={login:'Tu catálogo, bajo control.',register:'Crea tu cuenta de trabajo.',forgot:'Recupera tu acceso.',reset:'Elige tu nueva contraseña.'}[mode];
  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();setBusy(true);setError('');
    try {
      if((mode==='register'||mode==='reset')&&password!==confirmation)throw new Error('Las contraseñas no coinciden.');
      if(mode==='login'){
        const result=await authClient.signIn.email({email,password});if(result.error)throw new Error(result.error.message||'Revisa tus datos de acceso.');router.push('/admin');router.refresh();
      } else if(mode==='register'){
        const result=await authClient.signUp.email({name,email,password,callbackURL:`${location.origin}/login`});if(result.error)throw new Error(result.error.message||'No se pudo crear la cuenta.');setMessage('Revisa tu correo para verificar la cuenta. El administrador deberá aprobar tu acceso y asignarte un rol.');
      } else if(mode==='forgot'){
        const result=await authClient.requestPasswordReset({email,redirectTo:`${location.origin}/reset-password`});if(result.error)throw new Error('No se pudo enviar la solicitud. Intenta más tarde.');setMessage('Si el correo está registrado, recibirás un enlace para recuperar el acceso.');
      }else {
        if(!token)throw new Error('Falta el enlace de recuperación. Solicita uno nuevo.');
        const result=await authClient.resetPassword({newPassword:password,token});if(result.error)throw new Error(result.error.message||'El enlace venció o ya fue utilizado.');setMessage('Contraseña actualizada. Ya puedes iniciar sesión.');
      }
    }catch(error){setError(error instanceof Error?error.message:'No se pudo completar la operación.');}finally{setBusy(false);}
  };
  return <main className="theme-page auth-layout">
    <section className="auth-story"><img src="/assets/samada-logo-negative.webp" alt="Samada" className="w-44"/><div className="auth-story-copy"><span className="cms-eyebrow">SAMADA · GESTIÓN DE CATÁLOGO</span><h1>Todo tu surtido.<br/>En el orden<br/>que necesitas.</h1><p>Marcas, tamaños e imágenes conectados para que cada producto encuentre su lugar.</p></div><span className="text-xs opacity-60">Acceso exclusivo para el equipo autorizado</span></section>
    <section className="auth-form-panel"><div className="flex items-center justify-between"><Link href="/" className="cms-muted flex items-center gap-2 text-xs"><ArrowLeft size={15}/>Ver catálogo</Link><ThemeToggle compact/></div><div className="auth-form-content"><SamadaLogo className="mb-10 w-40 lg:hidden"/><span className="cms-icon"><LockKeyhole size={21}/></span><h2>{title}</h2><p className="cms-muted mb-7 text-sm">{mode==='login'?'Ingresa con tu correo y contraseña.':mode==='register'?'Tu acceso se habilita después de verificar el correo y recibir aprobación.':mode==='forgot'?'Te enviaremos un enlace válido durante 30 minutos.':'Usa al menos 12 caracteres para proteger tu cuenta.'}</p>
      {message?<div className="cms-success"><CheckCircle2 size={22}/><p>{message}</p><Link href="/login" className="cms-button mt-5">Ir al inicio de sesión<ArrowRight size={15}/></Link></div>:<form onSubmit={submit} className="space-y-5">
        {mode==='register'&&<label className="cms-field">Nombre completo<input required value={name} onChange={e=>setName(e.target.value)} autoComplete="name"/></label>}
        {mode!=='reset'&&<label className="cms-field">Correo electrónico<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label>}
        {mode!=='forgot'&&<label className="cms-field">Contraseña<div className="relative"><input required minLength={mode==='login'?1:12} maxLength={128} type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==='login'?'current-password':'new-password'}/><button type="button" onClick={()=>setShow(!show)} className="absolute right-3 top-3" aria-label={show?'Ocultar contraseña':'Mostrar contraseña'}>{show?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>}
        {(mode==='register'||mode==='reset')&&<label className="cms-field">Confirmar contraseña<input required minLength={12} type={show?'text':'password'} value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="new-password"/></label>}
        {error&&<p role="alert" className="cms-error">{error}</p>}
        {mode==='login'&&<Link href="/forgot-password" className="cms-link block text-right text-xs">Olvidé mi contraseña</Link>}
        <button disabled={busy} className="cms-button w-full justify-center">{busy?'Procesando…':mode==='login'?'Iniciar sesión':mode==='register'?'Solicitar acceso':mode==='forgot'?'Enviar enlace':'Guardar contraseña'}<ArrowRight size={16}/></button>
      </form>}
      <p className="cms-muted mt-7 text-center text-xs">{mode==='login'?<>¿Aún no tienes cuenta? <Link className="cms-link" href="/register">Registrarme</Link></>:<Link className="cms-link" href="/login">Volver a iniciar sesión</Link>}</p>
    </div><p className="cms-muted mt-10 text-[10px]">Samada · Acceso y actividad protegidos por permisos</p></section>
  </main>;
}

#!/usr/bin/env bash
set -euo pipefail
echo '=== Recursos del VPS ==='
df -h / /var/lib/docker
free -m
docker version --format '{{.Server.Version}}'
docker ps --format 'table {{.Names}}\t{{.Ports}}'
echo '=== Puertos de correo ya ocupados ==='
ss -lnt '( sport = :25 or sport = :465 or sport = :587 or sport = :2465 )'
echo '=== DNS y salida SMTP (sin enviar mensajes) ==='
docker run --rm -i node:24-alpine node --input-type=module <<'NODE'
import dns from 'node:dns/promises';
import net from 'node:net';
for(const [label,fn] of [
 ['NS',()=>dns.resolveNs('samadaperu.com')],
 ['A correo',()=>dns.resolve4('correo.samadaperu.com')],
 ['MX notificaciones',()=>dns.resolveMx('notificaciones.samadaperu.com')],
 ['SPF notificaciones',()=>dns.resolveTxt('notificaciones.samadaperu.com')],
 ['PTR',()=>dns.reverse('37.60.234.60')],
]){try{console.log(label+': '+JSON.stringify(await fn()));}catch{console.log(label+': no disponible');}}
for(const domain of ['gmail.com','outlook.com']){
 try{
  const mx=(await dns.resolveMx(domain)).sort((a,b)=>a.priority-b.priority)[0].exchange;
  await new Promise(resolve=>{
   const socket=net.createConnection({host:mx,port:25});let done=false;
   const finish=result=>{if(done)return;done=true;console.log('TCP/25 '+domain+': '+result);socket.destroy();resolve();};
   socket.setTimeout(10000,()=>finish('sin respuesta'));
   socket.once('error',()=>finish('conexión rechazada o no disponible'));
   socket.once('data',buffer=>finish(buffer.toString().startsWith('220')?'saludo SMTP recibido':'respuesta recibida'));
  });
 }catch{console.log('TCP/25 '+domain+': DNS no disponible');}
}
NODE

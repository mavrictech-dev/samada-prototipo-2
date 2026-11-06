import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
const base=process.env.ROUTING_TEST_URL||'http://localhost:3000';
function response(path,host,cookie){
 return new Promise((resolve,reject)=>{
  // fetch no permite sobrescribir Host de forma fiable; simular el proxy por HTTP.
  const req=http.get(new URL(path,base),{headers:{host,...(cookie?{cookie}:{})}},res=>{
   res.resume();res.once('end',()=>resolve({status:res.statusCode,location:res.headers.location}));
  });
  req.setTimeout(10000,()=>req.destroy(Error('La ruta no respondió.')));req.once('error',reject);
 });
}
test('Gestión: raíz visible, sesión ausente o inválida y login sin bucles',async()=>{
 assert.deepEqual(await response('/','gestion.samadaperu.com'),{status:307,location:'https://gestion.samadaperu.com/admin'});
 assert.deepEqual(await response('/admin','gestion.samadaperu.com'),{status:307,location:'/login'});
 assert.deepEqual(await response('/admin','gestion.samadaperu.com','better-auth.session_token=expired'),{status:307,location:'/login'});
 assert.deepEqual(await response('/login','gestion.samadaperu.com'),{status:200,location:undefined});
});
test('Catálogo público y entrada administrativa separada detrás del proxy',async()=>{
 assert.deepEqual(await response('/','samadaperu.com'),{status:200,location:undefined});
 assert.deepEqual(await response('/admin','samadaperu.com'),{status:307,location:'https://gestion.samadaperu.com/admin'});
});

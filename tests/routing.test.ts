import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {proxy} from '../proxy';

test('El dominio de gestión detrás del proxy entra a /admin con URL visible',()=>{
 const request=new NextRequest('http://localhost:3000/',{headers:{host:'gestion.samadaperu.com'}});
 const response=proxy(request);
 assert.equal(response.status,307);
 assert.equal(response.headers.get('location'),'https://gestion.samadaperu.com/admin');
 assert.equal(response.headers.get('x-middleware-rewrite'),null);
});
test('Login y recursos de gestión no forman bucles de redirección',()=>{
 for(const path of ['/admin','/login','/api/auth/sign-in/email','/_next/static/app.js','/assets/samada-logo.webp']){
  const response=proxy(new NextRequest('http://localhost:3000'+path,{headers:{host:'GESTION.SAMADAPERU.COM:443'}}));
  assert.equal(response.headers.get('location'),null,path);
 }
});
test('El catálogo permanece público y el acceso al CMS conserva ruta y consulta',()=>{
 for(const host of ['samadaperu.com','www.samadaperu.com']){
  assert.equal(proxy(new NextRequest('http://localhost:3000/',{headers:{host}})).headers.get('location'),null);
  const response=proxy(new NextRequest('http://localhost:3000/admin/productos?sku=BAH-0001',{headers:{host}}));
  assert.equal(response.headers.get('location'),'https://gestion.samadaperu.com/admin/productos?sku=BAH-0001');
 }
});
test('Desarrollo local y cabeceras reenviadas arbitrarias no se redirigen a producción',()=>{
 const cases:Record<string,string>[]=[{host:'localhost:3000'},{host:'otro.example','x-forwarded-host':'gestion.samadaperu.com'}];
 for(const headers of cases){
  assert.equal(proxy(new NextRequest('http://localhost:3000/',{headers})).headers.get('location'),null);
 }
});

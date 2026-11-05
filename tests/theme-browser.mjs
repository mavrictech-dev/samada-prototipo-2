import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
const base=process.env.THEME_TEST_URL||'http://localhost:3000';
const errors=[];
const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'light'});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
await fs.mkdir('data/qa',{recursive:true});
async function assertReadable(locator,label){
 const result=await locator.evaluate(element=>{
  const rgb=color=>(color.match(/[\d.]+/g)||[]).map(Number);
  const blend=(top,bottom)=>top.slice(0,3).map((v,i)=>v*(top[3]??1)+bottom[i]*(1-(top[3]??1)));
  const chain=[];for(let e=element;e;e=e.parentElement)chain.unshift(e);
  let background=[255,255,255];for(const e of chain)background=blend(rgb(getComputedStyle(e).backgroundColor),background);
  const foreground=blend(rgb(getComputedStyle(element).color),background);
  const luminance=values=>values.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const a=luminance(foreground),b=luminance(background);
  return {contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),background,foreground};
 });
 assert.ok(result.contrast>=4.5,label+': '+JSON.stringify(result));
}
async function theme(value){
 if(await page.locator('html').getAttribute('data-theme')!==value)await page.getByRole('button',{name:value==='dark'?'Cambiar a modo oscuro':'Cambiar a modo claro',exact:true}).click();
 await page.waitForFunction(expected=>document.documentElement.dataset.theme===expected,value);
}
try{
 await page.goto(base+'/login');
 const access=await fs.readFile('data/ACCESO-LOCAL.txt','utf8');
 await page.getByLabel('Correo electrónico').fill(access.match(/Correo: (.+)/)[1].trim());
 await page.getByLabel('Contraseña',{exact:true}).fill(access.match(/aleatoria: (.+)/)[1].trim());
 await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await page.waitForURL('**/admin');
 await page.getByRole('heading',{name:'Cada producto, en su lugar.'}).waitFor();
 await page.locator('.cms-sidebar nav').getByRole('button',{name:'Productos',exact:false}).click();
 await page.locator('.cms-table tbody tr').first().waitFor();
 for(const value of ['dark','light','dark']){
  await theme(value);
  await assertReadable(page.locator('.cms-page-heading h2'),'Título '+value);
  await assertReadable(page.locator('.cms-page-heading .cms-muted'),'Descripción '+value);
  await assertReadable(page.locator('.cms-table th').first(),'Cabecera '+value);
  await assertReadable(page.locator('.cms-table tbody td strong').first(),'Producto '+value);
  await assertReadable(page.locator('.cms-table tbody td small').first(),'SKU '+value);
  const bg=await page.locator('.cms-main').evaluate(e=>getComputedStyle(e).backgroundColor);
  assert.equal(bg,value==='dark'?'rgb(17, 25, 17)':'rgb(241, 244, 240)','El área de trabajo debe cambiar con el tema');
  await page.screenshot({path:`data/qa/productos-${value}.png`});
 }
 await page.getByRole('button',{name:'Nuevo producto',exact:true}).click();
 await page.getByRole('dialog').waitFor();
 await assertReadable(page.getByRole('dialog').locator('h2'),'Título de formulario oscuro');
 await assertReadable(page.getByLabel('Nombre *',{exact:true}),'Campo oscuro');
 await page.screenshot({path:'data/qa/formulario-producto-oscuro.png'});await page.keyboard.press('Escape');
 await page.reload();await page.getByRole('heading',{name:'Cada producto, en su lugar.'}).waitFor();
 assert.equal(await page.locator('html').getAttribute('data-theme'),'dark','Persistencia después de recargar');
 await page.setViewportSize({width:390,height:844});
 await page.waitForFunction(()=>document.querySelector('.cms-sidebar').getBoundingClientRect().right<=1);
 await assertReadable(page.locator('.cms-page-heading h2'),'Título móvil oscuro');
 await page.screenshot({path:'data/qa/cms-oscuro-mobile.png'});
 await page.goto(base+'/login');await page.getByRole('heading',{name:'Tu catálogo, bajo control.'}).waitFor();
 await assertReadable(page.locator('.auth-form-content h2'),'Login oscuro');
 await page.screenshot({path:'data/qa/login-oscuro-mobile.png'});
 const blocked=await browser.newContext({colorScheme:'dark'});
 await blocked.addInitScript(()=>{Object.defineProperty(Storage.prototype,'getItem',{value:()=>{throw new DOMException('Blocked','SecurityError');}});Object.defineProperty(Storage.prototype,'setItem',{value:()=>{throw new DOMException('Blocked','SecurityError');}});});
 const noStorage=await blocked.newPage();noStorage.on('pageerror',e=>errors.push(e.message));
 await noStorage.goto(base+'/login');await noStorage.getByRole('button',{name:'Cambiar a modo claro'}).waitFor();
 await noStorage.getByRole('button',{name:'Cambiar a modo claro'}).click();
 await noStorage.waitForFunction(()=>document.documentElement.dataset.theme==='light');await blocked.close();
 assert.deepEqual(errors,[]);console.log('Tema verificado: contraste >=4.5, fondos del CMS, tabla, formularios, login, móvil, persistencia y almacenamiento bloqueado.');
}finally{await browser.close();}

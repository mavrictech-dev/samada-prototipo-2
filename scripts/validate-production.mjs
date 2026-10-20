const required=['POSTGRES_PASSWORD','BETTER_AUTH_SECRET','BETTER_AUTH_URL','TRUSTED_ORIGINS','SMTP_HOST','MAIL_FROM'];
const errors=required.filter(key=>!process.env[key]).map(key=>'Falta '+key);
for(const key of required)if(/CAMBIAR|GENERAR_/i.test(process.env[key]||''))errors.push('Configura un valor real para '+key);
if(process.env.SMTP_USER&&!process.env.SMTP_PASSWORD)errors.push('Falta SMTP_PASSWORD para el usuario SMTP.');
const secret=process.env.BETTER_AUTH_SECRET||'';
if(secret.length<32||/CAMBIAR|GENERAR_|build-only|ci-only/i.test(secret))errors.push('BETTER_AUTH_SECRET necesita al menos 32 caracteres aleatorios.');
if(!/^[A-Za-z0-9_-]{24,}$/.test(process.env.POSTGRES_PASSWORD||''))errors.push('POSTGRES_PASSWORD necesita al menos 24 caracteres URL-seguros.');
try{const url=new URL(process.env.BETTER_AUTH_URL);if(url.protocol!=='https:'||['localhost','127.0.0.1'].includes(url.hostname))throw Error();if(!(process.env.TRUSTED_ORIGINS||'').split(',').map(s=>s.trim()).includes(url.origin))errors.push('TRUSTED_ORIGINS debe incluir el origen de BETTER_AUTH_URL.');}catch{errors.push('BETTER_AUTH_URL debe ser la URL HTTPS real del panel.');}
for(const value of (process.env.TRUSTED_ORIGINS||'').split(',')){try{const url=new URL(value.trim());if(url.protocol!=='https:'||url.origin!==value.trim())throw Error();}catch{errors.push('TRUSTED_ORIGINS debe contener orígenes HTTPS sin rutas.');break;}}
if(['127.0.0.1','localhost'].includes(process.env.SMTP_HOST||''))errors.push('SMTP_HOST debe ser accesible desde los contenedores; localhost apunta al propio contenedor.');
if(/@[^\s>]+\.(local|example)\b/i.test(process.env.MAIL_FROM||''))errors.push('MAIL_FROM debe usar un remitente real.');
if(errors.length){errors.forEach(error=>console.error(error));process.exitCode=1;}else console.log('Configuración de producción validada sin mostrar secretos.');

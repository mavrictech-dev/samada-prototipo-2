import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
if(fs.existsSync('.env')) {
  console.log('.env existente conservado.');
} else {
  const password=randomBytes(24).toString('hex');
  fs.writeFileSync('.env',`DATABASE_URL=postgresql://samada:${password}@localhost:55439/samada\nPOSTGRES_PASSWORD=${password}\nBETTER_AUTH_URL=http://localhost:3000\nBETTER_AUTH_SECRET=${randomBytes(32).toString('hex')}\nTRUSTED_ORIGINS=http://localhost:3000\nSMTP_HOST=127.0.0.1\nSMTP_PORT=2526\nSMTP_SECURE=false\nMAIL_FROM="Samada <acceso@samada.local>"\n`,{mode:0o600,flag:'wx'});
  console.log('Configuración local creada en .env sin exponer secretos.');
}

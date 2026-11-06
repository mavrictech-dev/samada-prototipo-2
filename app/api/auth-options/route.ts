import {mailEnabled} from '@/server/mail-config.mjs';
export const dynamic='force-dynamic';
export function GET(){return Response.json({mailEnabled:mailEnabled()},{headers:{'Cache-Control':'no-store'}});}

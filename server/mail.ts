import {createMailService} from './mail-service';
export {MailDeliveryError} from './mail-service';
let service:ReturnType<typeof createMailService>|undefined;
const mail=()=>service||=(createMailService());

export async function sendMail(to: string, subject: string, text: string) {
  return mail().send(to,subject,text);
}
export const verifyMail=()=>mail().verify();
export function closeMail(){service?.close();service=undefined;}

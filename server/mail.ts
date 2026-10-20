import nodemailer from "nodemailer";

export async function sendMail(to: string, subject: string, text: string) {
  if(!process.env.SMTP_HOST)throw new Error("Configura SMTP_HOST para enviar correos.");
  const transporter=nodemailer.createTransport({
    host:process.env.SMTP_HOST, port:Number(process.env.SMTP_PORT||587), secure:process.env.SMTP_SECURE==="true",
    ...(process.env.SMTP_USER?{auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}}:{}),
  });
  await transporter.sendMail({from:process.env.MAIL_FROM||"Samada <acceso@samada.local>",to,subject,text});
}

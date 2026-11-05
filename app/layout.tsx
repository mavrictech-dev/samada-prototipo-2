import type { Metadata } from "next";
import "./globals.css";
import { CmsProvider } from "@/components/cms-provider";
import {themeBootstrap} from "@/lib/theme";

export const metadata: Metadata = {
  title: "Samada Distribuidores",
  description: "Catálogo mayorista interactivo de Samada",
  icons: { icon: "/assets/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body><script dangerouslySetInnerHTML={{__html:themeBootstrap}}/><CmsProvider>{children}</CmsProvider></body>
    </html>
  );
}

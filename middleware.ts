import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const { pathname } = request.nextUrl;

  // Ignorar archivos estáticos, api y recursos internos de Next
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/assets") ||
    pathname.startsWith("/vendor") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const isGestionDomain = host.startsWith("gestion.") || host.includes("gestion.samadaperu.com");
  const isProdCatalog = host.includes("samadaperu.com") && !isGestionDomain;

  // 1. Si está en el subdominio de gestión (gestion.samadaperu.com)
  if (isGestionDomain) {
    // Si entra a la raíz '/', mostrar directamente el panel de administración
    if (pathname === "/") {
      return NextResponse.rewrite(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  // 2. Si está en el dominio principal de catálogo (samadaperu.com / www.samadaperu.com)
  if (isProdCatalog) {
    // Si intenta acceder a /admin desde el dominio público, redirigir al subdominio de gestión
    if (pathname.startsWith("/admin")) {
      const gestionUrl = new URL(pathname.replace(/^\/admin/, "") || "/", "https://gestion.samadaperu.com");
      return NextResponse.redirect(gestionUrl, 301);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|assets|vendor).*)"],
};

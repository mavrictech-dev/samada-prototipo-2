import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // nextUrl puede usar el nombre interno del contenedor detrás del proxy.
  const host = (request.headers.get("host")?.split(":")[0] || request.nextUrl.hostname).toLowerCase();
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

  const isGestionDomain = host === "gestion.samadaperu.com";
  const isProdCatalog = ["samadaperu.com", "www.samadaperu.com"].includes(host);

  // 1. Si está en el subdominio de gestión (gestion.samadaperu.com)
  if (isGestionDomain) {
    // /admin comprueba la sesión y abre /login cuando no existe una válida.
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/admin", "https://gestion.samadaperu.com"));
    }
    return NextResponse.next();
  }

  // 2. Si está en el dominio principal de catálogo (samadaperu.com / www.samadaperu.com)
  if (isProdCatalog) {
    // Si intenta acceder a /admin desde el dominio público, redirigir al subdominio de gestión
    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      const gestionUrl = new URL(pathname + request.nextUrl.search, "https://gestion.samadaperu.com");
      return NextResponse.redirect(gestionUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|assets|vendor).*)"],
};

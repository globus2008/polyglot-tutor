import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isLocale, LOCALE_COOKIE, localePath, matchLocale } from "@/lib/i18n/locales";

// Pages under /[lang] that work without signing in.
const PUBLIC_PAGES = ["/login", "/privacy"];

// 1. Bare URLs get a locale prefix (remembered cookie, else the browser's languages).
// 2. The Supabase session cookie is refreshed.
// 3. Anonymous visitors of app pages go to /[lang]/login.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isAppPage = !pathname.startsWith("/api/") && !pathname.startsWith("/auth/");
  const segment = pathname.split("/")[1];

  if (isAppPage && !isLocale(segment)) {
    const remembered = request.cookies.get(LOCALE_COOKIE)?.value;
    const locale = isLocale(remembered) ? remembered : matchLocale(request.headers.get("accept-language"));
    const url = request.nextUrl.clone();
    url.pathname = localePath(locale, pathname);
    return NextResponse.redirect(url);
  }

  // let server actions and route handlers in this request see the current locale
  if (isLocale(segment)) request.cookies.set(LOCALE_COOKIE, segment);

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  if (isAppPage && isLocale(segment)) {
    const page = pathname.slice(segment.length + 1) || "/";
    const isPublic = PUBLIC_PAGES.includes(page);
    if (!signedIn && !isPublic) {
      const url = request.nextUrl.clone();
      url.pathname = localePath(segment, "/login");
      url.search = page === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
    if (signedIn && page === "/login") {
      return NextResponse.redirect(new URL(localePath(segment, "/"), request.url));
    }
    response.cookies.set(LOCALE_COOKIE, segment, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|manifest.webmanifest|sw.js|offline.html|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

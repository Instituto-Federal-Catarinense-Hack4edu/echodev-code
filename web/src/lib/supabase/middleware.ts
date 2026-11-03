import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseEnv, publicEnv } from "@/lib/env";

const PROTECTED = [/^\/professor(\/|$)/, /^\/aula\/[^/]+/];

/** Refreshes the Supabase session cookie and sends logged-out users to /entrar?next=... */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!hasSupabaseEnv()) return response;
  const env = publicEnv();

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: async () => request.cookies.getAll(),
      setAll: async (toSet, headers) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers)) response.headers.set(k, v);
      },
    },
  });

  // Validates the JWT and refreshes it when close to expiry. Do not put code between
  // client creation and this call.
  const { data } = await supabase.auth.getClaims();
  const loggedIn = !!data?.claims?.sub;

  const path = request.nextUrl.pathname;
  if (!loggedIn && PROTECTED.some((re) => re.test(path))) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    const redirect = NextResponse.redirect(url);
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    return redirect;
  }
  return response;
}

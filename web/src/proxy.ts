import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Skip static assets and the offline demo (works without Supabase).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|demo/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

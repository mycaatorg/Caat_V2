import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // C5: gate on getClaims() instead of getUser(). The project signs JWTs with
  // asymmetric ES256 keys and publishes a JWKS, so getClaims verifies the token
  // locally (JWKS cached) rather than making a /auth/v1/user network round trip
  // on every gated navigation. Full getUser() is reserved for sensitive
  // mutations, which run in server actions/route handlers, not here.
  const {
    data: claimsData,
  } = await supabase.auth.getClaims();

  if (!claimsData?.claims) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/today/:path*",
    "/shortlist/:path*",
    "/welcome/:path*",
    "/dashboard/:path*",
    "/profile/:path*",
    "/documents/:path*",
    "/essays/:path*",
    "/majors/:path*",
    "/schools/:path*",
    "/applications/:path*",
    "/scholarships/:path*",
    "/resume-builder/:path*",
    "/communities/:path*",
    "/communities/profile/:path*",
    "/settings/:path*",
  ],
};

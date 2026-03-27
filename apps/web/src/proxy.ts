import { NextRequest, NextResponse } from "next/server";

const publicPaths = ["/", "/login", "/register", "/pricing", "/api/auth", "/api/webhooks"];
const authPaths = ["/login", "/register"];

export async function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;

	const isPublic = publicPaths.some(
		(p) => pathname === p || pathname.startsWith(p + "/"),
	);

	const sessionCookie = request.cookies.get("better-auth.session_token");
	const isLoggedIn = !!sessionCookie;

	if (isLoggedIn && authPaths.some((p) => pathname === p)) {
		return NextResponse.redirect(new URL("/dashboard", request.url));
	}

	if (!isLoggedIn && !isPublic) {
		const loginUrl = new URL("/login", request.url);
		loginUrl.searchParams.set("redirect", pathname);
		return NextResponse.redirect(loginUrl);
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

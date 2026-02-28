import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveAdminGateDecision } from "./proxy";

export async function middleware(request: NextRequest): Promise<NextResponse | undefined> {
  const decision = await resolveAdminGateDecision(request);
  if (decision) {
    const location = decision.headers.get("location") ?? "/";
    return NextResponse.redirect(new URL(location, request.url), { status: decision.status });
  }
  return undefined;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};

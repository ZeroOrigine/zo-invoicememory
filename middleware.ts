import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  // For MVP: just pass through. Auth will be added when Supabase tables exist.
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/invoices/:path*', '/billing/:path*', '/settings/:path*'],
}

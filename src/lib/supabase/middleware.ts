import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  let user = null
  try {
    const { data, error } = await supabase.auth.getUser()
    if (!error) {
      user = data.user
    } else if (error.code === 'refresh_token_not_found' || error.message?.includes('Refresh Token')) {
      // Clear stale auth cookies
      request.cookies.getAll().forEach((cookie) => {
        if (cookie.name.includes('sb-') && cookie.name.includes('-auth-token')) {
          supabaseResponse.cookies.delete(cookie.name)
        }
      })
    }
  } catch {
    user = null
  }

  const pathname = request.nextUrl.pathname

  // Public paths that don't require authentication
  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/callback') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/api/agents/invite')

  const isApiWebhook = pathname.startsWith('/api/leads/webhook')

  if (!user && !isAuthRoute && !isApiWebhook) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Session expired or unauthorized. Please log in again.' }, { status: 401 })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}


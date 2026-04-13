import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * For **direct Postgres** (Drizzle, Prisma, etc.) use the Supabase **Connection
 * Pooler** in transaction mode (port **6543**) under load.
 *
 * `@supabase/supabase-js` talks to PostgREST over HTTPS (no persistent DB socket),
 * but concurrent server routes still pair well with a pooler for any raw SQL.
 */
/**
 * Especially important if using Fluid compute: Don't put this client in a
 * global variable. Always create a new client within each function when using
 * it.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // The "setAll" method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  )
}

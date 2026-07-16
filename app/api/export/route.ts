import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// GET /api/export — download EVERYTHING you own as standard JSON.
// Empowerment over dependency: users own their data and can leave any time.
// All reads use the user-scoped client, so RLS guarantees you only ever get
// your own rows. Protected by middleware + this route's own auth check.
// ---------------------------------------------------------------------------

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Sign in to export your data.' }, { status: 401 })
    }

    const [profile, clients, invoices, subscription, payments] = await Promise.all([
      supabase.from('invoicememory_profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('invoicememory_clients').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('invoicememory_invoices').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('invoicememory_subscriptions').select('plan,status,current_period_end,cancel_at_period_end,created_at').eq('user_id', user.id).maybeSingle(),
      supabase.from('invoicememory_payments').select('amount_cents,currency,status,description,created_at').eq('user_id', user.id).order('created_at'),
    ])

    const body = {
      format: 'invoicememory.export.v1',
      exported_at: new Date().toISOString(),
      profile: profile.data ?? null,
      clients: clients.data ?? [],
      invoices: invoices.data ?? [],
      subscription: subscription.data ?? null,
      payments: payments.data ?? [],
    }

    return new NextResponse(JSON.stringify(body, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="invoicememory-export.json"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[export] Failed:', err)
    return NextResponse.json(
      { error: "We couldn't build your export just now. Try again in a moment." },
      { status: 500 }
    )
  }
}

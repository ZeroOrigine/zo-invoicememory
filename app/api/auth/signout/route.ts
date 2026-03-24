import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      return NextResponse.json(
        { error: 'Failed to sign out', code: 'SIGNOUT_ERROR' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: { message: 'Successfully signed out' } });
  } catch (error) {
    console.error('Sign out error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
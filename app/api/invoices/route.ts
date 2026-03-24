import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'canceled';

interface CreateInvoiceRequest {
  invoice_number: string;
  client_name: string;
  client_email?: string;
  amount: number;
  currency?: string;
  status?: InvoiceStatus;
  issue_date: string;
  due_date: string;
  description?: string;
  notes?: string;
}

interface InvoiceResponse {
  id: string;
  user_id: string;
  invoice_number: string;
  client_name: string;
  client_email?: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  description?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

const createInvoiceSchema = z.object({
  invoice_number: z.string().min(1, 'Invoice number is required'),
  client_name: z.string().min(1, 'Client name is required'),
  client_email: z.string().email('Invalid email format').optional(),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().length(3, 'Currency must be 3 characters').optional(),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'canceled']).optional(),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Issue date must be in YYYY-MM-DD format'),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be in YYYY-MM-DD format'),
  description: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const status = searchParams.get('status');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('invoices')
      .select('id, user_id, invoice_number, client_name, client_email, amount, currency, status, issue_date, due_date, description, notes, created_at, updated_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: invoices, error, count } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch invoices', code: 'DATABASE_ERROR' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: invoices,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validationResult = createInvoiceSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid input data',
          code: 'VALIDATION_ERROR',
          details: validationResult.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }

    const invoiceData = validationResult.data;

    // Check if invoice number already exists for this user
    const { data: existingInvoice } = await supabase
      .from('invoices')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('invoice_number', invoiceData.invoice_number)
      .single();

    if (existingInvoice) {
      return NextResponse.json(
        { error: 'Invoice number already exists', code: 'DUPLICATE_INVOICE_NUMBER' },
        { status: 409 }
      );
    }

    const { data: invoice, error } = await supabase
      .from('invoices')
      .insert({
        user_id: session.user.id,
        ...invoiceData,
        currency: invoiceData.currency || 'USD',
        status: invoiceData.status || 'draft',
      })
      .select('id, user_id, invoice_number, client_name, client_email, amount, currency, status, issue_date, due_date, description, notes, created_at, updated_at')
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to create invoice', code: 'DATABASE_ERROR' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: invoice }, { status: 201 });
  } catch (error) {
    console.error('Create invoice error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
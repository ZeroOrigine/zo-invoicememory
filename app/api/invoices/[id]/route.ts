import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'canceled';

interface UpdateInvoiceRequest {
  invoice_number?: string;
  client_name?: string;
  client_email?: string;
  amount?: number;
  currency?: string;
  status?: InvoiceStatus;
  issue_date?: string;
  due_date?: string;
  description?: string;
  notes?: string;
}

const updateInvoiceSchema = z.object({
  invoice_number: z.string().min(1, 'Invoice number is required').optional(),
  client_name: z.string().min(1, 'Client name is required').optional(),
  client_email: z.string().email('Invalid email format').optional(),
  amount: z.number().positive('Amount must be positive').optional(),
  currency: z.string().length(3, 'Currency must be 3 characters').optional(),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'canceled']).optional(),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Issue date must be in YYYY-MM-DD format').optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be in YYYY-MM-DD format').optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('id, user_id, invoice_number, client_name, client_email, amount, currency, status, issue_date, due_date, description, notes, created_at, updated_at')
      .eq('id', params.id)
      .eq('user_id', session.user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Invoice not found', code: 'NOT_FOUND' },
          { status: 404 }
        );
      }
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch invoice', code: 'DATABASE_ERROR' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: invoice });
  } catch (error) {
    console.error('Get invoice error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const validationResult = updateInvoiceSchema.safeParse(body);

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

    const updateData = validationResult.data;

    // Check if invoice number already exists for this user (if being updated)
    if (updateData.invoice_number) {
      const { data: existingInvoice } = await supabase
        .from('invoices')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('invoice_number', updateData.invoice_number)
        .neq('id', params.id)
        .single();

      if (existingInvoice) {
        return NextResponse.json(
          { error: 'Invoice number already exists', code: 'DUPLICATE_INVOICE_NUMBER' },
          { status: 409 }
        );
      }
    }

    const { data: invoice, error } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', params.id)
      .eq('user_id', session.user.id)
      .select('id, user_id, invoice_number, client_name, client_email, amount, currency, status, issue_date, due_date, description, notes, created_at, updated_at')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Invoice not found', code: 'NOT_FOUND' },
          { status: 404 }
        );
      }
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to update invoice', code: 'DATABASE_ERROR' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: invoice });
  } catch (error) {
    console.error('Update invoice error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', params.id)
      .eq('user_id', session.user.id);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to delete invoice', code: 'DATABASE_ERROR' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: { message: 'Invoice deleted successfully' } });
  } catch (error) {
    console.error('Delete invoice error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { InvoicesList } from '@/components/invoices/invoices-list';
import { InvoicesHeader } from '@/components/invoices/invoices-header';
import { EmptyState } from '@/components/ui/empty-state';

export default async function InvoicesPage() {
  const supabase = createServerComponentClient({ cookies });
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return null;
  }

  const { data: invoices } = await supabase
    .from('invoices')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <InvoicesHeader />
      
      {invoices && invoices.length > 0 ? (
        <InvoicesList invoices={invoices} />
      ) : (
        <EmptyState
          title="No invoices yet"
          description="Create your first invoice to get started with InvoiceMemory."
          actionLabel="Create Invoice"
          actionHref="/invoices/new"
        />
      )}
    </div>
  );
}
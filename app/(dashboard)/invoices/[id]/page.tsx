export const dynamic = "force-dynamic"
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation';
import { InvoiceDetail } from '@/components/invoices/invoice-detail';

interface InvoicePageProps {
  params: {
    id: string;
  };
}

export default async function InvoicePage({ params }: InvoicePageProps) {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return null;
  }

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (!invoice) {
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto">
      <InvoiceDetail invoice={invoice} />
    </div>
  );
}
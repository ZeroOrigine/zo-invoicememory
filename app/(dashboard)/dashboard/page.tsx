export const dynamic = "force-dynamic"
import { createClient } from '@/lib/supabase/server'
import { DashboardStats } from '@/components/dashboard/dashboard-stats';
import { RecentInvoices } from '@/components/dashboard/recent-invoices';
import { QuickActions } from '@/components/dashboard/quick-actions';

export default async function DashboardPage() {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return null;
  }

  // Fetch dashboard data
  const [invoicesResult, paymentsResult] = await Promise.all([
    supabase
      .from('invoices')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('payments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)
  ]);

  const invoices = invoicesResult.data || [];
  const payments = paymentsResult.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome back! Here's what's happening with your invoices.</p>
      </div>
      
      <DashboardStats invoices={invoices} payments={payments} />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentInvoices invoices={invoices} />
        </div>
        <div>
          <QuickActions />
        </div>
      </div>
    </div>
  );
}
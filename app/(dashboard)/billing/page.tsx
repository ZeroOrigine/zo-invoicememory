export const dynamic = "force-dynamic"
import { createClient } from '@/lib/supabase/server'
import { BillingInfo } from '@/components/billing/billing-info';
import { PricingPlans } from '@/components/billing/pricing-plans';
import { Card } from '@/components/ui/card';

export default async function BillingPage() {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return null;
  }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .single();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Billing</h1>
        <p className="text-gray-600 mt-2">Manage your subscription and billing information.</p>
      </div>
      
      <BillingInfo subscription={subscription} />
      
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Pricing Plans</h2>
        <PricingPlans currentPlan={subscription?.plan || 'free'} />
      </Card>
    </div>
  );
}
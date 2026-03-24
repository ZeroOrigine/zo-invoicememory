import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { ProfileForm } from '@/components/settings/profile-form';
import { Card } from '@/components/ui/card';

export default async function SettingsPage() {
  const supabase = createServerComponentClient({ cookies });
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-2">Manage your account settings and preferences.</p>
      </div>
      
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Profile Information</h2>
        <ProfileForm profile={profile} />
      </Card>
    </div>
  );
}
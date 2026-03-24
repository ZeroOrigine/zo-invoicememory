-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enums
CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'past_due', 'unpaid', 'incomplete');
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'canceled');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');

-- Profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
    id uuid REFERENCES auth.users PRIMARY KEY,
    email text NOT NULL,
    full_name text,
    company_name text,
    role text DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Subscriptions table for Stripe billing
CREATE TABLE subscriptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    customer_id text NOT NULL, -- Stripe customer ID
    subscription_id text UNIQUE, -- Stripe subscription ID
    plan text NOT NULL DEFAULT 'free',
    status subscription_status NOT NULL DEFAULT 'active',
    current_period_start timestamptz,
    current_period_end timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Invoices table (core domain entity)
CREATE TABLE invoices (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    invoice_number text NOT NULL,
    client_name text NOT NULL,
    client_email text,
    amount decimal(10,2) NOT NULL,
    currency text DEFAULT 'USD',
    status invoice_status DEFAULT 'draft',
    issue_date date NOT NULL,
    due_date date NOT NULL,
    description text,
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, invoice_number)
);

-- Payments table for one-time charges and invoice payments
CREATE TABLE payments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
    payment_intent_id text, -- Stripe payment intent ID
    amount decimal(10,2) NOT NULL,
    currency text DEFAULT 'USD',
    status payment_status DEFAULT 'pending',
    payment_date timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- RLS Policies for subscriptions
CREATE POLICY "Users can view own subscriptions" ON subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions" ON subscriptions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions" ON subscriptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for invoices
CREATE POLICY "Users can view own invoices" ON invoices
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own invoices" ON invoices
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own invoices" ON invoices
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own invoices" ON invoices
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for payments
CREATE POLICY "Users can view own payments" ON payments
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payments" ON payments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payments" ON payments
    FOR UPDATE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_customer_id ON subscriptions(customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status) WHERE status = 'active';
CREATE INDEX idx_invoices_user_id ON invoices(user_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_invoice_number ON invoices(user_id, invoice_number);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_payments_status ON payments(status);

-- Function to handle updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger for new user registration
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Seed data
INSERT INTO profiles (id, email, full_name, role) VALUES
    ('00000000-0000-0000-0000-000000000000', 'admin@invoicememory.com', 'System Admin', 'admin')
ON CONFLICT (id) DO NOTHING;
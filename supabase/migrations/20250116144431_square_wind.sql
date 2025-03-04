/*
  # Fix business settings table

  1. Changes
    - Drop existing business_settings table and recreate it
    - Ensure proper table structure and policies
*/

-- Drop existing table and its dependencies
DROP TABLE IF EXISTS business_settings CASCADE;

-- Create business settings table
CREATE TABLE IF NOT EXISTS business_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  business_name text,
  business_address text,
  contact_name text,
  contact_email text,
  contact_phone text,
  tax_number text,
  registration_number text,
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  bank_sort_code text,
  bank_swift text,
  bank_iban text,
  invoice_prefix text,
  invoice_footer_note text,
  wise_email text,
  logo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Users can view their own business settings"
  ON business_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own business settings"
  ON business_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own business settings"
  ON business_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own business settings"
  ON business_settings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_business_settings_updated_at ON business_settings;
CREATE TRIGGER update_business_settings_updated_at
  BEFORE UPDATE ON business_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  email text,
  address text,
  currency text DEFAULT '$',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
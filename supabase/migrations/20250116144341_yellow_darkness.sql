/*
  # Update business settings table

  1. Changes
    - Add safety checks for existing policies
    - Ensure idempotent policy creation
*/

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

-- Create RLS Policies with safety checks
DO $$ 
BEGIN
  -- Check and create SELECT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'business_settings' 
    AND policyname = 'Users can view their own business settings'
  ) THEN
    CREATE POLICY "Users can view their own business settings"
      ON business_settings FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  -- Check and create INSERT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'business_settings' 
    AND policyname = 'Users can create their own business settings'
  ) THEN
    CREATE POLICY "Users can create their own business settings"
      ON business_settings FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Check and create UPDATE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'business_settings' 
    AND policyname = 'Users can update their own business settings'
  ) THEN
    CREATE POLICY "Users can update their own business settings"
      ON business_settings FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Check and create DELETE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'business_settings' 
    AND policyname = 'Users can delete their own business settings'
  ) THEN
    CREATE POLICY "Users can delete their own business settings"
      ON business_settings FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Create or replace updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if exists and create it
DROP TRIGGER IF EXISTS update_business_settings_updated_at ON business_settings;
CREATE TRIGGER update_business_settings_updated_at
  BEFORE UPDATE ON business_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
/*
  # Initial Schema Setup for Client Management

  1. New Tables
    - `clients`
      - `id` (uuid, primary key)
      - `name` (text)
      - `company_name` (text)
      - `email` (text)
      - `phone_number` (text)
      - `created_at` (timestamp)
      - `currency` (text) - Stores currency symbol
      - `user_id` (uuid) - References auth.users

  2. Security
    - Enable RLS on `clients` table
    - Add policies for CRUD operations
*/

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company_name text,
  email text,
  phone_number text,
  created_at timestamptz DEFAULT now(),
  currency text DEFAULT '$',
  user_id uuid REFERENCES auth.users(id),
  CONSTRAINT currency_check CHECK (currency IN ('$', '€', '₹', '£'))
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own clients"
  ON clients FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clients"
  ON clients FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number text NOT NULL,
  client_id uuid REFERENCES clients(id),
  total decimal NOT NULL DEFAULT 0,
  items jsonb[] NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
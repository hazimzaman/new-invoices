/*
  # Create invoices and invoice items tables

  1. New Tables
    - `invoices`
      - `id` (uuid, primary key)
      - `client_id` (uuid, references clients.id)
      - `invoice_number` (text)
      - `created_at` (timestamptz)
      - `total` (numeric)
      - `user_id` (uuid, references auth.users.id)

    - `invoice_items`
      - `id` (uuid, primary key)
      - `invoice_id` (uuid, references invoices.id)
      - `name` (text)
      - `description` (text)
      - `price` (numeric)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own invoices and items
*/

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  invoice_number text NOT NULL,
  created_at timestamptz DEFAULT now(),
  total numeric NOT NULL DEFAULT 0,
  user_id uuid REFERENCES auth.users(id) NOT NULL
);

-- Create invoice items table
CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0
);

-- Enable RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- Policies for invoices
CREATE POLICY "Users can view their own invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own invoices"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own invoices"
  ON invoices FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own invoices"
  ON invoices FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policies for invoice items
CREATE POLICY "Users can view their invoice items"
  ON invoice_items FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM invoices
    WHERE invoices.id = invoice_items.invoice_id
    AND invoices.user_id = auth.uid()
  ));

CREATE POLICY "Users can create invoice items"
  ON invoice_items FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM invoices
    WHERE invoices.id = invoice_items.invoice_id
    AND invoices.user_id = auth.uid()
  ));

CREATE POLICY "Users can update invoice items"
  ON invoice_items FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM invoices
    WHERE invoices.id = invoice_items.invoice_id
    AND invoices.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM invoices
    WHERE invoices.id = invoice_items.invoice_id
    AND invoices.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete invoice items"
  ON invoice_items FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM invoices
    WHERE invoices.id = invoice_items.invoice_id
    AND invoices.user_id = auth.uid()
  ));
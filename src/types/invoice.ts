export interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string;
  client?: {
    name: string;
    email: string;
    address?: string;
    currency?: string;
  };
  items: Array<{
    name: string;
    description: string;
    price: number;
  }>;
  total: number;
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  company_name: string;
  address: string;
  vat?: string;
}

export interface InvoiceWithClient extends Invoice {
  client: {
    id: string;
    name: string;
    company_name: string;
    email: string;
    client_address: string;
    tax_number?: string;
    tax_type?: string;
    currency?: string;
  };
}

export interface InvoiceItem {
  name: string;
  description?: string;
  price: number;
  currency?: string;
  quantity?: number;
} 
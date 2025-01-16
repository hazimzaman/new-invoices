export interface Invoice {
  id: string;
  invoice_number: string;
  date: string;
  created_at: string;
  total_amount: number;
  client: {
    name: string;
    company_name: string;
    address: string;
    vat?: string;
  };
  items: Array<{
    name: string;
    description: string;
    price: number;
    currency: string;
    quantity?: number;
  }>;
} 
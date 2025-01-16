import React from 'react';
import { pdf } from '@react-pdf/renderer';
import type { Invoice } from '../types/invoice';
import type { Client } from '../types/client';
import type { Settings } from '../types/settings';
import { InvoicePDF } from '../components/InvoicePDF';
import { supabase } from '../lib/supabaseClient';

export interface InvoiceWithClient extends Omit<Invoice, 'client_id'> {
  client: Client;
}

const getClientData = async (clientId: string): Promise<Client> => {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();

  if (error) throw new Error(`Failed to fetch client data: ${error.message}`);
  if (!data) throw new Error('Client not found');
  
  return data;
};

export const generateInvoicePDF = async (invoice: Invoice, settings: Settings) => {
  if (!invoice || !settings) {
    throw new Error('Invoice or settings data is missing');
  }

  try {
    console.log('Fetching client data for ID:', invoice.client_id);
    const clientData = await getClientData(invoice.client_id);
    
    if (!clientData) {
      throw new Error('Client data is null or undefined');
    }

    console.log('Successfully fetched client data:', clientData);

    const invoiceWithClient: InvoiceWithClient = {
      ...invoice,
      client: clientData
    };

    const document = <InvoicePDF invoice={invoiceWithClient} settings={settings} />;
    const blob = await pdf(document).toBlob();
    return blob;
  } catch (error) {
    console.error('Detailed error in PDF generation:', error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
}; 
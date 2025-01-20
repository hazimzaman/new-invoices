import React from 'react';
import { pdf } from '@react-pdf/renderer';
import type { Invoice } from '../types/invoice';
import type { Client } from '../types/client';
import type { Settings } from '../types/settings';
import { InvoicePDF } from '../components/InvoicePDF';
import { supabase } from '../lib/supabaseClient';
import { supabase as storageSupabase } from '../lib/supabase';

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

interface BusinessSettings {
  logo_url: string | null;
  business_name: string | null;
  // ... other settings fields
}

export const generateInvoicePDF = async (invoice: Invoice, settings: BusinessSettings) => {
  if (!invoice || !settings) {
    throw new Error('Invoice or settings data is missing');
  }

  try {
    const clientData = await getClientData(invoice.client_id);
    
    if (!clientData) {
      throw new Error('Client data is null or undefined');
    }

    const invoiceWithClient: InvoiceWithClient = {
      ...invoice,
      client: clientData
    };

    // Get logo URL if exists
    let logoUrl = null;
    if (settings?.logo_url) {
      try {
        const path = new URL(settings.logo_url).pathname.split('/logos/').pop();
        if (path) {
          const { data: { signedUrl } } = await storageSupabase.storage
            .from('logos')
            .createSignedUrl(path, 300); // 5 minutes expiry
          
          if (signedUrl) {
            logoUrl = signedUrl;
          }
        }
      } catch (error) {
        console.error('Error getting logo URL:', error);
      }
    }

    // Pass the logo URL to InvoicePDF component
    const document = <InvoicePDF 
      invoice={invoiceWithClient} 
      settings={{
        ...settings,
        logo_url: logoUrl
      }} 
    />;
    
    const blob = await pdf(document).toBlob();
    return blob;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}; 
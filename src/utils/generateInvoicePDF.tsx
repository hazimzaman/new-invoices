import { supabase } from '../lib/supabase';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Invoice } from '../types/invoice';

// Add type for jsPDF with autoTable
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => void;
}

export const generateInvoicePDF = async (invoice: Invoice) => {
  try {
    // Add detailed debug log
    console.log('PDF Generation Data:', {
      invoice: {
        id: invoice?.id,
        number: invoice?.invoice_number,
        client: invoice?.client,
        items: invoice?.items?.length,
        total: invoice?.total
      },
      hasRequiredData: {
        hasInvoice: !!invoice,
        hasClient: !!invoice?.client,
        hasItems: !!invoice?.items?.length,
        hasNumber: !!invoice?.invoice_number
      }
    });

    // Debug log
    console.log('Starting PDF generation with:', {
      hasInvoice: !!invoice,
      invoiceData: {
        id: invoice?.id,
        number: invoice?.invoice_number,
        clientId: invoice?.client_id,
        clientName: invoice?.client?.name,
        itemsCount: invoice?.items?.length
      }
    });

    // Fetch business settings first
    const { data: settings, error } = await supabase
      .from('business_settings')
      .select('*')
      .single();

    // Debug log
    console.log('Business settings:', {
      hasSettings: !!settings,
      error: error,
      businessName: settings?.business_name,
      hasAddress: !!settings?.business_address
    });

    // Validate required data
    if (!invoice?.client) {
      throw new Error('Invoice client data is missing');
    }

    if (!invoice?.items?.length) {
      throw new Error('Invoice items are missing');
    }

    if (!settings) {
      throw new Error('Business settings not found');
    }

    // Create new PDF document
    const doc = new jsPDF() as jsPDFWithAutoTable;
    
    // Add business details
    doc.setFontSize(20);
    doc.text(settings.business_name || 'Business Name', 20, 20);
    
    doc.setFontSize(10);
    doc.text(settings.business_address || '', 20, 30);
    doc.text(`Email: ${settings.contact_email || ''}`, 20, 35);
    doc.text(`Phone: ${settings.contact_phone || ''}`, 20, 40);

    // Add invoice details
    doc.setFontSize(16);
    doc.text(`INVOICE #${invoice.invoice_number}`, 140, 20);
    
    doc.setFontSize(10);
    doc.text(`Date: ${new Date(invoice.created_at).toLocaleDateString()}`, 140, 30);
    
    // Add client details
    doc.text('Bill To:', 20, 60);
    doc.text(invoice.client?.name || '', 20, 65);
    doc.text(invoice.client?.email || '', 20, 70);
    doc.text(invoice.client?.address || '', 20, 75);

    // Add items table
    const tableData = invoice.items.map(item => [
      item.name,
      item.description,
      invoice.client?.currency + item.price.toFixed(2)
    ]);

    doc.autoTable({
      startY: 90,
      head: [['Item', 'Description', 'Amount']],
      body: tableData,
    });

    // Add total
    const finalY = (doc as any).lastAutoTable.finalY || 150;
    doc.text(`Total: ${invoice.client?.currency}${invoice.total.toFixed(2)}`, 140, finalY + 20);

    // Convert to blob
    const pdfBlob = doc.output('blob');
    return pdfBlob;

  } catch (error) {
    console.error('Error in generateInvoicePDF:', error);
    throw error;
  }
}; 
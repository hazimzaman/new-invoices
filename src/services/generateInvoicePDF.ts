import React from 'react';
import { pdf } from '@react-pdf/renderer';
import type { Invoice } from '../types/invoice';
import type { Settings } from '../types/settings';
import { InvoicePDF } from '../components/InvoicePDF';
import '../lib/pdf'; // Import the PDF configuration

export async function generateInvoicePDF(invoice: Invoice, settings: Settings): Promise<Blob> {
  try {
    // Create the PDF document using React.createElement instead of JSX
    const pdfDoc = pdf(
      React.createElement(InvoicePDF, {
        invoice: invoice,
        settings: settings
      })
    );

    // Generate blob directly
    const blob = await pdfDoc.toBlob();
    return blob;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
} 
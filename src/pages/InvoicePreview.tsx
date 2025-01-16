import React from 'react';
import { PDFViewer } from '@react-pdf/renderer';
import { InvoicePDF } from '../components/InvoicePDF';

const sampleInvoice = {
  invoice_number: "152",
  date: "2024-12-28",
  client: {
    name: "ArcticWP",
    company_name: "Vijami Hakkarainen",
    email: "billing@arcticwp.com",
    client_address: "Insinöörinkatu 49 A 30, 33720 Tampere",
    tax_number: "FI45554933",
    tax_type: "VAT"
  },
  items: [
    {
      name: "JVV Website Design",
      price: 350,
      currency: "$",
      quantity: 1
    },
    {
      name: "Flyers",
      price: 250,
      currency: "$",
      quantity: 1
    }
  ],
  total_amount: 600
};

const sampleSettings = {
  company_name: "Primo Creators",
  name: "Hazim Zaman",
  email: "theprimocreators@gmail.com",
  phone: "+92 303 2294 802",
  address: "SC-01, Street 40, Darussalam Society, Karachi, Pakistan",
  tax_number: "",
  tax_type: "",
  wise_email: "theprimocreators@gmail.com"
};

const InvoicePreview = () => {
  return (
    <div className="w-full h-screen">
      <PDFViewer style={{ width: '100%', height: '100%' }}>
        <InvoicePDF invoice={sampleInvoice} settings={sampleSettings} />
      </PDFViewer>
    </div>
  );
};

export default InvoicePreview; 
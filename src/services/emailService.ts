interface EmailData {
  to: string;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  currency: string;
  items: any[];
  customMessage?: string;
  pdfBlob: Blob;
}

export const sendInvoiceEmail = async (emailData: EmailData) => {
  try {
    // Convert PDF blob to base64
    const reader = new FileReader();
    const base64Promise = new Promise((resolve) => {
      reader.onloadend = () => {
        const base64data = reader.result?.toString().split(',')[1];
        resolve(base64data);
      };
    });
    reader.readAsDataURL(emailData.pdfBlob);
    const base64PDF = await base64Promise;

    // Format currency the same way as in Invoices.tsx
    const formatCurrency = (amount: number, currency: string = '$') => {
      const currencySymbol = currency || '$';
      const formattedAmount = amount.toFixed(2);
      return `${currencySymbol}${formattedAmount}`;
    };

    // Format amounts
    const formattedTotal = formatCurrency(emailData.amount, emailData.currency);
    
    // Create items table in plain text
    const itemsTable = emailData.items.map(item => 
      `${item.name}: ${formatCurrency(item.price, emailData.currency)}`
    ).join('\n');

    const defaultMessage = `Dear ${emailData.clientName},

Please find attached invoice #${emailData.invoiceNumber} for ${formattedTotal}.

Invoice Items:
${itemsTable}

Best regards,
Your Company`;

    const response = await fetch('http://localhost:3001/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: emailData.to,
        subject: `Invoice #${emailData.invoiceNumber} from Your Company`,
        text: emailData.customMessage || defaultMessage,
        attachments: [{
          filename: `Invoice_${emailData.invoiceNumber}.pdf`,
          content: base64PDF,
          encoding: 'base64'
        }]
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Server error response:', data);
      throw new Error(data.message || 'Failed to send email');
    }

    return data;
  } catch (error) {
    console.error('Detailed error in sendInvoiceEmail:', error);
    throw error;
  }
}; 
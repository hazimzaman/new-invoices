import emailjs from '@emailjs/browser';

interface EmailData {
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  currency: string;
  items: any[];
  customMessage?: string;
  pdfBlob: Blob;
  businessName?: string;
}

// Add a constant for the email server URL
const EMAIL_SERVER_URL = 'http://localhost:3001';

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

    // Create items table in plain text
    const itemsTable = emailData.items.map(item => 
      `${item.name}: ${emailData.currency}${item.price.toFixed(2)}`
    ).join('\n');

    const defaultMessage = `Dear ${emailData.clientName},

Thank you for your business. Please find attached invoice #${emailData.invoiceNumber} for ${emailData.currency}${emailData.amount.toFixed(2)}.

Invoice Details:
${itemsTable}

Payment is due within 30 days.

If you have any questions, please don't hesitate to contact us.

Best regards,
${emailData.businessName}

Note: This is an automated email sent from our invoice system.`;

    const response = await fetch(`${EMAIL_SERVER_URL}/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: emailData.from,
        to: emailData.to,
        cc: emailData.cc,
        bcc: emailData.bcc,
        subject: `Invoice #${emailData.invoiceNumber} from ${emailData.businessName}`,
        text: emailData.customMessage || defaultMessage,
        attachments: [{
          filename: `Invoice_${emailData.invoiceNumber}.pdf`,
          content: base64PDF,
          encoding: 'base64'
        }],
        businessName: emailData.businessName
      }),
    });

    // Add better error handling
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Email server error:', errorData);
      throw new Error(errorData.message || 'Failed to send email');
    }

    return await response.json();
  } catch (error) {
    console.error('Error in sendInvoiceEmail:', error);
    throw error;
  }
}; 
const sendInvoiceEmail = async (data: any) => {
  try {
    // Check payload size before sending
    const payloadSize = new Blob([JSON.stringify(data)]).size;
    if (payloadSize > 90_000_000) { // 90MB limit (leaving some buffer)
      throw new Error('Payload size too large. Please reduce the size of attachments.');
    }

    const response = await fetch('http://localhost:3001/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
    
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error('Received non-JSON response:', text);
      throw new Error("Server didn't return JSON");
    }

    return await response.json();
  } catch (error) {
    console.error('Detailed error in sendInvoiceEmail:', error);
    throw error;
  }
};

// Test function to verify email sending
const testEmailEndpoint = async () => {
  try {
    const response = await fetch('http://localhost:3001/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: 'test@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        html: '<p>This is a test email</p>'
      })
    });

    const data = await response.json();
    console.log('Response:', data);
  } catch (error) {
    console.error('Test failed:', error);
  }
}; 
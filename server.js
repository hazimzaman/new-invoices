require('dotenv').config();
const express = require('express');
const app = express();
const morgan = require('morgan');

// Increase the limit for JSON and URL-encoded payloads
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// If you're using body-parser separately, also configure it:
const bodyParser = require('body-parser');
app.use(bodyParser.json({limit: '100mb'}));
app.use(bodyParser.urlencoded({limit: '100mb', extended: true}));

// Add CORS headers if needed
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Add this near the top of your file
app.use(morgan('dev')); // Logs incoming requests

// Add the send-email endpoint
app.post('/send-email', async (req, res) => {
  try {
    const emailData = req.body;
    
    // Validate the request data
    if (!emailData || !emailData.to || !emailData.subject) {
      return res.status(400).json({ 
        error: 'Missing required fields' 
      });
    }

    // Here you would typically use a mail service like nodemailer
    // Example with nodemailer:
    const nodemailer = require('nodemailer');
    
    // Create transporter (configure with your email service)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    // Send the email
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: emailData.to,
      subject: emailData.subject,
      text: emailData.text,
      html: emailData.html,
      attachments: emailData.attachments
    });

    res.json({ 
      message: 'Email sent successfully',
      messageId: info.messageId 
    });

  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ 
      error: 'Failed to send email',
      details: error.message 
    });
  }
});

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something broke!',
    details: err.message 
  });
});

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 
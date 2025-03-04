import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

// Configure dotenv
dotenv.config();

// Get current directory path (needed for ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Add cors middleware before other middleware
app.use(cors());

// These middleware declarations are important!
app.use(express.json({ limit: '50mb' }));  // Increased limit for PDF attachments
app.use(express.urlencoded({ extended: true }));
// This line is crucial for serving the index.html
app.use(express.static('public'));

// Add a root route to verify the server is working
app.get('/', (req, res) => {
    res.sendFile('index.html', { root: path.join(__dirname, 'public') });
});

// Add this test route
app.get('/test', (req, res) => {
    res.send('Server is working!');
});

// Configure nodemailer
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// Test SMTP connection
transporter.verify((error, success) => {
    if (error) {
        console.error('SMTP Error:', error);
    } else {
        console.log('Server is ready to send emails');
    }
});

// Email sending endpoint
app.post('/send-email', async (req, res) => {
    try {
        const { from, to, cc, bcc, subject, text, attachments, businessName } = req.body;
        
        console.log('Sending email:', { to, subject, hasAttachment: !!attachments });

        const mailOptions = {
            from: `${businessName} <${process.env.SMTP_USER}>`,
            to,
            cc,
            bcc,
            subject,
            text,
            attachments,
            replyTo: from
        };

        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'Email sent successfully!' });
    } catch (error) {
        console.error('Email sending error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to send email',
            error: error.message 
        });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Email server running on port ${PORT}`);
}); 
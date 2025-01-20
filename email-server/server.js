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
app.use(express.json());
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
    host: 'smtp.zoho.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.ZOHO_USER,
        pass: process.env.ZOHO_PASS
    },
    debug: true
});

// Verify the connection configuration
transporter.verify(function(error, success) {
    if (error) {
        console.error('SMTP connection error:', error);
    } else {
        console.log('Server is ready to take our messages');
    }
});

// API endpoint for sending email
app.post('/send-email', async (req, res) => {
    const { to, subject, text, attachments } = req.body;
    
    try {
        // Log the incoming request data (without sensitive info)
        console.log('Received email request:', {
            to,
            subject,
            hasAttachments: !!attachments,
            attachmentsLength: attachments?.length
        });

        // Verify we have the required environment variables
        if (!process.env.ZOHO_USER || !process.env.ZOHO_PASS) {
            throw new Error('Missing ZOHO credentials in environment variables');
        }

        // Log the email attempt
        console.log('Attempting to send email with config:', {
            from: process.env.ZOHO_USER,
            to,
            subject,
            hasAttachments: !!attachments
        });
        
        const mailOptions = {
            from: process.env.ZOHO_USER,
            to,
            subject,
            text,
            attachments
        };

        console.log('Mail options prepared:', {
            ...mailOptions,
            text: text?.substring(0, 50) + '...' // Log just the start of the text
        });

        await transporter.sendMail(mailOptions);
        
        console.log('Email sent successfully to:', to);
        res.json({ success: true, message: 'Email sent successfully!' });
    } catch (error) {
        console.error('Detailed error:', error);
        console.error('Error stack:', error.stack);
        
        // Send a more specific error message to the client
        let errorMessage = 'Failed to send email';
        if (error.code === 'EAUTH') {
            errorMessage = 'Authentication failed - check email credentials';
        } else if (error.code === 'ESOCKET') {
            errorMessage = 'Network error - check your connection';
        }
        
        res.status(500).json({ 
            success: false, 
            message: errorMessage,
            error: error.message,
            stack: error.stack
        });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 
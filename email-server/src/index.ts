import express from 'express';
import cors from 'cors';
import uploadRoutes from './routes/upload';

const app = express();

app.use(cors());
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));

// Use upload routes
app.use('/api/upload', uploadRoutes);

// ... rest of your server code 
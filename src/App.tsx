import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Clients from './pages/Clients';
import Invoices from './pages/Invoices';
import Settings from './pages/Settings';
import Auth from './pages/Auth';
import Reports from './pages/Reports';
import { useAuth } from './lib/auth';
import { supabase } from './lib/supabase';
import InvoicePreview from './pages/InvoicePreview';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import { ErrorBoundary } from 'react-error-boundary';

function LoadingScreen({ message, showAuthLink = false }) {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <p className="text-gray-600">{message}</p>
        {showAuthLink && (
          <button 
            onClick={() => window.location.href = '/auth'} 
            className="mt-4 text-primary-600 hover:text-primary-800"
          >
            Click here if loading takes too long
          </button>
        )}
      </div>
    </div>
  );
}

function ErrorFallback({error}: {error: Error}) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-bold text-red-600">Something went wrong:</h2>
        <pre className="mt-2 text-sm text-gray-500">{error.message}</pre>
      </div>
    </div>
  );
}

function App() {
  const { loading, user } = useAuth();

  if (loading) {
    return <LoadingScreen message="Initializing app..." showAuthLink />;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Toaster position="top-right" />
      <Router>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/*"
            element={
              <Layout>
                <Routes>
                  <Route path="reports" element={<Reports />} />
                  <Route path="clients" element={<Clients />} />
                  <Route path="invoices" element={<Invoices />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="/" element={<Navigate to="/reports" replace />} />
                  <Route path="/invoice-preview" element={<InvoicePreview />} />
                </Routes>
              </Layout>
            }
          />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
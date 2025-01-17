import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, Settings as SettingsIcon, LogOut } from 'lucide-react';
import Clients from './pages/Clients';
import Invoices from './pages/Invoices';
import Settings from './pages/Settings';
import Auth from './pages/Auth';
import Reports from './pages/Reports';
import { useAuth } from './lib/auth';
import { supabase } from './lib/supabase';
import InvoicePreview from './pages/InvoicePreview';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/Sidebar';

function Layout({ children }: { children: React.ReactNode }) {
  const { user, signOut, loading } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <Sidebar 
        isOpen={isSidebarOpen} 
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
      />

      {/* Main Content */}
      <main className={`
        flex-1 transition-all duration-300 ease-in-out
        lg:ml-64 p-4 lg:p-8
      `}>
        {/* Add padding for mobile menu button */}
        <div className="h-14 lg:h-0" />
        {children}
      </main>
    </div>
  );
}

function App() {
  const { loading, user } = useAuth();

  useEffect(() => {
    // Check current auth state
    const checkAuth = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      console.log('Current session:', session, 'Error:', error);
    };

    checkAuth();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <p className="text-gray-600">Initializing app...</p>
          <button 
            onClick={() => window.location.href = '/auth'} 
            className="mt-4 text-primary-600 hover:text-primary-800"
          >
            Click here if loading takes too long
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
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
    </>
  );
}

export default App;
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, Settings as SettingsIcon, LogOut } from 'lucide-react';
import Clients from './pages/Clients';
import Invoices from './pages/Invoices';
import Settings from './pages/Settings';
import Auth from './pages/Auth';
import { useAuth } from './lib/auth';
import { supabase } from './lib/supabase';
import InvoicePreview from './pages/InvoicePreview';

function Layout({ children }: { children: React.ReactNode }) {
  const { user, signOut, loading } = useAuth();

  console.log('Layout render:', { user, loading });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    console.log('No user found, redirecting to auth');
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar - Fixed position */}
      <nav className="w-64 bg-white shadow-lg fixed h-screen overflow-y-auto">
        <div className="p-4">
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">{user.email}</p>
        </div>
        <ul className="mt-4">
          <li>
            <Link
              to="/clients"
              className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-100"
            >
              <Users className="w-5 h-5 mr-3" />
              Clients
            </Link>
          </li>
          <li>
            <Link
              to="/invoices"
              className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-100"
            >
              <FileText className="w-5 h-5 mr-3" />
              Invoices
            </Link>
          </li>
          <li>
            <Link
              to="/settings"
              className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-100"
            >
              <SettingsIcon className="w-5 h-5 mr-3" />
              Settings
            </Link>
          </li>
        </ul>
        <div className="absolute bottom-0 left-0 w-full p-4 border-t bg-white">
          <button
            onClick={() => signOut()}
            className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 w-full rounded-md"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Sign Out
          </button>
        </div>
      </nav>

      {/* Main Content - With left margin to account for fixed sidebar */}
      <main className="flex-1 ml-64 p-8">
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

  console.log('App render:', { loading, user });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Initializing app...</p>
          <button 
            onClick={() => window.location.href = '/auth'} 
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            Click here if loading takes too long
          </button>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/*" element={
          <Layout>
            <Routes>
              <Route path="clients" element={<Clients />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="settings" element={<Settings />} />
              <Route path="/" element={<Navigate to="/clients" replace />} />
              <Route path="/invoice-preview" element={<InvoicePreview />} />
            </Routes>
          </Layout>
        } />
      </Routes>
    </Router>
  );
}

export default App;
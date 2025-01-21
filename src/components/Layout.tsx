import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { useAuth } from '../lib/auth';
import { Navigate } from 'react-router-dom';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, loading } = useAuth();

  const toggleSidebar = () => {
    setIsSidebarOpen(prev => !prev);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar 
        isOpen={isSidebarOpen} 
        toggleSidebar={toggleSidebar} 
      />

      <main 
        className={`
          min-h-screen transition-all duration-300 ease-in-out
          pt-20 md:pt-6
          ${isSidebarOpen 
            ? 'pl-72 md:pl-92' 
            : 'pl-4 md:pl-24'
          }
          pr-4
        `}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Breadcrumb */}
          <div className="mb-8">
            {/* Your breadcrumb component */}
          </div>
          
          {/* Main Content */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout; 
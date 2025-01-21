import React, { useState } from 'react';
import Sidebar from './components/Sidebar';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar 
        isOpen={isSidebarOpen} 
        toggleSidebar={toggleSidebar} 
      />

      <main className={`
        min-h-screen transition-all duration-300 ease-in-out
        pt-20 md:pt-6
        ${isSidebarOpen 
          ? 'pl-72 md:pl-92' 
          : 'pl-4 md:pl-24'
        }
        pr-4
      `}>
        {children}
      </main>
    </div>
  );
};

export default Layout; 
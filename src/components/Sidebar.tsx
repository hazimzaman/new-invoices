import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, Settings as SettingsIcon, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../lib/auth';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

export default function Sidebar({ isOpen, toggleSidebar }: SidebarProps) {
  const { user, signOut } = useAuth();
  const location = useLocation();

  const isActivePath = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/reports', icon: LayoutDashboard, label: 'Reports' },
    { path: '/clients', icon: Users, label: 'Clients' },
    { path: '/invoices', icon: FileText, label: 'Invoices' },
    { path: '/settings', icon: SettingsIcon, label: 'Settings' },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Mobile Toggle Button */}
      <button
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-30 lg:hidden bg-white p-2 rounded-md shadow-lg"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <nav className={`
        fixed top-0 left-0 h-screen bg-white shadow-lg z-30
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        w-64 lg:static
      `}>
        <div className="p-4">
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">{user?.email}</p>
        </div>

        <ul className="mt-4">
          {navItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={`
                  flex items-center px-4 py-3 text-gray-700 hover:bg-gray-100
                  ${isActivePath(item.path) ? 'bg-blue-50 text-blue-600' : ''}
                `}
                onClick={() => {
                  if (window.innerWidth < 1024) {
                    toggleSidebar();
                  }
                }}
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="absolute bottom-0 left-0 w-full p-4 border-t border-gray-200 bg-white">
          <button
            onClick={() => signOut()}
            className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 w-full rounded-md"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Sign Out
          </button>
        </div>
      </nav>
    </>
  );
} 
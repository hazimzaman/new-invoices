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

  const navItems = [
    { path: '/reports', icon: LayoutDashboard, label: 'Reports' },
    { path: '/clients', icon: Users, label: 'Clients' },
    { path: '/invoices', icon: FileText, label: 'Invoices' },
    { path: '/settings', icon: SettingsIcon, label: 'Settings' },
  ];

  const isActivePath = (path: string) => location.pathname === path;

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-50 md:hidden bg-white p-2 rounded-md shadow-lg hover:bg-gray-50"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}

      {/* Animated Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full bg-white border-r shadow-lg z-40
          transition-all duration-300 ease-in-out
          ${isOpen ? 'w-72' : 'w-20'}
          ${isOpen ? 'md:w-72' : 'md:w-20'}
          -translate-x-full md:translate-x-0
          ${isOpen ? 'translate-x-0' : ''}
        `}
      >
        <div className="flex flex-col h-full">
          <div className={`
            p-6 flex items-center
            ${isOpen ? 'justify-between' : 'justify-center'}
          `}>
            {isOpen ? (
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
                <p className="text-sm text-gray-600 mt-1 truncate">{user?.email}</p>
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                {user?.email?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
          </div>

          <nav className="flex-1 px-3 py-4">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => {
                  if (window.innerWidth < 768) {
                    toggleSidebar();
                  }
                }}
                className={`
                  flex items-center px-4 py-3 rounded-lg mb-1
                  relative group
                  ${isActivePath(item.path) 
                    ? 'bg-blue-50 text-blue-600' 
                    : 'text-gray-700 hover:bg-gray-50'
                  }
                `}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className={`
                  ml-3 whitespace-nowrap
                  transition-all duration-300
                  ${isOpen ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100'}
                  ${isOpen ? 'relative' : 'absolute left-full pl-3 bg-gray-900 text-white px-2 py-1 rounded ml-2 text-sm'}
                `}>
                  {item.label}
                </span>
              </Link>
            ))}
          </nav>

          <div className="border-t">
            <div className="px-3 py-4">
              <button
                onClick={signOut}
                className={`
                  flex items-center rounded-lg w-full
                  px-4 py-3 text-gray-700 hover:bg-gray-50
                  relative group
                `}
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
                <span className={`
                  ml-3 whitespace-nowrap
                  transition-all duration-300
                  ${isOpen ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100'}
                  ${isOpen ? 'relative' : 'absolute left-full pl-3 bg-gray-900 text-white px-2 py-1 rounded ml-2 text-sm'}
                `}>
                  Sign Out
                </span>
              </button>
            </div>

            {/* Toggle button - always at the bottom */}
            <button
              onClick={toggleSidebar}
              className="w-full p-4 text-gray-600 hover:bg-gray-50 border-t flex items-center justify-center"
              aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
} 
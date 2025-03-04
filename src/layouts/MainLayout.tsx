import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { Navbar } from '../components/Navbar';

function MainLayout({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="py-6">
        {children}
      </main>
    </div>
  );
}

export default MainLayout; 
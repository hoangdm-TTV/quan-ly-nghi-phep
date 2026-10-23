'use client';

import { useState } from 'react';
import { SafeUser } from '@/lib/types/user';
import AppSidebar from './app-sidebar';
import AppHeader from './app-header';

interface DashboardShellProps {
  user: SafeUser;
  children: React.ReactNode;
}

export default function DashboardShell({ user, children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar navigation */}
      <AppSidebar
        user={user}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main layout container (offset 256px on desktop) */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        <AppHeader
          user={user}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

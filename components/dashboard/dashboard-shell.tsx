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
    <div className="min-h-screen bg-[#f1f5f9] flex antialiased">
      {/* Sidebar navigation */}
      <AppSidebar
        user={user}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main layout container (offset 288px on desktop for w-72) */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-72">
        <AppHeader
          user={user}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

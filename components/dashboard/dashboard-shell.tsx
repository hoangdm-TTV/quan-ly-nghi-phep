"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SafeUser } from "@/lib/types/user";
import AppSidebar from "./app-sidebar";
import AppHeader from "./app-header";

interface DashboardShellProps {
  user: SafeUser;
  approvalCounts: {
    leave: number;
    outOffice: number;
  };
  children: React.ReactNode;
}

export default function DashboardShell({
  user,
  approvalCounts,
  children,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const lastRefreshAt = useRef(Date.now());

  useEffect(() => {
    const refreshIfStale = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastRefreshAt.current < 10_000) return;
      lastRefreshAt.current = Date.now();
      router.refresh();
    };

    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      lastRefreshAt.current = Date.now();
      router.refresh();
    }, 10_000);
    document.addEventListener("visibilitychange", refreshIfStale);
    window.addEventListener("focus", refreshIfStale);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshIfStale);
      window.removeEventListener("focus", refreshIfStale);
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex antialiased">
      {/* Sidebar navigation */}
      <AppSidebar
        user={user}
        approvalCounts={approvalCounts}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main layout container (offset 288px on desktop for w-72) */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-72">
        <AppHeader
          user={user}
          approvalCounts={approvalCounts}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

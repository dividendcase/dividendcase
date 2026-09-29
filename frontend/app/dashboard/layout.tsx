"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AppActionsProvider } from "@/components/layout/AppActions";
import { FirstRunSetup } from "@/components/setup/FirstRunSetup";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Escape closes the menu on small screens
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSidebarOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  return (
    <AppActionsProvider>
      <div className="flex h-dvh overflow-hidden bg-background">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden" id="main-scroll">
          <Header onMenuToggle={() => setSidebarOpen(true)} />
          <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            {children}
            <Footer />
          </main>
        </div>
      </div>
      <FirstRunSetup />
    </AppActionsProvider>
  );
}

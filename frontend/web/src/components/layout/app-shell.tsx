"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { AuthProvider } from "@/components/auth/auth-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isLoginPage = pathname === "/login";

  if (isLoginPage) {
        return <AuthProvider>{children}</AuthProvider>;
  }

  return (
        <AuthProvider>
              <div className="flex min-h-screen">
                      <Sidebar />
                      <div className="flex flex-1 flex-col">
                                <Topbar />
                                <main className="flex-1 overflow-y-auto">{children}</main>
                      </div>
              </div>
            </AuthProvider>
                          );
                        }
                        

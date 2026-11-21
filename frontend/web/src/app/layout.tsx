import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AppShell } from "@/components/layout/app-shell";
import { AssistantWidget } from "@/components/assistant/assistant-widget";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
    title: "RPMS — Radiation Protection Management System",
    description: "Gestión integral de protección radiológica.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
          <html lang="es" className={`${inter.variable} ${mono.variable} dark`}>
                  <body className="min-h-screen bg-background text-foreground">
                          <AppShell>{children}</AppShell>
                          <AssistantWidget />
                        </body>                  
          </html>
        );
}

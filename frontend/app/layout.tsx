import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgendaFlow",
  description: "Sistema de agendamento online",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="theme-dark">
      <body>{children}</body>
    </html>
  );
} 

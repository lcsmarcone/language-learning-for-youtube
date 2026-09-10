import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeScript } from "@/components/ui/ThemeScript";
import { Toaster } from "@/components/ui/Toast";
import { OfflineBanner } from "@/components/ui/OfflineBanner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Estudo por vídeo",
  description:
    "Aprenda idiomas com os vídeos que você realmente quer assistir: legenda sincronizada, tradução contextual e flashcards para o Anki.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col bg-bg text-fg">
        <OfflineBanner />
        {children}
        <Toaster />
      </body>
    </html>
  );
}

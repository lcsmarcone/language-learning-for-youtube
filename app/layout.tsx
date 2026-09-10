import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { ThemeScript } from "@/components/ui/ThemeScript";
import { Toaster } from "@/components/ui/Toast";
import { OfflineBanner } from "@/components/ui/OfflineBanner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Serifada para o **conteúdo** — a frase no idioma original.
 *
 * Não é enfeite: a legenda é o que o usuário lê durante minutos seguidos, e
 * separá-la tipograficamente da interface faz duas coisas de uma vez. Ela para
 * de parecer rótulo de botão e passa a parecer texto para estudar; e a
 * distinção entre o idioma original (serifada) e a tradução (sem serifa,
 * apagada) fica visível mesmo de relance, sem depender de cor.
 */
const serif = Source_Serif_4({
  variable: "--font-source-serif",
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
    // `suppressHydrationWarning` só no <html>, e por um motivo específico:
    // o `ThemeScript` abaixo escreve `data-theme` neste elemento **antes** da
    // hidratação, de propósito — é o que evita a tela piscar no tema errado ao
    // carregar. Isso faz o HTML do servidor divergir do DOM do cliente neste
    // único atributo, e o React precisa ser avisado de que a diferença é
    // intencional. O aviso continua ativo para todo o resto da árvore.
    <html
      lang="pt-BR"
      className={`${inter.variable} ${serif.variable} h-full antialiased`}
      suppressHydrationWarning
    >
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

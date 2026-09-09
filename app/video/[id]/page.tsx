import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { StudyScreen } from "@/components/video/StudyScreen";
import { getStudyVideo } from "@/services/study";

// Depende do banco local e do progresso do usuário: nunca deve vir de cache.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/video/[id]">): Promise<Metadata> {
  const { id } = await params;
  const video = await getStudyVideo(id);
  return { title: video ? `${video.title} — Estudo por vídeo` : "Vídeo" };
}

export default async function StudyPage({ params }: PageProps<"/video/[id]">) {
  const { id } = await params;
  const video = await getStudyVideo(id);

  if (!video) notFound();

  return (
    // Altura travada na janela: a transcrição rola dentro dela, não a página
    // inteira — o vídeo precisa continuar visível enquanto se lê a legenda.
    <main className="flex h-screen min-h-0 flex-col overflow-hidden">
      <StudyScreen video={video} />
    </main>
  );
}

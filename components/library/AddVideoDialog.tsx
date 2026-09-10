"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Download, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { LANGUAGE_LABELS, SOURCE_LANGUAGES, type SourceLanguage } from "@/lib/domain";
import { MAX_BODY_BYTES } from "@/lib/api";

type SubtitleMode = "file" | "paste" | "detect";

interface Metadata {
  title: string;
  authorName: string | null;
  thumbnailUrl: string;
}

interface AddVideoDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Formulário de entrada do produto (instrucoes.md secao 21).
 *
 * A meta é chegar à tela de estudo rápido: cola a URL, escolhe o idioma,
 * entrega a legenda. A prévia do vídeo aparece sozinha enquanto se digita,
 * para o usuário confirmar que é o vídeo certo antes de adicionar.
 */
export function AddVideoDialog({ open, onClose }: AddVideoDialogProps) {
  const router = useRouter();

  const [url, setUrl] = useState("");
  const [sourceLang, setSourceLang] = useState<SourceLanguage>("en");
  const [mode, setMode] = useState<SubtitleMode>("file");
  const [subtitleContent, setSubtitleContent] = useState("");
  const [filename, setFilename] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState("");

  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [loadingMetadata, setLoadingMetadata] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detecção automática via yt-dlp (etapa 10). `null` = ainda consultando.
  const [detectAvailable, setDetectAvailable] = useState<boolean | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState<{
    content: string;
    lang: string;
    automatic: boolean;
    segmentCount: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Limpa tudo ao reabrir, para não herdar o estado de uma tentativa anterior.
  useEffect(() => {
    if (open) return;
    setUrl("");
    setSubtitleContent("");
    setPastedText("");
    setFilename(null);
    setMetadata(null);
    setMetadataError(null);
    setError(null);
    setDetected(null);
  }, [open]);

  // Só perguntamos se o yt-dlp existe quando o diálogo abre: é uma checagem
  // barata, mas não faz sentido rodá-la enquanto ninguém vai adicionar vídeo.
  useEffect(() => {
    if (!open || detectAvailable !== null) return;

    void (async () => {
      try {
        const response = await fetch("/api/youtube/subtitles");
        const payload = await response.json();
        setDetectAvailable(payload.ok ? payload.data.available : false);
      } catch {
        setDetectAvailable(false);
      }
    })();
  }, [open, detectAvailable]);

  // Trocar de vídeo invalida a legenda já detectada.
  useEffect(() => {
    setDetected(null);
  }, [url, sourceLang]);

  async function handleDetect() {
    if (url.trim().length === 0) {
      setError("Cole o endereço do vídeo antes de detectar a legenda.");
      return;
    }

    setDetecting(true);
    setError(null);
    setDetected(null);

    try {
      const response = await fetch("/api/youtube/subtitles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), lang: sourceLang }),
      });
      const payload = await response.json();

      if (!payload.ok) {
        setError(payload.error);
        return;
      }

      setDetected(payload.data);
    } catch {
      setError("Não foi possível buscar a legenda agora.");
    } finally {
      setDetecting(false);
    }
  }

  // Prévia do vídeo. O debounce evita uma consulta por tecla digitada.
  useEffect(() => {
    if (!open || url.trim().length < 8) {
      setMetadata(null);
      setMetadataError(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoadingMetadata(true);
      try {
        const response = await fetch(
          `/api/youtube/metadata?url=${encodeURIComponent(url.trim())}`,
          { signal: controller.signal },
        );
        const payload = await response.json();
        if (payload.ok) {
          setMetadata(payload.data);
          setMetadataError(null);
        } else {
          setMetadata(null);
          setMetadataError(payload.error);
        }
      } catch {
        // Requisição cancelada por nova digitação: não é erro para o usuário.
      } finally {
        setLoadingMetadata(false);
      }
    }, 500);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [url, open]);

  async function handleFile(file: File | null) {
    if (!file) return;

    if (file.size > MAX_BODY_BYTES) {
      setError("O arquivo passa de 2 MB. Envie uma legenda menor.");
      return;
    }

    const extension = file.name.toLowerCase().split(".").pop();
    if (!["srt", "vtt", "txt"].includes(extension ?? "")) {
      setError("Envie um arquivo .srt, .vtt ou .txt.");
      return;
    }

    setError(null);
    setFilename(file.name);
    setSubtitleContent(await file.text());
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const content =
      mode === "file"
        ? subtitleContent
        : mode === "paste"
          ? pastedText
          : (detected?.content ?? "");

    if (content.trim().length === 0) {
      setError(
        mode === "file"
          ? "Escolha o arquivo de legenda."
          : mode === "paste"
            ? "Cole a transcrição do vídeo."
            : "Clique em “Buscar legenda” antes de continuar.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          sourceLang,
          targetLang: "pt-BR",
          title: metadata?.title ?? null,
          subtitle: {
            content,
            filename:
              mode === "file"
                ? filename
                : mode === "detect"
                  ? "legenda.vtt"
                  : null,
          },
        }),
      });

      const payload = await response.json();
      if (!payload.ok) {
        setError(payload.error);
        return;
      }

      onClose();
      router.refresh();
    } catch {
      setError("Não foi possível salvar. Verifique sua conexão e tente de novo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adicionar vídeo"
      description="Cole o endereço do vídeo e traga a legenda no idioma original."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Field label="Endereço do vídeo">
          <input
            type="url"
            inputMode="url"
            autoFocus
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="h-9 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg placeholder:text-fg-subtle"
          />
          <Preview
            loading={loadingMetadata}
            metadata={metadata}
            error={metadataError}
          />
        </Field>

        <Field label="Idioma original">
          <div className="flex gap-2">
            {SOURCE_LANGUAGES.map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setSourceLang(lang)}
                aria-pressed={sourceLang === lang}
                className={
                  sourceLang === lang
                    ? "h-8 rounded-md border border-accent bg-accent-subtle px-3 text-xs font-medium text-fg"
                    : "h-8 rounded-md border border-border px-3 text-xs text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg"
                }
              >
                {LANGUAGE_LABELS[lang]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-fg-subtle">
            Traduzimos para {LANGUAGE_LABELS["pt-BR"]}.
          </p>
        </Field>

        <Field label="Legenda">
          <div className="flex gap-2">
            <ModeButton
              active={mode === "file"}
              onClick={() => setMode("file")}
              label="Importar arquivo"
            />
            <ModeButton
              active={mode === "paste"}
              onClick={() => setMode("paste")}
              label="Colar transcrição"
            />
            {detectAvailable === false ? (
              <span
                title="Instale o yt-dlp na sua máquina para habilitar esta opção."
                className="inline-flex h-8 cursor-not-allowed items-center rounded-md border border-dashed border-border px-3 text-xs text-fg-subtle"
              >
                Detectar automaticamente
              </span>
            ) : (
              <ModeButton
                active={mode === "detect"}
                onClick={() => setMode("detect")}
                label="Detectar automaticamente"
              />
            )}
          </div>

          {mode === "file" ? (
            <div className="mt-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".srt,.vtt,.txt,text/plain"
                className="sr-only"
                onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="w-full justify-start"
              >
                <Upload size={14} strokeWidth={1.75} />
                {filename ?? "Escolher arquivo .srt ou .vtt"}
              </Button>
              <p className="mt-2 text-xs text-fg-subtle">
                Até 2 MB. Aceitamos também .txt com uma transcrição dentro.
              </p>
            </div>
          ) : mode === "detect" ? (
            <div className="mt-3">
              <Button
                onClick={handleDetect}
                disabled={detecting}
                className="w-full justify-start"
              >
                {detecting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" strokeWidth={2} />
                    Buscando legenda no YouTube…
                  </>
                ) : (
                  <>
                    <Download size={14} strokeWidth={1.75} />
                    {detected ? "Buscar de novo" : "Buscar legenda"}
                  </>
                )}
              </Button>

              {detected ? (
                <p className="mt-2 text-xs leading-relaxed text-fg-muted">
                  {detected.segmentCount} blocos encontrados na faixa
                  <span className="font-mono"> {detected.lang}</span>
                  {detected.automatic
                    ? " — é uma legenda automática, então pode ter erros de transcrição."
                    : " — legenda oficial do vídeo."}
                </p>
              ) : (
                <p className="mt-2 text-xs leading-relaxed text-fg-subtle">
                  Usa o yt-dlp instalado na sua máquina para baixar a legenda
                  publicada pelo próprio vídeo. Preferimos a legenda oficial; se
                  não houver, usamos a automática.
                </p>
              )}
            </div>
          ) : (
            <div className="mt-3">
              <textarea
                value={pastedText}
                onChange={(event) => setPastedText(event.target.value)}
                rows={6}
                placeholder={"0:00\nAll right, so here we are\n0:04\nin front of the elephants"}
                className="w-full resize-y rounded-md border border-border bg-bg p-3 text-sm leading-relaxed text-fg placeholder:text-fg-subtle"
              />
              <p className="mt-2 text-xs text-fg-subtle">
                Se a transcrição tiver marcas de tempo (como a do YouTube), a
                sincronia fica exata. Sem elas, estimamos os tempos e avisamos
                que são aproximados.
              </p>
            </div>
          )}
        </Field>

        {error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs leading-relaxed text-danger"
          >
            <AlertCircle size={14} strokeWidth={1.75} className="mt-px shrink-0" />
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button onClick={onClose} variant="ghost" disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin" strokeWidth={2} />
                Criando…
              </>
            ) : (
              "Criar sessão de estudo"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium text-fg-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function ModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "h-8 rounded-md border border-accent bg-accent-subtle px-3 text-xs font-medium text-fg"
          : "h-8 rounded-md border border-border px-3 text-xs text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg"
      }
    >
      {label}
    </button>
  );
}

function Preview({
  loading,
  metadata,
  error,
}: {
  loading: boolean;
  metadata: Metadata | null;
  error: string | null;
}) {
  if (loading) {
    return (
      <p className="mt-2 flex items-center gap-2 text-xs text-fg-subtle">
        <Loader2 size={12} className="animate-spin" strokeWidth={2} />
        Procurando o vídeo…
      </p>
    );
  }

  if (error) {
    return <p className="mt-2 text-xs text-danger">{error}</p>;
  }

  if (!metadata) return null;

  return (
    <div className="mt-3 flex items-center gap-3 rounded-md border border-border bg-bg-subtle p-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail externa do YouTube, sem otimização do Next */}
      <img
        src={metadata.thumbnailUrl}
        alt=""
        className="h-12 w-20 shrink-0 rounded object-cover"
      />
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-fg">{metadata.title}</p>
        {metadata.authorName ? (
          <p className="truncate text-xs text-fg-subtle">
            {metadata.authorName}
          </p>
        ) : null}
      </div>
    </div>
  );
}

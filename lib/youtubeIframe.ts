/**
 * Carregamento da IFrame Player API do YouTube.
 *
 * É a forma oficial e suportada de controlar um vídeo incorporado — e é o que
 * torna viável o requisito central do produto: clicar numa frase da
 * transcrição e o vídeo pular para aquele instante (`seekTo`), além do loop de
 * repetição (`getCurrentTime` + `seekTo`).
 *
 * O script é global e só pode ser carregado uma vez na página; por isso a
 * promessa fica em módulo, compartilhada por todos os componentes.
 */

export const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

export interface YouTubePlayerInstance {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  setPlaybackRate(rate: number): void;
  getAvailablePlaybackRates(): number[];
  destroy(): void;
}

interface YouTubeApi {
  Player: new (
    element: HTMLElement | string,
    options: {
      videoId: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (event: { target: YouTubePlayerInstance }) => void;
        onStateChange?: (event: { data: number }) => void;
        onError?: (event: { data: number }) => void;
      };
    },
  ) => YouTubePlayerInstance;
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YouTubeApi> | null = null;

export function loadYouTubeApi(): Promise<YouTubeApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("A API do YouTube só existe no navegador."));
  }

  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YouTubeApi>((resolve, reject) => {
    const timeout = setTimeout(() => {
      apiPromise = null;
      reject(new Error("O player do YouTube demorou demais para carregar."));
    }, 15_000);

    // O YouTube chama esta função global quando o script termina de carregar.
    // Preservamos qualquer callback anterior por segurança.
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      clearTimeout(timeout);
      if (window.YT?.Player) {
        resolve(window.YT);
      } else {
        apiPromise = null;
        reject(new Error("A API do YouTube carregou incompleta."));
      }
    };

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      clearTimeout(timeout);
      apiPromise = null;
      reject(new Error("Não foi possível carregar o player do YouTube."));
    };
    document.head.appendChild(script);
  });

  return apiPromise;
}

/**
 * Mensagens dos códigos de erro do player.
 * Referência: https://developers.google.com/youtube/iframe_api_reference
 */
export function describePlayerError(code: number): string {
  switch (code) {
    case 2:
      return "O endereço do vídeo é inválido.";
    case 5:
      return "Este vídeo não pode ser reproduzido no player HTML5.";
    case 100:
      return "Vídeo não encontrado. Ele pode ter sido removido ou tornado privado.";
    case 101:
    case 150:
      return "O dono do vídeo não permite reprodução fora do YouTube. Estude por lá ou escolha outro vídeo.";
    default:
      return "O player do YouTube não conseguiu carregar este vídeo.";
  }
}

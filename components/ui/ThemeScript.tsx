/**
 * Aplica o tema salvo antes da primeira pintura, evitando "flash" de tema errado.
 * Roda inline no <head>; sem estado React, sem dependências.
 */
export function ThemeScript() {
  const code = `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

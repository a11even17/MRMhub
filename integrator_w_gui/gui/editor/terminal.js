import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

// Export only stable public APIs; no commands or clipboard escape handlers.
export function createTerminal(host, onInput, onResize) {
  const terminal = new Terminal({
    cursorBlink: true, scrollback: 5000, fontSize: 13,
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
    allowProposedApi: false, screenReaderMode: true,
    theme: { background: "#0b121a", foreground: "#d2e2eb", cursor: "#82d6c4", selectionBackground: "#315360" },
  });
  const fit = new FitAddon(); terminal.loadAddon(fit); terminal.open(host);
  terminal.onData(onInput);
  terminal.onResize(({ cols, rows }) => onResize(cols, rows));
  let frame;
  const resize = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => { if (host.clientWidth && host.clientHeight) fit.fit(); });
  };
  new ResizeObserver(resize).observe(host);
  document.fonts.ready.then(resize);
  return { terminal, resize };
}

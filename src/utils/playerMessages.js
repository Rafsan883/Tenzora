export function isPlayerMessage(event, iframeRef) {
  const frame = iframeRef?.current;
  if (!frame?.contentWindow || event.source !== frame.contentWindow) return false;
  try { return event.origin === new URL(frame.src, window.location.href).origin; }
  catch { return false; }
}

// Strings de datetime do backend não têm indicador de fuso (naive UTC).
// Appenda 'Z' para que o browser as interprete corretamente como UTC.
export function parseUTC(isoStr) {
  if (!isoStr) return null;
  if (isoStr.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(isoStr)) return new Date(isoStr);
  return new Date(isoStr + "Z");
}

export function fmtDate(d) {
  if (!d) return "—";
  return parseUTC(d).toLocaleDateString("pt-BR");
}

export function fmtDateTime(d) {
  if (!d) return "—";
  return parseUTC(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function timeAgoFromUTC(isoStr) {
  if (!isoStr) return "";
  const diff = (Date.now() - parseUTC(isoStr)) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}

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

// Para campos date-only (YYYY-MM-DD): parse como data local para evitar off-by-one em UTC-3
export function fmtDateOnly(dateStr) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
}

export function timeAgoFromUTC(isoStr) {
  if (!isoStr) return "";
  const diff = (Date.now() - parseUTC(isoStr)) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}

// Contagem regressiva até uma data futura (ex: expiração). Não confundir com
// timeAgoFromUTC, que assume o alvo no passado — usá-la para datas futuras
// sempre retorna "agora" porque a diferença fica negativa.
export function timeUntilUTC(isoStr) {
  if (!isoStr) return "";
  const diff = (parseUTC(isoStr) - Date.now()) / 1000;
  if (diff <= 0) return "expirado";
  if (diff < 60) return `${Math.ceil(diff)}s`;
  if (diff < 3600) return `${Math.ceil(diff / 60)}min`;
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    const m = Math.round((diff % 3600) / 60);
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }
  return `${Math.floor(diff / 86400)}d`;
}

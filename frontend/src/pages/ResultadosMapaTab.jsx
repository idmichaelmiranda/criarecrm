import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Tooltip, Popup, GeoJSON } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";
import { useTranslation } from "react-i18next";
import { resultadosApi } from "../services/api";

const STATUS_COR = {
  concluida:    "#10b981",
  em_andamento: "#3b82f6",
  pausada:      "#f59e0b",
};

// A CARTO passou a exigir API key mesmo no plano gratuito para os tiles raster
// (basemaps.cartocdn.com) — sem isso os tiles voltam com o watermark "API KEY
// REQUIRED". Chave gratuita (sem cartão, sem aprovação): https://carto.com/basemaps/apikey/
const CARTO_API_KEY = import.meta.env.VITE_CARTO_API_KEY;
const CARTO_DARK_TILE_URL =
  `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png` +
  (CARTO_API_KEY ? `?key=${CARTO_API_KEY}` : "");

const PERIODO_OPTS = [
  { value: "30"  },
  { value: "90"  },
  { value: "180" },
  { value: "365" },
];

function createStatusIcon(status, coordReal) {
  const cor = STATUS_COR[status] || "#9ca3af";
  const border = coordReal
    ? "2.5px solid rgba(255,255,255,0.85)"
    : "2.5px dashed #f59e0b";
  return L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${cor};border:${border};box-shadow:0 2px 6px rgba(0,0,0,0.45);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

export default function ResultadosMapaTab({ filtros, onFiltroChange, presentationMode = false }) {
  const { t, i18n } = useTranslation("resultadosMapa");
  const [pontos,       setPontos]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroTipo,   setFiltroTipo]   = useState("todos");
  const [estadosGeo,   setEstadosGeo]   = useState(null);
  const [mapaFull,     setMapaFull]     = useState(false);
  const [painelAberto, setPainelAberto] = useState(false);
  const mapaRef = useRef(null);

  useEffect(() => {
    function onFsChange() { setMapaFull(!!document.fullscreenElement); }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  function toggleMapaFull() {
    if (!document.fullscreenElement) {
      mapaRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  useEffect(() => {
    fetch("/brazil-states.geojson")
      .then(r => r.json())
      .then(setEstadosGeo)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    resultadosApi.clientesMapa({ periodo_dias: filtros.periodo })
      .then(r => setPontos(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filtros.periodo]);

  const pontosFiltrados = useMemo(() =>
    pontos
      .filter(p => p.status !== "cancelada")
      .filter(p => filtroTipo   === "todos" || p.tipo   === filtroTipo)
      .filter(p => filtroStatus === "todos" || p.status === filtroStatus),
    [pontos, filtroTipo, filtroStatus]
  );

  // estadosAtivos derivado dos pontos filtrados (fog-of-war reflete filtro ativo)
  const estadosAtivos = useMemo(
    () => new Set(pontosFiltrados.map(p => p.estado).filter(Boolean)),
    [pontosFiltrados]
  );

  const styleEstado = useCallback((feature) => {
    const uf = feature.properties?.sigla;
    return estadosAtivos.has(uf)
      ? { fillColor: "#f97316", fillOpacity: 0.08, color: "#f97316", weight: 1.5, opacity: 0.7 }
      : { fillColor: "#000000", fillOpacity: 0.58, color: "#374151", weight: 0.4, opacity: 0.5 };
  }, [estadosAtivos]);

  return (
    <div className={presentationMode ? "" : "space-y-4"}>
      {!presentationMode && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider shrink-0">{t("typeFilter.label")}</span>
          {[
            { key: "todos",       label: t("all"),                    count: pontos.length },
            { key: "implantacao", label: t("tipo.implantacao"),  count: pontos.filter(p => p.tipo === "implantacao").length },
            { key: "instalacao",  label: t("tipo.instalacao"),   count: pontos.filter(p => p.tipo === "instalacao").length  },
          ].map(tp => (
            <button key={tp.key} onClick={() => setFiltroTipo(tp.key)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                filtroTipo === tp.key ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {tp.label} ({tp.count})
            </button>
          ))}
        </div>
      )}

      {!presentationMode && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider shrink-0">{t("statusFilter.label")}</span>
          {[
            { key: "todos",        label: t("all"),                     cor: null },
            { key: "concluida",    label: t("status.concluida"),     cor: STATUS_COR.concluida    },
            { key: "em_andamento", label: t("status.em_andamento"),  cor: STATUS_COR.em_andamento },
            { key: "pausada",      label: t("status.pausada"),       cor: STATUS_COR.pausada      },
          ].map(s => (
            <button key={s.key} onClick={() => setFiltroStatus(s.key)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                filtroStatus === s.key ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
              style={filtroStatus === s.key ? { backgroundColor: s.cor ?? "#1f2937" } : {}}
            >
              {s.cor && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.cor }} />}
              {s.label} ({pontos.filter(p => s.key === "todos" || p.status === s.key).length})
            </button>
          ))}
          <span className="ml-auto text-xs text-gray-400">
            {t("visiblePoints", { count: pontosFiltrados.length })}
          </span>
        </div>
      )}

      {!presentationMode && estadosAtivos.size > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider shrink-0">{t("activeStates.label")}</span>
          {[...estadosAtivos].sort().map(uf => (
            <span key={uf} className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-50 text-orange-600 border border-orange-200">
              {uf}
            </span>
          ))}
          <span className="ml-auto text-xs text-gray-400">
            {t("activeStates.ofTotal", { count: estadosAtivos.size })}
          </span>
        </div>
      )}

      <div
        ref={mapaRef}
        className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden relative"
        style={{ height: (mapaFull || presentationMode) ? "100vh" : 520 }}
      >
        {/* Indicador de filtros ativos */}
        {!loading && (filtroTipo !== "todos" || filtroStatus !== "todos" || filtros.periodo !== "365") && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1001] flex items-center gap-1.5 flex-wrap justify-center pointer-events-none">
            {filtroTipo !== "todos" && (
              <span className="px-2.5 py-1 rounded-full text-white text-[11px] font-semibold shadow bg-gray-800">
                {t(`tipoSingular.${filtroTipo}`)}
              </span>
            )}
            {filtroStatus !== "todos" && (
              <span className="px-2.5 py-1 rounded-full text-white text-[11px] font-semibold shadow"
                style={{ backgroundColor: STATUS_COR[filtroStatus] || "#374151" }}>
                {t(`status.${filtroStatus}`)}
              </span>
            )}
            {filtros.periodo !== "365" && (
              <span className="px-2.5 py-1 rounded-full text-white text-[11px] font-semibold shadow bg-gray-700">
                {PERIODO_OPTS.some(p => p.value === filtros.periodo) ? t(`periods.${filtros.periodo}`) : `${filtros.periodo}d`}
              </span>
            )}
          </div>
        )}

        {/* Botões flutuantes */}
        <div className="absolute top-3 right-3 z-[1001] flex items-center gap-1.5">
          <button onClick={() => setPainelAberto(v => !v)} title={t("buttons.filters")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all border ${
              painelAberto
                ? "bg-orange-500 text-white border-orange-500"
                : "bg-white bg-opacity-90 text-gray-600 border-gray-200 hover:bg-opacity-100"
            }`}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            {t("buttons.filters")}
          </button>
          {!presentationMode && (
            <button onClick={toggleMapaFull} title={mapaFull ? t("buttons.exitFullscreen") : t("buttons.expandMap")}
              className="bg-white bg-opacity-90 hover:bg-opacity-100 border border-gray-200 rounded-lg p-1.5 shadow-sm transition-all"
              style={{ lineHeight: 0 }}>
              {mapaFull ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M15 9h4.5M15 9V4.5M9 15v4.5M9 15H4.5M15 15h4.5M15 15v4.5" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                </svg>
              )}
            </button>
          )}
        </div>

        {/* Painel de filtros inline */}
        {painelAberto && (
          <div className="absolute top-12 right-3 z-[1001] bg-gray-900 bg-opacity-95 backdrop-blur-sm rounded-xl shadow-2xl p-4 text-xs" style={{ minWidth: 240 }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t("filterPanel.title")}</span>
              <button onClick={() => setPainelAberto(false)} className="text-gray-500 hover:text-gray-300 text-base leading-none">✕</button>
            </div>
            <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{t("filterPanel.type")}</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {[
                { key: "todos",       label: t("all") },
                { key: "implantacao", label: t("tipo.implantacao") },
                { key: "instalacao",  label: t("tipo.instalacao") },
              ].map(tp => (
                <button key={tp.key} onClick={() => setFiltroTipo(tp.key)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                    filtroTipo === tp.key ? "bg-gray-200 text-gray-900" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}>
                  {tp.label}
                </button>
              ))}
            </div>
            <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{t("filterPanel.status")}</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {[
                { key: "todos",        label: t("all") },
                { key: "concluida",    label: t("status.concluida") },
                { key: "em_andamento", label: t("status.em_andamento") },
                { key: "pausada",      label: t("status.pausada") },
              ].map(s => (
                <button key={s.key} onClick={() => setFiltroStatus(s.key)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                    filtroStatus === s.key ? "bg-gray-200 text-gray-900" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}>
                  {s.label}
                </button>
              ))}
            </div>
            <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{t("filterPanel.period")}</p>
            <div className="flex flex-wrap gap-1.5">
              {PERIODO_OPTS.map(p => (
                <button key={p.value} onClick={() => onFiltroChange?.("periodo", p.value)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                    filtros.periodo === p.value ? "bg-orange-500 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}>
                  {t(`periods.${p.value}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Legenda por status */}
        {!loading && (
          <div className="absolute bottom-8 left-3 z-[1000] bg-gray-900 bg-opacity-85 backdrop-blur-sm rounded-xl shadow-xl p-3 text-xs select-none" style={{ minWidth: 155 }}>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{t("legend.title")}</p>
            <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{t("legend.status")}</p>
            <div className="flex flex-col gap-1.5 mb-3">
              {Object.entries(STATUS_COR).map(([k, cor]) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0 border border-white border-opacity-30" style={{ backgroundColor: cor }} />
                  <span className="text-gray-200">{t(`status.${k}`)}</span>
                </div>
              ))}
            </div>
            <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 mt-1">{t("legend.location")}</p>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ border: "2px solid rgba(255,255,255,0.85)", backgroundColor: "#3b82f6" }} />
              <span className="text-gray-300">{t("legend.exactCoord")}</span>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ border: "2px dashed #f59e0b", backgroundColor: "#3b82f6" }} />
              <span className="text-yellow-400">{t("legend.approxState")}</span>
            </div>
            <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 mt-2">{t("legend.states")}</p>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded shrink-0 border border-orange-400" style={{ backgroundColor: "#f97316", opacity: 0.15 }} />
              <span className="text-gray-300">{t("legend.withOperations")}</span>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="w-3 h-3 rounded shrink-0 border border-gray-600" style={{ backgroundColor: "#000", opacity: 0.8 }} />
              <span className="text-gray-500">{t("legend.withoutOperations")}</span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
          </div>
        ) : (
          <MapContainer
            center={[-14.5, -51.5]}
            zoom={4}
            minZoom={3}
            maxBounds={[[-35, -75], [6, -28]]}
            maxBoundsViscosity={1.0}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom
          >
            <TileLayer
              url={CARTO_DARK_TILE_URL}
              attribution='&copy; <a href="https://carto.com">CARTO</a>'
            />

            {estadosGeo && (
              <GeoJSON
                key={[...estadosAtivos].join(",")}
                data={estadosGeo}
                style={styleEstado}
              />
            )}

            <MarkerClusterGroup chunkedLoading>
              {pontosFiltrados.map(p => (
                <Marker
                  key={p.id}
                  position={[p.lat, p.lng]}
                  icon={createStatusIcon(p.status, p.coordenada_real)}
                >
                  <Tooltip sticky direction="top" offset={[0, -8]}>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>{p.cidade || p.estado}</span>
                    {!p.coordenada_real && <span style={{ fontSize: 10, color: "#f59e0b" }}>{t("tooltip.approx")}</span>}
                  </Tooltip>
                  <Popup minWidth={210}>
                    <div style={{ fontSize: 12, lineHeight: 1.7 }}>
                      <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{p.cliente_nome}</p>
                      <p style={{ color: "#6b7280", marginBottom: 6 }}>{p.cidade} — {p.estado}</p>
                      <p>
                        <span style={{ color: "#9ca3af" }}>{t("popup.type")}</span>
                        <span style={{ fontWeight: 600 }}>{p.tipo ? t(`tipoSingular.${p.tipo}`) : p.tipo}</span>
                      </p>
                      <p>
                        <span style={{ color: "#9ca3af" }}>{t("popup.status")}</span>
                        <span style={{ fontWeight: 600, color: STATUS_COR[p.status] || "#9ca3af" }}>
                          {p.status ? t(`status.${p.status}`) : p.status}
                        </span>
                      </p>
                      {p.consultor && (
                        <p><span style={{ color: "#9ca3af" }}>{t("popup.consultant")}</span>{p.consultor}</p>
                      )}
                      {p.data_prevista && (
                        <p>
                          <span style={{ color: "#9ca3af" }}>{t("popup.expected")}</span>
                          {new Date(p.data_prevista).toLocaleDateString(i18n.language)}
                        </p>
                      )}
                      <p><span style={{ color: "#9ca3af" }}>{t("popup.progress")}</span>{p.progresso ?? 0}%</p>
                      {!p.coordenada_real && (
                        <p style={{ fontSize: 10, color: "#f59e0b", marginTop: 4 }}>
                          {t("popup.approxWarning")}
                        </p>
                      )}
                      <a
                        href={`/clientes/${p.cliente_id}`}
                        style={{ display: "inline-block", marginTop: 8, color: "#3b82f6", fontSize: 11, fontWeight: 600, textDecoration: "none" }}
                      >
                        {t("popup.viewClient")}
                      </a>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MarkerClusterGroup>
          </MapContainer>
        )}
      </div>

      {!presentationMode && (
        <p className="text-[11px] text-gray-400 text-center">
          {t("footnote")}
        </p>
      )}
    </div>
  );
}

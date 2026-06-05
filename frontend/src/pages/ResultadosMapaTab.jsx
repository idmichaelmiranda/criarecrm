import { useState, useEffect, useCallback, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { resultadosApi } from "../services/api";

// Cor = tipo (identidade visual no mapa)
const TIPO_COR   = { implantacao: "#3b82f6", instalacao: "#10b981" };
const TIPO_LABEL = { implantacao: "Implantação", instalacao: "Instalação" };

// Status = opacidade (intensidade do ponto)
const STATUS_OPACITY = { concluida: 1.0, em_andamento: 0.65, pausada: 0.45, cancelada: 0.25 };
const STATUS_LABEL   = { concluida: "Concluída", em_andamento: "Em andamento", pausada: "Pausada", cancelada: "Cancelada" };
const STATUS_COR_TEXTO = { concluida: "#10b981", em_andamento: "#3b82f6", pausada: "#f59e0b", cancelada: "#9ca3af" };

export default function ResultadosMapaTab({ filtros }) {
  const [pontos,        setPontos]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [filtroStatus,  setFiltroStatus]  = useState("todos");
  const [filtroTipo,    setFiltroTipo]    = useState("todos");
  const [estadosGeo,    setEstadosGeo]    = useState(null);
  const [mapaFull,      setMapaFull]      = useState(false);
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

  const pontosFiltrados = pontos
    .filter(p => filtroTipo   === "todos" || p.tipo   === filtroTipo)
    .filter(p => filtroStatus === "todos" || p.status === filtroStatus);

  const visiveis = pontosFiltrados;

  // Estados que têm ao menos 1 ponto (todos os pontos, não só os filtrados)
  const estadosAtivos = new Set(pontos.map(p => p.estado).filter(Boolean));

  const legendas = [
    { status: "concluida",    label: "Concluída" },
    { status: "em_andamento", label: "Em andamento" },
    { status: "pausada",      label: "Pausada" },
    { status: "cancelada",    label: "Cancelada" },
  ];

  const styleEstado = useCallback((feature) => {
    const uf = feature.properties?.sigla;
    const desbloqueado = estadosAtivos.has(uf);
    return desbloqueado
      ? { fillColor: "#f97316", fillOpacity: 0.08, color: "#f97316", weight: 1.5, opacity: 0.7 }
      : { fillColor: "#000000", fillOpacity: 0.58, color: "#374151", weight: 0.4, opacity: 0.5 };
  }, [estadosAtivos]);

  return (
    <div className="space-y-4">
      {/* Filtro por tipo — cor identifica o tipo no mapa */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider shrink-0">Tipo:</span>
        {[
          { key: "todos",       label: "Todos",         count: pontos.length,                                          cor: null },
          { key: "implantacao", label: "Implantações",  count: pontos.filter(p => p.tipo === "implantacao").length,    cor: TIPO_COR.implantacao },
          { key: "instalacao",  label: "Instalações",   count: pontos.filter(p => p.tipo === "instalacao").length,     cor: TIPO_COR.instalacao  },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setFiltroTipo(t.key)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              filtroTipo === t.key ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
            style={filtroTipo === t.key ? { backgroundColor: t.cor ?? "#1f2937" } : {}}
          >
            {t.cor && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.cor }} />}
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* Filtro de status */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider shrink-0">Status:</span>
        <button
          onClick={() => setFiltroStatus("todos")}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
            filtroStatus === "todos" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Todos ({pontosFiltrados.length})
        </button>
        {legendas.map(l => (
          <button
            key={l.status}
            onClick={() => setFiltroStatus(l.status)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              filtroStatus === l.status ? "bg-gray-800 text-white" : "text-gray-600 bg-gray-100 hover:bg-gray-200"
            }`}
          >
            {l.label} ({pontosFiltrados.filter(p => p.status === l.status).length})
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400">
          {visiveis.length} ponto{visiveis.length !== 1 ? "s" : ""} visível{visiveis.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Legenda dos estados */}
      {estadosAtivos.size > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider shrink-0">Estados ativos:</span>
          {[...estadosAtivos].sort().map(uf => (
            <span key={uf} className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-50 text-orange-600 border border-orange-200">
              {uf}
            </span>
          ))}
          <span className="ml-auto text-xs text-gray-400">
            {estadosAtivos.size} de 27 estados desbloqueados
          </span>
        </div>
      )}

      {/* Mapa */}
      <div
        ref={mapaRef}
        className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden relative"
        style={{ height: mapaFull ? "100vh" : 520 }}
      >
        {/* Botão fullscreen do mapa */}
        <button
          onClick={toggleMapaFull}
          title={mapaFull ? "Sair da tela cheia" : "Expandir mapa"}
          className="absolute top-3 right-3 z-[1000] bg-white bg-opacity-90 hover:bg-opacity-100 border border-gray-200 rounded-lg p-1.5 shadow-sm transition-all"
          style={{ lineHeight: 0 }}
        >
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
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com">CARTO</a>'
            />

            {/* Fog of war — estados bloqueados/desbloqueados */}
            {estadosGeo && (
              <GeoJSON
                key={[...estadosAtivos].join(",")}
                data={estadosGeo}
                style={styleEstado}
              />
            )}

            {/* Marcadores dos clientes */}
            {visiveis.map(p => (
              <CircleMarker
                key={p.id}
                center={[p.lat, p.lng]}
                radius={9}
                fillColor={TIPO_COR[p.tipo] || "#9ca3af"}
                fillOpacity={STATUS_OPACITY[p.status] ?? 0.8}
                color="#fff"
                weight={1.5}
              >
                {/* Cidade sempre visível no hover */}
                <Tooltip sticky direction="top" offset={[0, -6]}>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>{p.cidade || p.estado}</span>
                </Tooltip>

                {/* Card completo no clique */}
                <Popup minWidth={200}>
                  <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                    <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{p.cliente_nome}</p>
                    <p style={{ color: "#6b7280", marginBottom: 6 }}>{p.cidade} — {p.estado}</p>
                    <p>
                      <span style={{ color: "#9ca3af" }}>Tipo: </span>
                      <span style={{ fontWeight: 600 }}>{TIPO_LABEL[p.tipo] || p.tipo || "—"}</span>
                    </p>
                    <p>
                      <span style={{ color: "#9ca3af" }}>Status: </span>
                      <span style={{ fontWeight: 600, color: STATUS_COR_TEXTO[p.status] }}>
                        {STATUS_LABEL[p.status] || p.status}
                      </span>
                    </p>
                    {p.consultor && (
                      <p><span style={{ color: "#9ca3af" }}>Consultor: </span>{p.consultor}</p>
                    )}
                    {p.data_prevista && (
                      <p>
                        <span style={{ color: "#9ca3af" }}>Prevista: </span>
                        {new Date(p.data_prevista).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                    <p><span style={{ color: "#9ca3af" }}>Progresso: </span>{p.progresso}%</p>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        )}
      </div>

      <p className="text-[11px] text-gray-400 text-center">
        * Coordenadas aproximadas baseadas no estado do cliente. Estados desbloqueados conforme operações ativas.
      </p>
    </div>
  );
}

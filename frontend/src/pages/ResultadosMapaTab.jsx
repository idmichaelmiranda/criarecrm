import { useState, useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { resultadosApi } from "../services/api";

const STATUS_COR = {
  concluida:    "#10b981",
  em_andamento: "#3b82f6",
  pausada:      "#f59e0b",
  cancelada:    "#9ca3af",
};
const STATUS_LABEL = {
  concluida:    "Concluída",
  em_andamento: "Em andamento",
  pausada:      "Pausada",
  cancelada:    "Cancelada",
};

function ZoomWatcher({ onZoom }) {
  useMapEvents({ zoomend: (e) => onZoom(e.target.getZoom()) });
  return null;
}

const TIPO_LABEL = { implantacao: "Implantação", instalacao: "Instalação" };

export default function ResultadosMapaTab({ filtros }) {
  const [pontos,       setPontos]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [zoom,         setZoom]         = useState(4);

  useEffect(() => {
    setLoading(true);
    resultadosApi.clientesMapa({ periodo_dias: filtros.periodo })
      .then(r => setPontos(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filtros.periodo]);

  const visiveis = filtroStatus === "todos"
    ? pontos
    : pontos.filter(p => p.status === filtroStatus);

  const legendas = [
    { status: "concluida",    label: "Concluída" },
    { status: "em_andamento", label: "Em andamento" },
    { status: "pausada",      label: "Pausada" },
    { status: "cancelada",    label: "Cancelada" },
  ];

  return (
    <div className="space-y-4">
      {/* Filtro de status */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider shrink-0">Status:</span>
        <button
          onClick={() => setFiltroStatus("todos")}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
            filtroStatus === "todos" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Todos ({pontos.length})
        </button>
        {legendas.map(l => (
          <button
            key={l.status}
            onClick={() => setFiltroStatus(l.status)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              filtroStatus === l.status ? "text-white" : "text-gray-600 bg-gray-100 hover:bg-gray-200"
            }`}
            style={filtroStatus === l.status ? { backgroundColor: STATUS_COR[l.status] } : {}}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_COR[l.status] }} />
            {l.label} ({pontos.filter(p => p.status === l.status).length})
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400">
          {visiveis.length} ponto{visiveis.length !== 1 ? "s" : ""} visível{visiveis.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Mapa */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" style={{ height: 520 }}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
          </div>
        ) : (
          <MapContainer
            center={[-14.5, -51.5]}
            zoom={4}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com">CARTO</a>'
            />
            <ZoomWatcher onZoom={setZoom} />
            {visiveis.map(p => (
              <CircleMarker
                key={p.id}
                center={[p.lat, p.lng]}
                radius={9}
                fillColor={STATUS_COR[p.status] || "#9ca3af"}
                fillOpacity={0.88}
                color="#fff"
                weight={1.5}
              >
                {zoom >= 7 ? (
                  <Tooltip permanent direction="top" offset={[0, -10]}>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>{p.cidade}</span>
                  </Tooltip>
                ) : (
                  <Tooltip sticky>
                    <div style={{ minWidth: 180, fontSize: 12 }}>
                      <p style={{ fontWeight: 700, marginBottom: 4 }}>{p.cliente_nome}</p>
                      <p style={{ color: "#6b7280", marginBottom: 6 }}>{p.cidade} — {p.estado}</p>
                      <p>
                        <span style={{ color: "#9ca3af" }}>Tipo: </span>
                        <span style={{ fontWeight: 600 }}>{TIPO_LABEL[p.tipo] || p.tipo}</span>
                      </p>
                      <p>
                        <span style={{ color: "#9ca3af" }}>Status: </span>
                        <span style={{ fontWeight: 600, color: STATUS_COR[p.status] }}>
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
                  </Tooltip>
                )}
              </CircleMarker>
            ))}
          </MapContainer>
        )}
      </div>

      <p className="text-[11px] text-gray-400 text-center">
        * Coordenadas aproximadas baseadas no estado do cliente.
      </p>
    </div>
  );
}

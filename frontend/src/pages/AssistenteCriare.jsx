import { useState, useEffect, useCallback, useRef } from "react";
import { Layout } from "../components/layout/Layout";
import { solicitacoesInstaladorApi } from "../services/api";
import { fmtDateTime, timeAgoFromUTC, parseUTC } from "../utils/dateUtils";

const POLL_MS = 5000;

function formatCnpj(digits) {
  if (!digits || digits.length !== 14) return digits || "—";
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

function StatusBadge({ status }) {
  const map = {
    pendente: "bg-amber-50 text-amber-700 border-amber-200",
    aprovada: "bg-green-50 text-green-700 border-green-200",
    recusada: "bg-red-50 text-red-700 border-red-200",
    expirada: "bg-gray-100 text-gray-500 border-gray-200",
    cancelada: "bg-gray-100 text-gray-500 border-gray-200",
  };
  const label = { pendente: "Pendente", aprovada: "Aprovada", recusada: "Recusada", expirada: "Expirada", cancelada: "Cancelada pelo técnico" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${map[status] || map.expirada}`}>
      {status === "pendente" && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
      {label[status] || status}
    </span>
  );
}

function SolicitacaoRow({ sol, onAprovar, onRecusar, acting }) {
  const isPendente = sol.status === "pendente";
  return (
    <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">
          {sol.clienteNome || <span className="text-gray-400 italic font-normal">CNPJ novo, sem cadastro</span>}
        </p>
        <p className="text-xs text-gray-400 mt-0.5 font-mono">{formatCnpj(sol.cnpj)}</p>
      </div>
      <div className="w-32 shrink-0 hidden sm:block text-xs text-gray-500">
        criada {timeAgoFromUTC(sol.criadoEm)}
      </div>
      <div className="w-36 shrink-0 hidden md:block text-xs text-gray-500">
        {isPendente ? `expira ${timeAgoFromUTC(sol.expiraEm)}` : fmtDateTime(sol.aprovadoEm || sol.recusadoEm || sol.canceladoEm || sol.expiraEm)}
      </div>
      <div className="w-24 shrink-0">
        <StatusBadge status={sol.status} />
      </div>
      <div className="flex items-center gap-2 shrink-0 w-52 justify-end">
        {isPendente && (
          <>
            <button onClick={() => onRecusar(sol)} disabled={acting}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 transition-colors disabled:opacity-50">
              Recusar
            </button>
            <button onClick={() => onAprovar(sol)} disabled={acting}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-50 shadow-sm">
              Aprovar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function AssistenteCriare() {
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [tab, setTab]                   = useState("pendentes");
  const [actingId, setActingId]         = useState(null);
  const [toast, setToast]               = useState(null);
  const timerRef = useRef(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await solicitacoesInstaladorApi.listar();
      setSolicitacoes(data);
    } catch {
      if (!silent) setToast({ type: "error", text: "Erro ao carregar solicitações." });
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    timerRef.current = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(timerRef.current);
  }, [load]);

  async function handleAprovar(sol) {
    setActingId(sol.id);
    try {
      await solicitacoesInstaladorApi.aprovar(sol.id);
      setToast({ type: "success", text: `Instalação aprovada para ${sol.clienteNome || formatCnpj(sol.cnpj)}.` });
      await load(true);
    } catch (err) {
      setToast({ type: "error", text: err.message || "Erro ao aprovar." });
    } finally {
      setActingId(null);
      setTimeout(() => setToast(null), 5000);
    }
  }

  async function handleRecusar(sol) {
    setActingId(sol.id);
    try {
      await solicitacoesInstaladorApi.recusar(sol.id);
      setToast({ type: "info", text: `Solicitação de ${sol.clienteNome || formatCnpj(sol.cnpj)} recusada.` });
      await load(true);
    } catch (err) {
      setToast({ type: "error", text: err.message || "Erro ao recusar." });
    } finally {
      setActingId(null);
      setTimeout(() => setToast(null), 5000);
    }
  }

  const pendentes = solicitacoes.filter((s) => s.status === "pendente")
    .sort((a, b) => parseUTC(a.expiraEm) - parseUTC(b.expiraEm));
  const historico = solicitacoes.filter((s) => s.status !== "pendente");
  const lista = tab === "pendentes" ? pendentes : historico;

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assistente Criare</h1>
          <p className="text-sm text-gray-500 mt-0.5">Aprovação de instalações solicitadas pelo instalador do ERP</p>
        </div>
        {pendentes.length > 0 && (
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            {pendentes.length} aguardando resposta
          </div>
        )}
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4 w-fit">
        <button onClick={() => setTab("pendentes")}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === "pendentes" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          Pendentes
          {pendentes.length > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold">
              {pendentes.length}
            </span>
          )}
        </button>
        <button onClick={() => setTab("historico")}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === "historico" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          Histórico
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
          </div>
        ) : lista.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-700">
              {tab === "pendentes" ? "Nenhuma solicitação pendente" : "Nenhum histórico ainda"}
            </p>
          </div>
        ) : (
          <div>
            {lista.map((sol) => (
              <SolicitacaoRow key={sol.id} sol={sol} onAprovar={handleAprovar} onRecusar={handleRecusar} acting={actingId === sol.id} />
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-sm font-medium border ${
          toast.type === "success" ? "bg-white border-green-200 text-green-800"
          : toast.type === "error" ? "bg-white border-red-200 text-red-800"
          : "bg-white border-gray-200 text-gray-700"
        }`}>
          {toast.text}
        </div>
      )}
    </Layout>
  );
}

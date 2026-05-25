import { useState, useEffect, useCallback } from "react";
import { clientesApi } from "../services/api";

export function useClientes() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchClientes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await clientesApi.listar();
      setClientes(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  return { clientes, loading, error, refetch: fetchClientes };
}

export function useImplantacaoStats() {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import("../services/api").then(({ implantacoesApi }) => {
      implantacoesApi
        .stats()
        .then(({ data }) => setStats(data))
        .catch(() => setStats({}))
        .finally(() => setLoading(false));
    });
  }, []);

  return { stats, loading };
}

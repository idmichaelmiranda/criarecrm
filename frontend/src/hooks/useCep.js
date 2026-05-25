import { useState } from "react";

export function useCep() {
  const [loading, setLoading] = useState(false);

  async function fetchCep(rawCep, setValue, fields) {
    const digits = rawCep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        if (fields.logradouro) setValue(fields.logradouro, data.logradouro || "");
        if (fields.bairro) setValue(fields.bairro, data.bairro || "");
        if (fields.cidade) setValue(fields.cidade, data.localidade || "");
        if (fields.estado) setValue(fields.estado, data.uf || "");
      }
    } catch {}
    finally { setLoading(false); }
  }

  return { fetchCep, loading };
}

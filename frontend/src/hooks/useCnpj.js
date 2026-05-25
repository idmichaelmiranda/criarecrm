import { useState } from "react";

function formatPhone(raw) {
  const d = (raw || "").replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
}

function formatCep(raw) {
  const d = (raw || "").replace(/\D/g, "");
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : raw;
}

export function useCnpj() {
  const [status, setStatus] = useState("idle"); // idle | loading | found | not_found

  async function fetchCnpj(rawCnpj, setValue) {
    const digits = rawCnpj.replace(/\D/g, "");
    if (digits.length !== 14) {
      setStatus("idle");
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) { setStatus("not_found"); return; }
      const d = await res.json();

      if (d.razao_social)    setValue("razao_social",   d.razao_social);
      if (d.nome_fantasia)   setValue("nome_fantasia",  d.nome_fantasia);
      if (d.email)           setValue("email",          d.email);
      if (d.ddd_telefone_1)  setValue("telefone_fixo",  formatPhone(d.ddd_telefone_1));
      if (d.logradouro)      setValue("endereco",       d.logradouro);
      if (d.numero)          setValue("numero",         d.numero);
      if (d.bairro)          setValue("bairro",         d.bairro);
      if (d.municipio)       setValue("cidade",         d.municipio);
      if (d.uf)              setValue("estado",         d.uf);
      if (d.cep)             setValue("cep",            formatCep(d.cep));

      setStatus("found");
    } catch {
      setStatus("not_found");
    }
  }

  return { fetchCnpj, status };
}

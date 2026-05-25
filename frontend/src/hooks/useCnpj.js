import { useState } from "react";

export function validateCnpj(raw) {
  const d = (raw || "").replace(/\D/g, "");
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false; // todos dígitos iguais
  const calc = (n) => {
    let s = 0, p = n + 1;
    for (let i = 0; i < n; i++) { s += parseInt(d[i]) * (p - i > 1 ? p - i : p - i + n); }
    // use standard weights
    return s;
  };
  const w = (offset) => {
    let s = 0;
    const weights = offset === 0 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    for (let i = 0; i < weights.length; i++) s += parseInt(d[i]) * weights[i];
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return w(0) === parseInt(d[12]) && w(1) === parseInt(d[13]);
}

export function maskCnpj(raw) {
  const d = (raw || "").replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2)  return d;
  if (d.length <= 5)  return `${d.slice(0,2)}.${d.slice(2)}`;
  if (d.length <= 8)  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}

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

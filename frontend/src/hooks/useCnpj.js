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

export function maskPhone(raw) {
  const d = (raw || "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2)  return d.length ? `(${d}` : "";
  if (d.length <= 6)  return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}

export function maskCpf(raw) {
  const d = (raw || "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3)  return d;
  if (d.length <= 6)  return `${d.slice(0,3)}.${d.slice(3)}`;
  if (d.length <= 9)  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
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

const LOOKUP_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// BrasilAPI espelha a base da Receita Federal, mas com atraso de indexação —
// CNPJs abertos há poucos dias costumam não aparecer lá ainda. ReceitaWS entra
// como segunda fonte antes de desistir e mostrar "não encontrado" pro usuário.
async function lookupBrasilApi(digits) {
  const res = await fetchWithTimeout(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
  if (!res.ok) return null;
  const d = await res.json();
  return {
    razao_social:  d.razao_social,
    nome_fantasia: d.nome_fantasia,
    email:         d.email,
    telefone_fixo: d.ddd_telefone_1 ? formatPhone(d.ddd_telefone_1) : undefined,
    endereco:      d.logradouro,
    numero:        d.numero,
    bairro:        d.bairro,
    cidade:        d.municipio,
    estado:        d.uf,
    cep:           d.cep ? formatCep(String(d.cep)) : undefined,
  };
}

async function lookupReceitaWs(digits) {
  const res = await fetchWithTimeout(`https://receitaws.com.br/v1/cnpj/${digits}`);
  if (!res.ok) return null;
  const d = await res.json();
  if (d.status === "ERROR") return null;
  return {
    razao_social:  d.nome,
    nome_fantasia: d.fantasia,
    email:         d.email,
    telefone_fixo: d.telefone,
    endereco:      d.logradouro,
    numero:        d.numero,
    bairro:        d.bairro,
    cidade:        d.municipio,
    estado:        d.uf,
    cep:           d.cep ? formatCep(d.cep) : undefined,
  };
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

    let d = null;
    for (const lookup of [lookupBrasilApi, lookupReceitaWs]) {
      try {
        d = await lookup(digits);
      } catch {
        d = null;
      }
      if (d) break;
    }

    if (!d) { setStatus("not_found"); return; }

    if (d.razao_social)  setValue("razao_social",  d.razao_social);
    if (d.nome_fantasia) setValue("nome_fantasia", d.nome_fantasia);
    if (d.email)         setValue("email",         d.email);
    if (d.telefone_fixo) setValue("telefone_fixo", d.telefone_fixo);
    if (d.endereco)      setValue("endereco",      d.endereco);
    if (d.numero)        setValue("numero",        d.numero);
    if (d.bairro)        setValue("bairro",        d.bairro);
    if (d.cidade)        setValue("cidade",        d.cidade);
    if (d.estado)        setValue("estado",        d.estado);
    if (d.cep)           setValue("cep",           d.cep);

    setStatus("found");
  }

  return { fetchCnpj, status };
}

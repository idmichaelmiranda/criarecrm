import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ptBR from "./locales/pt-BR";
import en from "./locales/en";
import es from "./locales/es";

export const SUPPORTED_LANGUAGES = ["pt-BR", "en", "es"];
const STORAGE_KEY = "crm_lang";

const savedLang = localStorage.getItem(STORAGE_KEY);
const initialLang = SUPPORTED_LANGUAGES.includes(savedLang) ? savedLang : "pt-BR";

i18n.use(initReactI18next).init({
  resources: { "pt-BR": ptBR, en, es },
  lng: initialLang,
  fallbackLng: "pt-BR",
  ns: [
    "common", "assistenteCriare", "badge", "bdRestore", "clienteDetalhe", "clientes",
    "configuracoes", "dashboard", "definirSenha", "gruposPermissao", "implantacaoDetalhe",
    "implantacoes", "instalacaoDetalhe", "instalacoes", "landing", "login", "registro",
    "resultados", "resultadosMapa", "revisao", "sidebar", "solicitar", "templateEditor",
    "templates", "triagem", "usuarios",
  ],
  defaultNS: "common",
  interpolation: { escapeValue: false },
});

document.documentElement.lang = initialLang;

i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
  localStorage.setItem(STORAGE_KEY, lng);
});

export default i18n;

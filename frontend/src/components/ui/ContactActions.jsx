// Botões de ação de contato (WhatsApp / Ligar) reaproveitados nas telas de
// Instalação e Triagem. Ligar usa o link tel:, que o Windows direciona pro
// app configurado como padrão para chamadas (ex. MicroSIP).

export function WhatsAppButton({ telefone, title = "Abrir no WhatsApp", className = "" }) {
  const digits = (telefone || "").replace(/\D/g, "");
  if (!digits) return null;
  return (
    <a
      href={`https://wa.me/55${digits}`}
      target="_blank" rel="noopener noreferrer"
      title={title}
      onClick={(e) => e.stopPropagation()}
      className={`w-5 h-5 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center text-white transition-colors shrink-0 ${className}`}
    >
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.45 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.46 0 9.9-4.44 9.9-9.9 0-2.64-1.03-5.13-2.9-7-1.86-1.87-4.35-2.9-6.99-2.9zm5.8 14.16c-.24.68-1.4 1.29-1.93 1.37-.5.08-1.11.11-1.8-.11-.42-.13-.95-.31-1.64-.61-2.88-1.24-4.76-4.15-4.9-4.34-.14-.19-1.17-1.56-1.17-2.98s.74-2.11 1.01-2.4c.27-.28.58-.35.78-.35s.39 0 .56.01c.18.01.42-.07.65.5.24.58.83 2 .9 2.15.07.14.12.32.02.5-.09.19-.14.31-.28.48-.14.16-.29.36-.42.49-.14.14-.28.28-.12.56.16.27.71 1.17 1.53 1.9 1.05.93 1.94 1.22 2.21 1.36.28.14.44.12.6-.07.16-.19.68-.79.87-1.06.18-.28.36-.23.6-.14.24.1 1.53.72 1.79.85.26.14.44.2.5.31.07.11.07.63-.17 1.3z"/>
      </svg>
    </a>
  );
}

export function CallButton({ telefone, title = "Ligar (MicroSIP)", className = "" }) {
  const digits = (telefone || "").replace(/\D/g, "");
  if (!digits) return null;
  return (
    <a
      href={`tel:+55${digits}`}
      title={title}
      onClick={(e) => e.stopPropagation()}
      className={`w-5 h-5 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white transition-colors shrink-0 ${className}`}
    >
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
        <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.36 11.36 0 003.57.57 1 1 0 011 1V20a1 1 0 01-1 1C10.61 21 3 13.39 3 4a1 1 0 011-1h3.5a1 1 0 011 1 11.36 11.36 0 00.57 3.57 1 1 0 01-.25 1.01l-2.2 2.21z"/>
      </svg>
    </a>
  );
}

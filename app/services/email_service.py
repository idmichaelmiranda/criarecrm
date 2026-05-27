import smtplib
import ssl
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

_EMAIL_CONFIG_PATH = "configs/email_config.json"


def get_config() -> dict | None:
    from app.services import storage_service as storage
    return storage.get_json_sync(_EMAIL_CONFIG_PATH)


def save_config(data: dict) -> None:
    from app.services import storage_service as storage
    storage.put_json_sync(_EMAIL_CONFIG_PATH, data)


def _smtp_send(cfg: dict, to_email: str, msg: MIMEMultipart) -> None:
    port = int(cfg.get("port", 587))
    use_tls = cfg.get("use_tls", True)
    host = cfg["host"]
    user = cfg["user"]
    password = cfg["password"]

    if port == 465:
        ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL(host, port, context=ctx, timeout=20) as server:
            server.login(user, password)
            server.sendmail(msg["From"], [to_email], msg.as_string())
    else:
        with smtplib.SMTP(host, port, timeout=20) as server:
            server.ehlo()
            if use_tls:
                server.starttls(context=ssl.create_default_context())
                server.ehlo()
            server.login(user, password)
            server.sendmail(msg["From"], [to_email], msg.as_string())


def _send_email(to_email: str, subject: str, html: str) -> None:
    """Route to Resend (when RESEND_API_KEY is set) or SMTP."""
    from app.config import RESEND_API_KEY

    cfg = get_config()
    _cfg = cfg or {}
    from_name = _cfg.get("from_name") or "CriareCRM"
    from_email = _cfg.get("from_email") or _cfg.get("user") or "noreply@criare.com.br"
    from_addr = f"{from_name} <{from_email}>"

    if RESEND_API_KEY:
        import httpx
        try:
            resp = httpx.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
                json={"from": from_addr, "to": [to_email], "subject": subject, "html": html},
                timeout=20,
            )
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise ValueError(f"Resend recusou o email ({exc.response.status_code}): {exc.response.text}")
        except Exception as exc:
            raise ValueError(f"Erro ao enviar email via Resend: {exc}")
        return

    # SMTP fallback
    if not cfg or not cfg.get("host") or not cfg.get("user"):
        raise ValueError("Configuração de email incompleta. Acesse Configurações > Email.")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_email
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        _smtp_send(cfg, to_email, msg)
    except smtplib.SMTPAuthenticationError:
        raise ValueError("Falha na autenticação SMTP. Verifique usuário e senha.")
    except (smtplib.SMTPConnectError, OSError) as exc:
        raise ValueError(
            f"Não foi possível conectar ao servidor {cfg['host']}:{cfg.get('port', 587)}. {exc}"
        )
    except Exception as exc:
        raise ValueError(f"Erro ao enviar email: {exc}")


# ── Revisão ───────────────────────────────────────────────────────────────────

def send_revisao_email(to_email: str, razao_social: str, motivo: str, link: str) -> None:
    _send_email(
        to_email,
        "Sua solicitação precisa de ajustes — CriareCRM",
        _build_html(razao_social, motivo, link),
    )


def send_revisao_email_async(to_email: str, razao_social: str, motivo: str, link: str) -> None:
    def _run():
        try:
            send_revisao_email(to_email, razao_social, motivo, link)
            print(f"[EMAIL] Revisão enviada para {to_email}")
        except Exception as exc:
            print(f"[EMAIL] Falha ao enviar revisão para {to_email}: {exc}")
    threading.Thread(target=_run, daemon=True).start()


# ── Boas-vindas ───────────────────────────────────────────────────────────────

def send_boas_vindas_email(to_email: str, nome: str, link: str) -> None:
    _send_email(
        to_email,
        "Seu acesso foi aprovado — CriareCRM",
        _build_boas_vindas_html(nome, link),
    )


def send_boas_vindas_email_async(to_email: str, nome: str, link: str) -> None:
    def _run():
        try:
            send_boas_vindas_email(to_email, nome, link)
            print(f"[EMAIL] Boas-vindas enviado para {to_email}")
        except Exception as exc:
            print(f"[EMAIL] Falha ao enviar boas-vindas para {to_email}: {exc}")
    threading.Thread(target=_run, daemon=True).start()


# ── Triagem ───────────────────────────────────────────────────────────────────

def send_triagem_email(to_email: str, razao_social: str) -> None:
    _send_email(
        to_email,
        "Sua solicitação está em análise — CriareCRM",
        _build_triagem_html(razao_social),
    )


def send_triagem_email_async(to_email: str, razao_social: str) -> None:
    def _run():
        try:
            send_triagem_email(to_email, razao_social)
            print(f"[EMAIL] Triagem enviada para {to_email}")
        except Exception as exc:
            print(f"[EMAIL] Falha ao enviar triagem para {to_email}: {exc}")
    threading.Thread(target=_run, daemon=True).start()


# ── Aprovação ─────────────────────────────────────────────────────────────────

def send_aprovacao_email(to_email: str, razao_social: str, codigo: str) -> None:
    _send_email(
        to_email,
        "Sua solicitação foi aprovada! — CriareCRM",
        _build_aprovacao_html(razao_social, codigo),
    )


def send_aprovacao_email_async(to_email: str, razao_social: str, codigo: str) -> None:
    def _run():
        try:
            send_aprovacao_email(to_email, razao_social, codigo)
            print(f"[EMAIL] Aprovação enviada para {to_email}")
        except Exception as exc:
            print(f"[EMAIL] Falha ao enviar aprovação para {to_email}: {exc}")
    threading.Thread(target=_run, daemon=True).start()


# ── HTML builders ─────────────────────────────────────────────────────────────

def _build_html(razao_social: str, motivo: str, link: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Revisão de solicitação</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 16px;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0"
  style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,.08);">
  <!-- Header -->
  <tr><td style="background:#F56316;padding:30px 40px;text-align:center;">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:-.3px;">CriareCRM</h1>
    <p style="margin:6px 0 0;color:rgba(255,255,255,.8);font-size:13px;">Plataforma Operacional de Implantações</p>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:36px 40px;">
    <h2 style="margin:0 0 10px;font-size:20px;color:#111827;font-weight:700;">Sua solicitação precisa de ajustes</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.65;">
      Olá, <strong style="color:#111827;">{razao_social}</strong>. Nossa equipe analisou sua
      solicitação e identificou informações que precisam ser corrigidas antes de prosseguirmos.
    </p>
    <!-- Motivo box -->
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px 20px;margin-bottom:28px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#ef4444;text-transform:uppercase;letter-spacing:.08em;">
        Motivo da recusa
      </p>
      <p style="margin:0;font-size:14px;color:#991b1b;line-height:1.65;">{motivo}</p>
    </div>
    <p style="margin:0 0 28px;font-size:14px;color:#374151;line-height:1.65;">
      Clique no botão abaixo para abrir seu formulário já preenchido com os dados anteriores.
      Corrija os campos indicados e envie novamente — nossa equipe será notificada automaticamente.
    </p>
    <!-- CTA -->
    <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr><td style="background:#F56316;border-radius:10px;">
        <a href="{link}"
          style="display:inline-block;padding:14px 32px;color:#fff;font-size:15px;font-weight:700;
                 text-decoration:none;letter-spacing:-.2px;">
          Corrigir minha solicitação →
        </a>
      </td></tr>
    </table>
    <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
      Este link é válido por <strong>7 dias</strong>. Se o botão não funcionar, copie e cole
      este endereço no navegador:<br>
      <span style="color:#F56316;word-break:break-all;">{link}</span>
    </p>
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#f9fafb;border-top:1px solid #f3f4f6;padding:18px 40px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#9ca3af;">
      Mensagem enviada automaticamente pelo CriareCRM. Não responda a este email.
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>"""


def _build_triagem_html(razao_social: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Solicitação em análise</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 16px;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0"
  style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,.08);">
  <tr><td style="background:#F56316;padding:30px 40px;text-align:center;">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:-.3px;">CriareCRM</h1>
    <p style="margin:6px 0 0;color:rgba(255,255,255,.8);font-size:13px;">Plataforma Operacional de Implantações</p>
  </td></tr>
  <tr><td style="padding:36px 40px;">
    <h2 style="margin:0 0 10px;font-size:20px;color:#111827;font-weight:700;">Sua solicitação está em análise 🔍</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.65;">
      Olá, <strong style="color:#111827;">{razao_social}</strong>. Nossa equipe recebeu sua solicitação
      e já iniciou o processo de triagem.
    </p>
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px 20px;margin-bottom:28px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#d97706;text-transform:uppercase;letter-spacing:.08em;">
        O que acontece agora?
      </p>
      <p style="margin:0;font-size:14px;color:#92400e;line-height:1.65;">
        Nossos analistas irão verificar todas as informações enviadas. Em breve você receberá uma
        nova notificação com o resultado da análise — aprovação ou solicitação de ajustes.
      </p>
    </div>
    <p style="margin:0;font-size:14px;color:#374151;line-height:1.65;">
      Caso tenha dúvidas ou precise atualizar alguma informação, entre em contato com nossa equipe.
    </p>
  </td></tr>
  <tr><td style="background:#f9fafb;border-top:1px solid #f3f4f6;padding:18px 40px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#9ca3af;">
      Mensagem enviada automaticamente pelo CriareCRM. Não responda a este email.
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>"""


def _build_aprovacao_html(razao_social: str, codigo: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Solicitação aprovada</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 16px;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0"
  style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,.08);">
  <tr><td style="background:#F56316;padding:30px 40px;text-align:center;">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:-.3px;">CriareCRM</h1>
    <p style="margin:6px 0 0;color:rgba(255,255,255,.8);font-size:13px;">Plataforma Operacional de Implantações</p>
  </td></tr>
  <tr><td style="padding:36px 40px;">
    <h2 style="margin:0 0 10px;font-size:20px;color:#111827;font-weight:700;">Sua solicitação foi aprovada! 🎉</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.65;">
      Olá, <strong style="color:#111827;">{razao_social}</strong>. Ótimas notícias! Nossa equipe concluiu
      a análise e sua solicitação de implantação foi <strong style="color:#059669;">aprovada</strong>.
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 20px;margin-bottom:28px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:.08em;">
        Código da implantação
      </p>
      <p style="margin:0;font-size:22px;font-weight:700;color:#065f46;letter-spacing:.05em;">{codigo}</p>
    </div>
    <p style="margin:0;font-size:14px;color:#374151;line-height:1.65;">
      Nossa equipe entrará em contato em breve para agendar o início do processo de implantação
      e orientar sobre os próximos passos. Guarde o código acima para referência.
    </p>
  </td></tr>
  <tr><td style="background:#f9fafb;border-top:1px solid #f3f4f6;padding:18px 40px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#9ca3af;">
      Mensagem enviada automaticamente pelo CriareCRM. Não responda a este email.
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>"""


def _build_boas_vindas_html(nome: str, link: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Acesso aprovado</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 16px;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0"
  style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,.08);">
  <tr><td style="background:#F56316;padding:30px 40px;text-align:center;">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:-.3px;">CriareCRM</h1>
    <p style="margin:6px 0 0;color:rgba(255,255,255,.8);font-size:13px;">Plataforma Operacional de Implantações</p>
  </td></tr>
  <tr><td style="padding:36px 40px;">
    <h2 style="margin:0 0 10px;font-size:20px;color:#111827;font-weight:700;">Seu acesso foi aprovado! 🎉</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.65;">
      Olá, <strong style="color:#111827;">{nome}</strong>. Seu cadastro foi revisado e aprovado pelo
      administrador. Clique no botão abaixo para definir sua senha e acessar a plataforma.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr><td style="background:#F56316;border-radius:10px;">
        <a href="{link}"
          style="display:inline-block;padding:14px 32px;color:#fff;font-size:15px;font-weight:700;
                 text-decoration:none;letter-spacing:-.2px;">
          Definir minha senha →
        </a>
      </td></tr>
    </table>
    <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
      Este link é válido por <strong>24 horas</strong>. Se o botão não funcionar, copie e cole
      este endereço no navegador:<br>
      <span style="color:#F56316;word-break:break-all;">{link}</span>
    </p>
  </td></tr>
  <tr><td style="background:#f9fafb;border-top:1px solid #f3f4f6;padding:18px 40px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#9ca3af;">
      Mensagem enviada automaticamente pelo CriareCRM. Não responda a este email.
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>"""

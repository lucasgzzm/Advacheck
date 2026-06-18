import logging
import requests

from ..configuracion import BREVO_API_KEY, SMTP_FROM_EMAIL

logger = logging.getLogger(__name__)

BREVO_URL = "https://api.brevo.com/v3/smtp/email"


def enviar_correo_sincrono(destinatario: str, asunto: str, cuerpo_html: str) -> dict:
    if not BREVO_API_KEY:
        logger.warning("BREVO_API_KEY no configurada. No se envio el correo.")
        return {"exito": False, "error": "BREVO_API_KEY no configurada"}

    try:
        payload = {
            "sender": {"email": SMTP_FROM_EMAIL or "noreply@webcheck.app"},
            "to": [{"email": destinatario}],
            "subject": asunto,
            "htmlContent": cuerpo_html,
        }

        headers = {
            "api-key": BREVO_API_KEY,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        resp = requests.post(BREVO_URL, json=payload, headers=headers, timeout=15)
        resp.raise_for_status()

        logger.info(f"Correo enviado a {destinatario} via Brevo API")
        return {"exito": True}

    except requests.RequestException as e:
        logger.error(f"Error enviando correo a {destinatario} via Brevo: {e}")
        return {"exito": False, "error": str(e)}

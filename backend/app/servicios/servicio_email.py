import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from ..configuracion import SMTP_SERVER, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM_EMAIL

logger = logging.getLogger(__name__)


def enviar_correo_sincrono(destinatario: str, asunto: str, cuerpo_html: str) -> dict:
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        logger.warning("SMTP no configurado. No se envio el correo.")
        return {"exito": False, "error": "SMTP no configurado"}

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = SMTP_FROM_EMAIL
        msg["To"] = destinatario
        msg["Subject"] = asunto
        msg.attach(MIMEText(cuerpo_html, "html"))

        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=15) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)

        logger.info(f"Correo enviado a {destinatario}")
        return {"exito": True}

    except Exception as e:
        logger.error(f"Error enviando correo a {destinatario}: {e}")
        return {"exito": False, "error": str(e)}

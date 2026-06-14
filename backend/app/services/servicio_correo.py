import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders

from ..configuracion import SMTP_SERVER, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM_EMAIL

# Logger para registrar errores de envio sin crashear la app
logger = logging.getLogger(__name__)


def enviar_correo(destinatario: str, asunto: str, cuerpo_html: str) -> bool:
    """Envia un correo electronico via SMTP.

    Usa las credenciales configuradas en configuracion.py (SMTP_USERNAME,
    SMTP_PASSWORD, etc.). Si falta configuracion o falla la conexion,
    registra el error y retorna False en vez de lanzar excepcion.
    """
    if not SMTP_SERVER or not SMTP_USERNAME or not SMTP_PASSWORD or not destinatario:
        logger.warning("Correo no enviado: faltan credenciales SMTP o destinatario")
        return False

    msg = MIMEText(cuerpo_html, "html")
    msg["Subject"] = asunto
    msg["From"] = SMTP_FROM_EMAIL or SMTP_USERNAME
    msg["To"] = destinatario

    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
        logger.info("Correo enviado a %s: %s", destinatario, asunto)
        return True
    except Exception as exc:
        logger.error("Error al enviar correo a %s: %s", destinatario, exc)
        return False


def enviar_correo_con_adjunto(
    destinatario: str,
    asunto: str,
    cuerpo_html: str,
    adjunto_nombre: str,
    adjunto_bytes: bytes,
    adjunto_mime: str = "application/pdf",
) -> bool:
    """Envia un correo electronico con un archivo adjunto via SMTP.

    Args:
        destinatario: Email del destinatario.
        asunto: Asunto del correo.
        cuerpo_html: Cuerpo del mensaje en HTML.
        adjunto_nombre: Nombre del archivo adjunto (ej: informe.pdf).
        adjunto_bytes: Contenido del archivo adjunto.
        adjunto_mime: Tipo MIME del adjunto (default: application/pdf).

    Returns:
        True si se envio correctamente, False en caso contrario.
    """
    if not SMTP_SERVER or not SMTP_USERNAME or not SMTP_PASSWORD or not destinatario:
        logger.warning("Correo con adjunto no enviado: faltan credenciales SMTP o destinatario")
        return False

    msg = MIMEMultipart("mixed")
    msg["Subject"] = asunto
    msg["From"] = SMTP_FROM_EMAIL or SMTP_USERNAME
    msg["To"] = destinatario

    parte_html = MIMEText(cuerpo_html, "html")
    msg.attach(parte_html)

    parte_adjunto = MIMEBase("application", adjunto_mime.split("/")[-1])
    parte_adjunto.set_payload(adjunto_bytes)
    encoders.encode_base64(parte_adjunto)
    parte_adjunto.add_header(
        "Content-Disposition",
        f'attachment; filename="{adjunto_nombre}"',
    )
    msg.attach(parte_adjunto)

    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
        logger.info("Correo con adjunto enviado a %s: %s (%s)", destinatario, asunto, adjunto_nombre)
        return True
    except Exception as exc:
        logger.error("Error al enviar correo con adjunto a %s: %s", destinatario, exc)
        return False


def enviar_correo_aclaracion(destinatario: str, nombre_archivo: str, mensaje: str) -> bool:
    """Prepara y envia un correo de aclaracion al importador.

    El correo incluye el nombre del documento y el mensaje que escribio
    el agente/admin pidiendo los datos faltantes.
    """
    asunto = f"Aclaracion solicitada - {nombre_archivo}"
    cuerpo = f"""\
<html>
<body style="font-family:sans-serif;padding:20px;">
    <h2>Aclaracion solicitada</h2>
    <p><strong>Documento:</strong> {nombre_archivo}</p>
    <p><strong>Mensaje:</strong></p>
    <blockquote style="background:#f5f5f5;padding:12px;border-radius:6px;">
        {mensaje}
    </blockquote>
    <p style="color:#666;font-size:0.85em;">
        Por favor responda a este correo con la informacion solicitada.
    </p>
</body>
</html>"""
    return enviar_correo(destinatario, asunto, cuerpo)

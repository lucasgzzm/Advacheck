import io
import logging
import os
from collections import OrderedDict
from datetime import datetime
from typing import Any, Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, Image, KeepTogether,
)

logger = logging.getLogger(__name__)

# Dimensiones de pagina A4 con margenes generosos
MARGEN_IZQ = 22 * mm
MARGEN_DER = 22 * mm
MARGEN_SUP = 18 * mm
MARGEN_INF = 18 * mm
ANCHO_PAGINA = A4[0] - MARGEN_IZQ - MARGEN_DER

# Ruta al logo corporativo (resuelve desde este archivo hacia backend/estatico/)
RUTA_LOGO = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "estatico", "logo-completo.png",
)

# ============================================================
# PALETA DE COLORES CORPORATIVA
# ============================================================
COLOR_PRIMARY = colors.HexColor("#1e3a5f")
COLOR_PRIMARY_LIGHT = colors.HexColor("#2d5a8e")
COLOR_ACCENT = colors.HexColor("#3b82f6")
COLOR_GREEN = colors.HexColor("#16a34a")
COLOR_GREEN_BG = colors.HexColor("#dcfce7")
COLOR_YELLOW = colors.HexColor("#ca8a04")
COLOR_YELLOW_BG = colors.HexColor("#fef9c3")
COLOR_RED = colors.HexColor("#dc2626")
COLOR_RED_BG = colors.HexColor("#fee2e2")
COLOR_GRAY = colors.HexColor("#64748b")
COLOR_GRAY_BG = colors.HexColor("#f1f5f9")
COLOR_BG_ALT = colors.HexColor("#f8fafc")
COLOR_BORDER = colors.HexColor("#e2e8f0")
COLOR_BORDER_SOFT = colors.HexColor("#f0f2f5")
COLOR_TEXT_MAIN = colors.HexColor("#1e293b")
COLOR_TEXT_MUTED = colors.HexColor("#94a3b8")
COLOR_WHITE = colors.white

# ============================================================
# ESTILOS DE TEXTO
# ============================================================
estilos_muestra = getSampleStyleSheet()

estilo_titulo = ParagraphStyle(
    "TituloInforme", parent=estilos_muestra["Heading1"],
    fontSize=18, leading=22, spaceAfter=2,
    textColor=COLOR_PRIMARY, alignment=TA_CENTER,
)
estilo_subtitulo = ParagraphStyle(
    "SubtituloInforme", parent=estilos_muestra["Heading2"],
    fontSize=11, leading=14, spaceAfter=6, spaceBefore=12,
    textColor=COLOR_PRIMARY,
)
estilo_etiqueta = ParagraphStyle(
    "Etiqueta", parent=estilos_muestra["Normal"],
    fontSize=7.5, leading=10, textColor=COLOR_TEXT_MUTED,
)
estilo_valor = ParagraphStyle(
    "Valor", parent=estilos_muestra["Normal"],
    fontSize=9, leading=12, textColor=COLOR_TEXT_MAIN,
)
estilo_monto = ParagraphStyle(
    "Monto", parent=estilos_muestra["Normal"],
    fontSize=9, leading=12, textColor=COLOR_TEXT_MAIN,
    alignment=TA_RIGHT,
)
estilo_monto_bold = ParagraphStyle(
    "MontoBold", parent=estilos_muestra["Normal"],
    fontSize=9, leading=12, textColor=COLOR_PRIMARY,
    alignment=TA_RIGHT,
)
estilo_celda_encabezado = ParagraphStyle(
    "CeldaEnc", parent=estilos_muestra["Normal"],
    fontSize=7.5, leading=10, textColor=COLOR_WHITE, alignment=TA_CENTER,
)
estilo_celda_normal = ParagraphStyle(
    "CeldaNorm", parent=estilos_muestra["Normal"],
    fontSize=8, leading=10, alignment=TA_CENTER,
)
estilo_celda_izq = ParagraphStyle(
    "CeldaIzq", parent=estilos_muestra["Normal"],
    fontSize=8, leading=10, alignment=TA_LEFT,
)
estilo_nota_pie = ParagraphStyle(
    "NotaPie", parent=estilos_muestra["Normal"],
    fontSize=7, leading=9, textColor=COLOR_TEXT_MUTED, alignment=TA_CENTER,
)
estilo_resumen_titulo = ParagraphStyle(
    "ResumenTitulo", parent=estilos_muestra["Normal"],
    fontSize=8, leading=10, textColor=COLOR_WHITE, alignment=TA_CENTER,
)
estilo_resumen_valor = ParagraphStyle(
    "ResumenValor", parent=estilos_muestra["Normal"],
    fontSize=14, leading=17, textColor=COLOR_WHITE, alignment=TA_CENTER,
)
estilo_riesgo_badge = ParagraphStyle(
    "RiesgoBadge", parent=estilos_muestra["Normal"],
    fontSize=11, leading=14, textColor=COLOR_WHITE, alignment=TA_CENTER,
)
estilo_etapa_titulo = ParagraphStyle(
    "EtapaTitulo", parent=estilos_muestra["Normal"],
    fontSize=8.5, leading=11, textColor=COLOR_PRIMARY,
)
estilo_control_pass = ParagraphStyle(
    "ControlPass", parent=estilos_muestra["Normal"],
    fontSize=7.5, leading=10, textColor=COLOR_GREEN,
)
estilo_control_warn = ParagraphStyle(
    "ControlWarn", parent=estilos_muestra["Normal"],
    fontSize=7.5, leading=10, textColor=COLOR_YELLOW,
)
estilo_control_fail = ParagraphStyle(
    "ControlFail", parent=estilos_muestra["Normal"],
    fontSize=7.5, leading=10, textColor=COLOR_RED,
)

# ============================================================
# FUNCIONES AUXILIARES DE FORMATEO
# ============================================================

def _color_riesgo(riesgo: str) -> colors.Color:
    r = (riesgo or "").upper()
    if r == "BAJO":
        return COLOR_GREEN
    elif r == "MEDIO":
        return COLOR_YELLOW
    elif r in ("ALTO", "CRITICO"):
        return COLOR_RED
    return COLOR_YELLOW

def _fmt_monto(valor) -> str:
    if valor is None:
        return "$0.00"
    return f"${float(valor):,.2f}"

def _fmt_pesos(valor) -> str:
    if valor is None:
        return "0.00 kg"
    return f"{float(valor):,.2f} kg"

def _icono_estado(estado: str) -> str:
    e = (estado or "").upper()
    if e == "PASS":
        return "✓"
    elif e == "WARNING":
        return "⚠"
    elif e == "FAIL":
        return "✗"
    return "○"

def _color_control(estado: str):
    e = (estado or "").upper()
    if e == "PASS":
        return COLOR_GREEN
    elif e == "WARNING":
        return COLOR_YELLOW
    elif e == "FAIL":
        return COLOR_RED
    return COLOR_GRAY

def _estilo_control(estado: str):
    e = (estado or "").upper()
    if e == "PASS":
        return estilo_control_pass
    elif e == "WARNING":
        return estilo_control_warn
    elif e == "FAIL":
        return estilo_control_fail
    return estilo_celda_normal

def _color_vb_estado(estado: str):
    e = (estado or "").lower()
    if e in ("aprobado", "aprobada"):
        return COLOR_GREEN_BG, COLOR_GREEN
    elif e in ("rechazado", "rechazada"):
        return COLOR_RED_BG, COLOR_RED
    elif e in ("pendiente",):
        return COLOR_YELLOW_BG, COLOR_YELLOW
    else:
        return COLOR_GRAY_BG, COLOR_GRAY

# ============================================================
# ESTILO DE TABLA BASE (bordes suaves, tipografia limpia)
# ============================================================

ESTILO_TABLA_BASE = [
    ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
    ("FONTSIZE", (0, 0), (-1, -1), 8),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("TOPPADDING", (0, 0), (-1, -1), 4),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ("GRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
    ("LINEBELOW", (0, 0), (-1, 0), 1.5, COLOR_PRIMARY),
]


def _tabla_con_estilo(data, col_widths, extra_styles=None, repeat_rows=1):
    """Crea una tabla con los estilos base aplicados."""
    estilos = list(ESTILO_TABLA_BASE)
    if extra_styles:
        estilos.extend(extra_styles)
    t = Table(data, colWidths=col_widths, repeatRows=repeat_rows)
    t.setStyle(TableStyle(estilos))
    return t


# ============================================================
# SECCIONES DEL INFORME
# ============================================================


def _seccion_logo() -> list:
    """Logo corporativo centrado con separacion inferior."""
    elementos = []
    if os.path.exists(RUTA_LOGO):
        try:
            img = Image(RUTA_LOGO)
            # Escalar manteniendo proporcion: ancho maximo 140px
            relacion = img.drawHeight / img.drawWidth if img.drawWidth else 1
            ancho_logo = min(140, ANCHO_PAGINA * 0.5)
            img.drawWidth = ancho_logo
            img.drawHeight = ancho_logo * relacion
            elementos.append(Spacer(1, 4 * mm))
            elementos.append(img)
            elementos.append(Spacer(1, 2 * mm))
        except Exception as exc:
            logger.warning("No se pudo cargar el logo: %s", exc)
            elementos.append(Spacer(1, 6 * mm))
    else:
        elementos.append(Spacer(1, 6 * mm))
    return elementos


def _seccion_encabezado(historia: dict, usuario_nombre: str) -> list:
    """Titulo, metadatos del documento y linea separadora."""
    elementos = []
    elementos.append(Paragraph("Informe de Prevalidación Aduanera", estilo_titulo))
    elementos.append(Spacer(1, 2 * mm))

    fecha_reporte = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    nombre_archivo = historia.get("nombre_archivo", "N/A")
    elementos.append(Paragraph(
        f"Documento: <b>{nombre_archivo}</b> &nbsp;|&nbsp; "
        f"Generado: {fecha_reporte} &nbsp;|&nbsp; "
        f"Por: {usuario_nombre}",
        ParagraphStyle("Meta", parent=estilo_valor, fontSize=8, alignment=TA_CENTER, textColor=COLOR_TEXT_MUTED),
    ))
    elementos.append(Spacer(1, 3 * mm))
    return elementos


def _seccion_resumen_ejecutivo(
    historia: dict, partidas: list, vistos_buenos: list,
) -> list:
    """Tarjeta destacada con indicadores clave: riesgo, CIF, items, V°B° pendientes."""
    elementos = []

    riesgo = (historia.get("riesgo") or "N/A").upper()
    color_riesgo = _color_riesgo(riesgo)
    total_cif = _fmt_monto(historia.get("total_cif"))
    total_items = len(partidas) if partidas else 0
    vbb_pendientes = sum(
        1 for vb in (vistos_buenos or [])
        if (vb.get("estado") or "").lower() == "pendiente"
    )

    riesgo_badge = f'<font size="16" color="{color_riesgo.hexval()}">●</font> {riesgo}'

    # Tabla sin bordes visibles que simula una tarjeta
    datos_tarjeta = [
        [
            Paragraph("RIESGO", estilo_resumen_titulo),
            Paragraph("TOTAL CIF", estilo_resumen_titulo),
            Paragraph("ITEMS", estilo_resumen_titulo),
            Paragraph("V°B° PEND.", estilo_resumen_titulo),
        ],
        [
            Paragraph(riesgo_badge, estilo_riesgo_badge),
            Paragraph(total_cif, estilo_resumen_valor),
            Paragraph(str(total_items), estilo_resumen_valor),
            Paragraph(str(vbb_pendientes), estilo_resumen_valor),
        ],
    ]

    ancho_col = ANCHO_PAGINA / 4
    t = Table(datos_tarjeta, colWidths=[ancho_col] * 4)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), COLOR_PRIMARY),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("LINEAFTER", (0, 0), (-2, -1), 0.5, colors.HexColor("#ffffff30")),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
    ]))
    elementos.append(t)
    elementos.append(Spacer(1, 4 * mm))
    return elementos


def _seccion_valores_con_landed(
    historia: dict, pais_destino: str = "CL",
    aplica_tlc: bool = False, dta_tasa: float = 0.0,
) -> list:
    """Tabla de valores economicos y calculo de landed cost."""
    elementos = []
    elementos.append(Paragraph("Valores Económicos", estilo_subtitulo))

    subtotal = historia.get("monto_subtotal")
    flete = historia.get("flete")
    seguro = historia.get("seguro")
    otros = historia.get("otros")
    total_cif = historia.get("total_cif")

    # FOB = suma de items (no disponible directamente en historia, usar total_cif - gastos)
    # Mejor tomar el valor_fob de los items si es posible
    valor_fob = max(0, (total_cif or 0) - (flete or 0) - (seguro or 0) - (otros or 0))
    valor_cif = total_cif or 0

    # Calculo de landed cost inline
    tasa_advalorem = 0.0 if aplica_tlc else 6.0
    impuesto_advalorem = valor_cif * (tasa_advalorem / 100)
    tasas_iva = {"CL": 19, "MX": 16, "ES": 21}
    tasa_iva = tasas_iva.get(pais_destino, 19)
    dta = (valor_cif * (dta_tasa / 100)) if pais_destino == "MX" else 0
    base_iva = valor_cif + impuesto_advalorem + dta
    impuesto_iva = base_iva * (tasa_iva / 100)
    total_tributos = impuesto_advalorem + dta + impuesto_iva
    total_nacionalizado = valor_cif + total_tributos

    # Tabla de valores economicos base
    data_valores = [
        [Paragraph("<b>Concepto</b>", estilo_celda_encabezado),
         Paragraph("<b>Monto</b>", estilo_celda_encabezado)],
        ["Valor FOB (mercancía)", Paragraph(_fmt_monto(valor_fob), estilo_monto)],
        ["Flete", Paragraph(_fmt_monto(flete), estilo_monto)],
        ["Seguro", Paragraph(_fmt_monto(seguro), estilo_monto)],
        ["Otros Gastos", Paragraph(_fmt_monto(otros), estilo_monto)],
    ]

    if subtotal:
        data_valores.insert(2, ["Subtotal declarado", Paragraph(_fmt_monto(subtotal), estilo_monto)])

    data_valores.append([
        Paragraph("<b>Valor CIF</b>", estilo_celda_encabezado),
        Paragraph(f"<b>{_fmt_monto(valor_cif)}</b>", estilo_monto_bold),
    ])

    # Tabla de liquidacion tributaria
    data_liquidacion = [
        [Paragraph("<b>Concepto</b>", estilo_celda_encabezado),
         Paragraph("<b>Tasa</b>", estilo_celda_encabezado),
         Paragraph("<b>Monto</b>", estilo_celda_encabezado)],
        ["Base Imponible (CIF)", "—", Paragraph(_fmt_monto(valor_cif), estilo_monto)],
        [f"Arancel Ad-Valorem", f"{tasa_advalorem:.1f}%", Paragraph(_fmt_monto(impuesto_advalorem), estilo_monto)],
    ]

    if pais_destino == "MX":
        data_liquidacion.append([
            "DTA (Derecho de Trámite Aduanero)",
            f"{dta_tasa:.1f}%",
            Paragraph(_fmt_monto(dta), estilo_monto),
        ])

    data_liquidacion += [
        [f"IVA ({tasa_iva}%)", "—", Paragraph(_fmt_monto(impuesto_iva), estilo_monto)],
        [Paragraph("<b>Total Tributos</b>", estilo_celda_encabezado),
         "—",
         Paragraph(f"<b>{_fmt_monto(total_tributos)}</b>", estilo_monto_bold)],
        [Paragraph("<b>Total Nacionalizado</b>", estilo_celda_encabezado),
         "—",
         Paragraph(f"<b>{_fmt_monto(total_nacionalizado)}</b>", estilo_monto_bold)],
    ]

    # Tabla de valores economicos base
    tabla_valores = _tabla_con_estilo(
        data_valores,
        col_widths=[ANCHO_PAGINA * 0.7, ANCHO_PAGINA * 0.3],
        extra_styles=[
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ("BACKGROUND", (0, -1), (-1, -1), COLOR_BG_ALT),
            ("LINEABOVE", (0, -1), (-1, -1), 1, COLOR_PRIMARY),
            ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
        ],
    )
    elementos.append(tabla_valores)
    elementos.append(Spacer(1, 3 * mm))

    # Tabla de liquidacion tributaria
    elementos.append(Paragraph("Liquidación Tributaria Simulada", estilo_subtitulo))
    tabla_liquidacion = _tabla_con_estilo(
        data_liquidacion,
        col_widths=[ANCHO_PAGINA * 0.5, ANCHO_PAGINA * 0.12, ANCHO_PAGINA * 0.2],
        extra_styles=[
            ("FONTNAME", (0, -2), (-1, -1), "Helvetica-Bold"),
            ("BACKGROUND", (0, -2), (-1, -1), COLOR_BG_ALT),
            ("LINEABOVE", (0, -2), (-1, -1), 1, COLOR_PRIMARY),
            ("BACKGROUND", (0, -1), (-1, -1), COLOR_PRIMARY),
            ("TEXTCOLOR", (0, -1), (-1, -1), COLOR_WHITE),
            ("ALIGN", (2, 1), (-1, -1), "RIGHT"),
        ],
    )
    elementos.append(tabla_liquidacion)
    elementos.append(Spacer(1, 3 * mm))
    return elementos


def _seccion_datos_documento(historia: dict) -> list:
    """Datos basicos del documento en formato tabla 2xN."""
    elementos = []
    elementos.append(Paragraph("Datos del Documento", estilo_subtitulo))

    # Extraer emisor desde proveedor
    emisor = historia.get("proveedor", "N/A")
    receptor = historia.get("cliente", "N/A")

    data = [
        ["N° Factura", historia.get("numero_factura") or "N/A",
         "Fecha Emisión", historia.get("fecha_emision") or "N/A"],
        ["Moneda", historia.get("moneda") or "USD",
         "Incoterm", historia.get("incoterm") or "N/A"],
        ["País Origen", historia.get("pais_origen") or "N/A",
         "RUT / Tax ID", historia.get("receptor_tax") or "N/A"],
        ["Proveedor / Emisor", emisor, "Receptor / Destinatario", receptor],
    ]

    t = _tabla_con_estilo(
        data,
        col_widths=[ANCHO_PAGINA * 0.16, ANCHO_PAGINA * 0.34,
                     ANCHO_PAGINA * 0.16, ANCHO_PAGINA * 0.34],
        extra_styles=[
            ("TEXTCOLOR", (0, 0), (0, -1), COLOR_TEXT_MUTED),
            ("TEXTCOLOR", (2, 0), (2, -1), COLOR_TEXT_MUTED),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [COLOR_WHITE, COLOR_BG_ALT]),
        ],
    )
    elementos.append(t)
    elementos.append(Spacer(1, 3 * mm))
    return elementos


def _seccion_direcciones(historia: dict) -> list:
    """Direcciones de remitente y destinatario."""
    elementos = []
    remitente = historia.get("remitente_dir") or "No especificada"
    destinatario = historia.get("destinatario_dir") or "No especificada"

    data = [
        ["Remitente", remitente],
        ["Destinatario", destinatario],
    ]
    t = _tabla_con_estilo(
        data,
        col_widths=[ANCHO_PAGINA * 0.18, ANCHO_PAGINA * 0.82],
        extra_styles=[
            ("TEXTCOLOR", (0, 0), (0, -1), COLOR_TEXT_MUTED),
            ("ROWBACKGROUNDS", (0, 0), (-1, -1), [COLOR_WHITE, COLOR_BG_ALT]),
        ],
    )
    elementos.append(t)
    elementos.append(Spacer(1, 3 * mm))
    return elementos


def _seccion_logistica(historia: dict) -> list:
    """Informacion de transporte y pesos."""
    elementos = []
    elementos.append(Paragraph("Logística", estilo_subtitulo))

    data = [
        ["Transporte (País)", historia.get("transporte_pais") or "N/A",
         "Método", historia.get("transporte_metodo") or "N/A"],
        ["Peso Bruto", _fmt_pesos(historia.get("peso_bruto")),
         "Peso Neto", _fmt_pesos(historia.get("peso_neto"))],
    ]
    t = _tabla_con_estilo(
        data,
        col_widths=[ANCHO_PAGINA * 0.16, ANCHO_PAGINA * 0.34,
                     ANCHO_PAGINA * 0.16, ANCHO_PAGINA * 0.34],
        extra_styles=[
            ("TEXTCOLOR", (0, 0), (0, -1), COLOR_TEXT_MUTED),
            ("TEXTCOLOR", (2, 0), (2, -1), COLOR_TEXT_MUTED),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [COLOR_WHITE, COLOR_BG_ALT]),
        ],
    )
    elementos.append(t)
    elementos.append(Spacer(1, 3 * mm))
    return elementos


def _seccion_prevalidacion(prevalidacion: Optional[dict]) -> list:
    """Las 7 etapas de prevalidacion con sus controles, coloreadas por estado."""
    elementos = []
    if not prevalidacion:
        return elementos

    elementos.append(Paragraph("Resultados de Prevalidación (7 Etapas)", estilo_subtitulo))

    riesgo_global = prevalidacion.get("riesgo_global", "N/A").upper()
    puntaje = prevalidacion.get("puntaje_riesgo", 0)
    etapas = prevalidacion.get("etapas", [])

    # Encabezado resumen
    color_r = _color_riesgo(riesgo_global)
    resumen_html = (
        f'Riesgo Global: <font color="{color_r.hexval()}"><b>{riesgo_global}</b></font>'
        f' &nbsp;&nbsp;|&nbsp;&nbsp; Puntaje: <b>{puntaje:.1f}%</b>'
        f' &nbsp;&nbsp;|&nbsp;&nbsp; Etapas: <b>{len(etapas)}</b>'
    )
    elementos.append(Paragraph(resumen_html, estilo_valor))
    elementos.append(Spacer(1, 2 * mm))

    for etapa in etapas:
        num = etapa.get("numero", "?")
        titulo = etapa.get("titulo", "Sin título")
        estado = etapa.get("estado", "NO_EJECUTADA")
        resumen = etapa.get("resumen", "")
        controles = etapa.get("controles", [])

        color_e = _color_control(estado)
        icono_e = _icono_estado(estado)

        # Fila de la etapa como encabezado de grupo
        etapa_html = (
            f'<font color="{COLOR_PRIMARY.hexval()}"><b>Etapa {num}: {titulo}</b></font>'
            f' &nbsp; '
            f'<font color="{color_e.hexval()}">{icono_e} {estado}</font>'
            f' &nbsp;—&nbsp; {resumen}'
        )
        elementos.append(Paragraph(etapa_html, estilo_valor))

        if controles:
            # Sub-tabla de controles
            data_controles = [
                [Paragraph("<b>Control</b>", estilo_celda_encabezado),
                 Paragraph("<b>Estado</b>", estilo_celda_encabezado),
                 Paragraph("<b>Mensaje</b>", estilo_celda_encabezado)],
            ]
            for ctrl in controles:
                nom_ctrl = ctrl.get("nombre", "")
                # Omitir controles internos de scoring
                if nom_ctrl == "scoring_final":
                    continue
                est_ctrl = (ctrl.get("estado") or "NO_EJECUTADA").upper()
                msg_ctrl = ctrl.get("mensaje", "")
                detalle_ctrl = ctrl.get("detalle")
                texto_msg = msg_ctrl
                if detalle_ctrl:
                    texto_msg += f" ({detalle_ctrl})"

                color_c = _color_control(est_ctrl)
                icono_c = _icono_estado(est_ctrl)
                estilo_c = _estilo_control(est_ctrl)

                data_controles.append([
                    Paragraph(nom_ctrl, estilo_celda_izq),
                    Paragraph(f'{icono_c} {est_ctrl}', estilo_c),
                    Paragraph(texto_msg, estilo_celda_izq),
                ])

            if len(data_controles) > 1:
                sub_t = Table(
                    data_controles,
                    colWidths=[ANCHO_PAGINA * 0.22, ANCHO_PAGINA * 0.1, ANCHO_PAGINA * 0.68],
                )
                sub_t.setStyle(TableStyle([
                    ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                    ("FONTSIZE", (0, 0), (-1, -1), 7),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("TOPPADDING", (0, 1), (-1, -1), 2),
                    ("BOTTOMPADDING", (0, 1), (-1, -1), 2),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ("GRID", (0, 0), (-1, -1), 0.3, COLOR_BORDER_SOFT),
                    ("BACKGROUND", (0, 0), (-1, 0), COLOR_PRIMARY),
                    ("LINEBELOW", (0, 0), (-1, 0), 1, COLOR_PRIMARY),
                ]))
                elementos.append(sub_t)

        elementos.append(Spacer(1, 2 * mm))

    elementos.append(Spacer(1, 2 * mm))
    return elementos


def _seccion_items_agrupados(partidas: list) -> list:
    """Items agrupados por partida arancelaria con subtotales."""
    elementos = []
    if not partidas:
        return elementos

    elementos.append(Paragraph("Ítems por Partida Arancelaria", estilo_subtitulo))

    # Agrupar por partida (corregida > sugerida > "Sin clasificar")
    grupos = OrderedDict()
    for p in partidas:
        partida = (p.get("partida_corregida") or p.get("partida_sugerida") or "Sin clasificar")
        if partida not in grupos:
            grupos[partida] = []
        grupos[partida].append(p)

    gran_total = 0
    for idx, (partida, items_grupo) in enumerate(grupos.items()):
        # Encabezado del grupo
        sub_total = sum(
            (it.get("cantidad") or 0) * (it.get("precio_unitario") or 0)
            for it in items_grupo
        )
        gran_total += sub_total

        elementos.append(Paragraph(
            f'<font color="{COLOR_PRIMARY.hexval()}"><b>Partida: {partida}</b></font>'
            f' &nbsp;—&nbsp; {len(items_grupo)} ítem(s) &nbsp;—&nbsp; '
            f'Subtotal: {_fmt_monto(sub_total)}',
            estilo_valor,
        ))

        # Tabla del grupo
        data_items = [
            [Paragraph("<b>#</b>", estilo_celda_encabezado),
             Paragraph("<b>Descripción</b>", estilo_celda_encabezado),
             Paragraph("<b>Cant.</b>", estilo_celda_encabezado),
             Paragraph("<b>Precio Unit.</b>", estilo_celda_encabezado),
             Paragraph("<b>Total</b>", estilo_celda_encabezado)],
        ]
        for i, it in enumerate(items_grupo, 1):
            cant = it.get("cantidad") or 0
            pu = it.get("precio_unitario") or 0
            total_item = cant * pu
            data_items.append([
                str(i),
                Paragraph(it.get("descripcion") or "N/A", estilo_celda_izq),
                f"{float(cant):.2f}",
                _fmt_monto(pu),
                _fmt_monto(total_item),
            ])

        # Fila de subtotal del grupo
        data_items.append([
            "",
            Paragraph("<b>Subtotal grupo</b>", estilo_celda_izq),
            "",
            "",
            Paragraph(f"<b>{_fmt_monto(sub_total)}</b>", estilo_monto_bold),
        ])

        t = _tabla_con_estilo(
            data_items,
            col_widths=[ANCHO_PAGINA * 0.04, ANCHO_PAGINA * 0.38,
                         ANCHO_PAGINA * 0.1, ANCHO_PAGINA * 0.18,
                         ANCHO_PAGINA * 0.18],
            extra_styles=[
                ("ALIGN", (2, 1), (-1, -1), "RIGHT"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -2), [COLOR_WHITE, COLOR_BG_ALT]),
                ("BACKGROUND", (0, -1), (-1, -1), COLOR_BG_ALT),
                ("LINEABOVE", (0, -1), (-1, -1), 1, COLOR_PRIMARY_LIGHT),
            ],
        )
        elementos.append(t)
        elementos.append(Spacer(1, 3 * mm))

    # Gran total
    elementos.append(Paragraph(
        f'<b>Total General: {_fmt_monto(gran_total)}</b>',
        ParagraphStyle("TotalFinal", parent=estilo_valor, fontSize=10,
                       textColor=COLOR_PRIMARY),
    ))
    elementos.append(Spacer(1, 3 * mm))
    return elementos


def _seccion_vistos_buenos(vistos_buenos: list) -> list:
    """V°B° con celdas de estado coloreadas."""
    elementos = []
    if not vistos_buenos:
        return elementos

    elementos.append(Paragraph("Vistos Buenos (V°B°)", estilo_subtitulo))

    data = [
        [Paragraph("<b>Entidad</b>", estilo_celda_encabezado),
         Paragraph("<b>Tipo Permiso</b>", estilo_celda_encabezado),
         Paragraph("<b>Estado</b>", estilo_celda_encabezado),
         Paragraph("<b>Observaciones</b>", estilo_celda_encabezado)],
    ]
    for vb in vistos_buenos:
        estado = (vb.get("estado") or "pendiente").lower()
        bg_estado, fg_estado = _color_vb_estado(estado)
        data.append([
            vb.get("entidad") or "N/A",
            vb.get("tipo_permiso") or "N/A",
            Paragraph(
                f'<font color="{fg_estado.hexval()}"><b>{estado.capitalize()}</b></font>',
                ParagraphStyle("VbCell", parent=estilo_celda_normal, fontSize=7.5,
                               backColor=bg_estado),
            ),
            vb.get("observaciones") or "",
        ])

    t = _tabla_con_estilo(
        data,
        col_widths=[ANCHO_PAGINA * 0.2, ANCHO_PAGINA * 0.22,
                     ANCHO_PAGINA * 0.13, ANCHO_PAGINA * 0.45],
        extra_styles=[
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [COLOR_WHITE, COLOR_BG_ALT]),
            # Colorear fondo de la celda de estado manualmente
        ],
    )
    elementos.append(t)
    elementos.append(Spacer(1, 3 * mm))
    return elementos


def _seccion_observaciones(observaciones: list) -> list:
    """Historial de observaciones del documento."""
    elementos = []
    if not observaciones:
        return elementos

    elementos.append(Paragraph("Observaciones", estilo_subtitulo))

    data = [
        [Paragraph("<b>#</b>", estilo_celda_encabezado),
         Paragraph("<b>Tipo</b>", estilo_celda_encabezado),
         Paragraph("<b>Fecha</b>", estilo_celda_encabezado),
         Paragraph("<b>Usuario</b>", estilo_celda_encabezado),
         Paragraph("<b>Contenido</b>", estilo_celda_encabezado)],
    ]
    for i, obs in enumerate(observaciones, 1):
        data.append([
            str(i),
            obs.get("tipo") or "nota",
            (obs.get("fecha_creacion") or "")[:10] if obs.get("fecha_creacion") else "",
            obs.get("usuario_nombre") or "",
            Paragraph(obs.get("contenido") or "", estilo_celda_izq),
        ])

    t = _tabla_con_estilo(
        data,
        col_widths=[ANCHO_PAGINA * 0.03, ANCHO_PAGINA * 0.08,
                     ANCHO_PAGINA * 0.1, ANCHO_PAGINA * 0.12,
                     ANCHO_PAGINA * 0.67],
        extra_styles=[
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [COLOR_WHITE, COLOR_BG_ALT]),
        ],
    )
    elementos.append(t)
    elementos.append(Spacer(1, 3 * mm))
    return elementos


def _seccion_pie(historia: dict, usuario_nombre: str) -> list:
    """Pie de pagina con firma digital y descargo."""
    elementos = []
    elementos.append(HRFlowable(
        width="100%", thickness=0.5, color=COLOR_BORDER,
        spaceAfter=3 * mm, spaceBefore=6 * mm,
    ))
    elementos.append(Paragraph(
        f"Generado por: <b>{usuario_nombre}</b> — "
        f"Advacheck ({datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')})",
        estilo_nota_pie,
    ))
    elementos.append(Paragraph(
        "Este informe es una representación de los datos registrados en el "
        "sistema de prevalidación aduanera. Los montos y estados reflejan "
        "la información disponible al momento de la generación.",
        estilo_nota_pie,
    ))
    elementos.append(Paragraph(
        "Advacheck — Plataforma de Prevalidación Aduanera con IA",
        ParagraphStyle("Footer", parent=estilo_nota_pie,
                       textColor=COLOR_TEXT_MUTED, fontSize=6.5),
    ))
    return elementos


def _agregar_numero_pagina(canvas, doc):
    """Callback de ReportLab para numerar paginas en el footer."""
    canvas.saveState()
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(COLOR_TEXT_MUTED)
    canvas.drawCentredString(
        A4[0] / 2, 10 * mm,
        f"Página {doc.page}  |  Advacheck — Informe de Prevalidación Aduanera",
    )
    canvas.restoreState()


# ============================================================
# FUNCION PRINCIPAL: GENERAR PDF
# ============================================================

def generar_pdf_informe(
    historia: dict,
    doc_extra: Optional[dict] = None,
    partidas: Optional[list] = None,
    vistos_buenos: Optional[list] = None,
    observaciones: Optional[list] = None,
    usuario_nombre: str = "Usuario",
    pais_destino: str = "CL",
    aplica_tlc: bool = False,
    dta_tasa: float = 0.0,
    prevalidacion: Optional[dict] = None,
) -> bytes:
    """Genera un PDF profesional con el informe completo de prevalidación aduanera.

    Args:
        historia: Diccionario con todos los campos del DocumentoProcesado.
        doc_extra: Datos adicionales del documento (no usado actualmente, se mantiene
                   para compatibilidad).
        partidas: Lista de items/partidas del documento.
        vistos_buenos: Lista de V°B° regulatorios asociados.
        observaciones: Lista de observaciones del documento.
        usuario_nombre: Nombre del usuario que genera el informe.
        pais_destino: Código ISO del país de destino (CL, MX, ES).
        aplica_tlc: Si aplica un tratado de libre comercio.
        dta_tasa: Tasa de DTA para México (porcentaje).
        prevalidacion: Diccionario completo con las 7 etapas de prevalidación.

    Returns:
        bytes del PDF generado.
    """
    buf = io.BytesIO()

    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=MARGEN_IZQ, rightMargin=MARGEN_DER,
        topMargin=MARGEN_SUP, bottomMargin=MARGEN_INF,
    )

    elementos = []
    partidas = partidas or []
    vistos_buenos = vistos_buenos or []
    observaciones = observaciones or []

    # Ensamblar todas las secciones en orden
    elementos += _seccion_logo()
    elementos += _seccion_encabezado(historia, usuario_nombre)
    elementos += _seccion_resumen_ejecutivo(historia, partidas, vistos_buenos)
    elementos.append(HRFlowable(
        width="100%", thickness=1, color=COLOR_PRIMARY,
        spaceAfter=4 * mm, spaceBefore=2 * mm,
    ))

    elementos += _seccion_datos_documento(historia)
    elementos += _seccion_direcciones(historia)
    elementos += _seccion_valores_con_landed(historia, pais_destino, aplica_tlc, dta_tasa)
    elementos += _seccion_logistica(historia)

    if prevalidacion:
        elementos += _seccion_prevalidacion(prevalidacion)
    else:
        # Si no hay prevalidacion detallada, mostrar al menos el riesgo resumido
        riesgo = historia.get("riesgo", "N/A")
        if riesgo:
            elementos.append(Paragraph(
                f"Riesgo asignado: <b>{riesgo.upper()}</b>",
                estilo_subtitulo,
            ))

    elementos += _seccion_items_agrupados(partidas)

    if vistos_buenos:
        elementos += _seccion_vistos_buenos(vistos_buenos)

    if observaciones:
        elementos += _seccion_observaciones(observaciones)

    elementos += _seccion_pie(historia, usuario_nombre)

    doc.build(elementos, onFirstPage=_agregar_numero_pagina, onLaterPages=_agregar_numero_pagina)
    return buf.getvalue()

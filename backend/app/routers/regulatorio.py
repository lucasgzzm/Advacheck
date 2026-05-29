from ..services.servicio_auditoria import registrar_auditoria
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime
from typing import List

from .. import modelos
from ..base_datos import get_db
from ..dependencias import obtener_usuario_actual, obtener_documento_seguro

router = APIRouter(prefix="/api/regulatorio", tags=["Regulatorio"])

ENTIDADES_POR_PARTIDA = [
    {"rango_desde": "0101", "rango_hasta": "0609", "entidad": "SENASA", "tipo": "Certificado Fitosanitario", "ley": "Ley N° 18.450 / Resolución SENASA N° 125"},
    {"rango_desde": "0201", "rango_hasta": "0210", "entidad": "SAG", "tipo": "Certificado Zoosanitario", "ley": "Reglamento General de Cárnicos"},
    {"rango_desde": "0301", "rango_hasta": "0308", "entidad": "SERNAPESCA", "tipo": "Certificado Sanitario de Pesca", "ley": "Ley General de Pesca y Acuicultura"},
    {"rango_desde": "0401", "rango_hasta": "0410", "entidad": "SAG", "tipo": "Certificado Sanitario Lácteos", "ley": "Norma Técnica N° 145"},
    {"rango_desde": "1001", "rango_hasta": "1006", "entidad": "SENASA", "tipo": "Certificado Fitosanitario de Granos", "ley": "Resolución SENASA N° 78"},
    {"rango_desde": "1501", "rango_hasta": "1518", "entidad": "SENASA", "tipo": "Certificado Sanitario de Aceites", "ley": "Código Alimentario"},
    {"rango_desde": "1601", "rango_hasta": "1605", "entidad": "ISP", "tipo": "Registro Sanitario de Alimentos", "ley": "Reglamento Sanitario de Alimentos"},
    {"rango_desde": "2001", "rango_hasta": "2009", "entidad": "ISP", "tipo": "Registro Sanitario de Alimentos", "ley": "Resolución ISP N° 788"},
    {"rango_desde": "2101", "rango_hasta": "2106", "entidad": "ISP", "tipo": "Registro Sanitario de Alimentos", "ley": "Reglamento Sanitario de Alimentos"},
    {"rango_desde": "2201", "rango_hasta": "2209", "entidad": "ISP", "tipo": "Registro Sanitario de Bebidas", "ley": "Ley N° 19.925"},
    {"rango_desde": "2401", "rango_hasta": "2403", "entidad": "ISP", "tipo": "Registro Sanitario de Tabaco", "ley": "Ley N° 20.660"},
    {"rango_desde": "2710", "rango_hasta": "2715", "entidad": "SEC", "tipo": "Certificado de Calidad de Combustibles", "ley": "DS N° 160 / Reglamento SEC"},
    {"rango_desde": "2801", "rango_hasta": "2853", "entidad": "COFEPRIS", "tipo": "Permiso de Sustancias Químicas Controladas", "ley": "NOM-005-SSA1"},
    {"rango_desde": "2901", "rango_hasta": "2942", "entidad": "COFEPRIS", "tipo": "Permiso de Sustancias Químicas Esenciales", "ley": "Ley Federal de Químicos Esenciales"},
    {"rango_desde": "3001", "rango_hasta": "3006", "entidad": "ISP", "tipo": "Registro Sanitario de Medicamentos", "ley": "DS N° 3 / ISP Reglamento Farmacéutico"},
    {"rango_desde": "3001", "rango_hasta": "3006", "entidad": "COFEPRIS", "tipo": "Registro Sanitario de Medicamentos", "ley": "NOM-059-SSA1"},
    {"rango_desde": "3808", "rango_hasta": "3809", "entidad": "SAG", "tipo": "Certificado de Plaguicidas", "ley": "Resolución SAG N° 2.348"},
    {"rango_desde": "4011", "rango_hasta": "4013", "entidad": "INN", "tipo": "Certificado de Norma Técnica de Neumáticos", "ley": "NCH 2369"},
    {"rango_desde": "6403", "rango_hasta": "6405", "entidad": "SEC", "tipo": "Certificado de Seguridad de Calzado", "ley": "NCH 1970"},
    {"rango_desde": "8418", "rango_hasta": "8418", "entidad": "SEC", "tipo": "Certificado de Eficiencia Energética", "ley": "DS N° 298 / Reglamento SEC"},
    {"rango_desde": "8471", "rango_hasta": "8473", "entidad": "SUBTEL", "tipo": "Homologación de Equipos de Telecomunicaciones", "ley": "Ley N° 18.168 / Norma Técnica SUBTEL"},
    {"rango_desde": "8517", "rango_hasta": "8518", "entidad": "SUBTEL", "tipo": "Homologación de Equipos de Telecomunicaciones", "ley": "Resolución SUBTEL N° 600"},
    {"rango_desde": "8525", "rango_hasta": "8528", "entidad": "SUBTEL", "tipo": "Homologación de Equipos de Radiodifusión", "ley": "Norma Técnica SUBTEL"},
    {"rango_desde": "8542", "rango_hasta": "8542", "entidad": "SEC", "tipo": "Certificado de Seguridad Eléctrica", "ley": "DS N° 298 / NCH 4"},
    {"rango_desde": "8703", "rango_hasta": "8705", "entidad": "MINTRANS", "tipo": "Certificado de Homologación Vehicular", "ley": "DS N° 55 / Ley de Tránsito"},
    {"rango_desde": "9018", "rango_hasta": "9022", "entidad": "ISP", "tipo": "Registro Sanitario de Equipos Médicos", "ley": "DS N° 3 / ISP Reglamento de Dispositivos Médicos"},
    {"rango_desde": "9018", "rango_hasta": "9022", "entidad": "COFEPRIS", "tipo": "Registro Sanitario de Dispositivos Médicos", "ley": "NOM-240-SSA1"},
    {"rango_desde": "9401", "rango_hasta": "9403", "entidad": "SEC", "tipo": "Certificado de Seguridad de Muebles", "ley": "NCH 825"},
    {"rango_desde": "9503", "rango_hasta": "9503", "entidad": "ISP", "tipo": "Certificado de Seguridad de Juguetes", "ley": "NCH 325 / ISP Resolución N° 1.200"},
    {"rango_desde": "9503", "rango_hasta": "9503", "entidad": "SEC", "tipo": "Certificado de Seguridad Eléctrica de Juguetes", "ley": "NCH 4"},
    {"rango_desde": "9506", "rango_hasta": "9506", "entidad": "ISP", "tipo": "Certificado de Seguridad de Artículos Deportivos", "ley": "Resolución ISP N° 450"},
]


def detectar_entidades_para_partida(partida: str) -> list:
    """Devuelve entidades regulatorias según la partida arancelaria."""
    if not partida:
        return []
    codigo = partida.replace(".", "").replace("-", "").strip()[:4].ljust(4, "0")
    resultados = []
    for regla in ENTIDADES_POR_PARTIDA:
        if regla["rango_desde"] <= codigo <= regla["rango_hasta"]:
            resultados.append({
                "entidad": regla["entidad"],
                "tipo_permiso": regla["tipo"],
                "ley": regla["ley"],
                "estado": "pendiente",
            })
    return resultados


@router.get("/entidades-por-partida/{codigo}")
async def entidades_para_partida(codigo: str):
    """Consulta entidades regulatorias para un código arancelario."""
    entidades = detectar_entidades_para_partida(codigo)
    return {
        "codigo": codigo,
        "entidades": entidades,
        "total": len(entidades),
    }


@router.get("/entidades")
async def listar_entidades():
    """Lista las entidades regulatorias disponibles."""
    unicas = list({e["entidad"]: e for e in ENTIDADES_POR_PARTIDA}.values())
    return [
        {
            "sigla": e["entidad"],
            "nombre": REGULADORES.get(e["entidad"], e["entidad"]),
        }
        for e in unicas
    ]


REGULADORES = {
    "SENASA": "Servicio Nacional de Sanidad Agraria",
    "SAG": "Servicio Agrícola y Ganadero",
    "SERNAPESCA": "Servicio Nacional de Pesca y Acuicultura",
    "ISP": "Instituto de Salud Pública",
    "COFEPRIS": "Comisión Federal para la Protección contra Riesgos Sanitarios",
    "SEC": "Superintendencia de Electricidad y Combustibles",
    "SUBTEL": "Subsecretaría de Telecomunicaciones",
    "MINTRANS": "Ministerio de Transportes y Telecomunicaciones",
    "INN": "Instituto Nacional de Normalización",
}


@router.get("/documentos/{documento_id}/vistos-buenos")
async def obtener_vistos_buenos(
    documento_id: int,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Obtiene los V°B° asociados a un documento."""
    await obtener_documento_seguro(documento_id, usuario_actual, db)
    resultado = await db.execute(
        select(modelos.VistoBueno)
        .filter(modelos.VistoBueno.documento_id == documento_id)
    )
    return resultado.scalars().all()


@router.post("/documentos/{documento_id}/vistos-buenos/sincronizar")
async def sincronizar_vistos_buenos(
    documento_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Sincroniza los V°B° según las partidas del documento."""
    await obtener_documento_seguro(documento_id, usuario_actual, db)
    partidas = payload.get("partidas", [])
    entidades_detectadas = []
    for p in partidas:
        entidades_detectadas.extend(detectar_entidades_para_partida(p))

    resultado = await db.execute(
        select(modelos.VistoBueno)
        .filter(modelos.VistoBueno.documento_id == documento_id)
    )
    existentes = resultado.scalars().all()
    existentes_set = {(vb.entidad, vb.tipo_permiso) for vb in existentes}

    creados = 0
    for ent in entidades_detectadas:
        key = (ent["entidad"], ent["tipo_permiso"])
        if key not in existentes_set:
            nuevo = modelos.VistoBueno(
                entidad=ent["entidad"],
                tipo_permiso=ent["tipo_permiso"],
                estado="pendiente",
                documento_id=documento_id,
                usuario_id=usuario_actual.id,
            )
            db.add(nuevo)
            creados += 1

    if creados > 0:
        await db.commit()

    resultado_final = await db.execute(
        select(modelos.VistoBueno)
        .filter(modelos.VistoBueno.documento_id == documento_id)
    )
    return {
        "creados": creados,
        "vistos_buenos": resultado_final.scalars().all(),
    }


@router.patch("/vistos-buenos/{vb_id}")
async def actualizar_visto_bueno(
    vb_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Actualiza el estado y observaciones de un V°B°."""
    resultado = await db.execute(
        select(modelos.VistoBueno).filter(modelos.VistoBueno.id == vb_id)
    )
    vb = resultado.scalars().first()
    if not vb:
        raise HTTPException(status_code=404, detail="V°B° no encontrado.")
    await obtener_documento_seguro(vb.documento_id, usuario_actual, db)

    if "estado" in payload:
        vb.estado = payload["estado"]
    if "observaciones" in payload:
        vb.observaciones = payload["observaciones"]
    if "archivo_nombre" in payload:
        vb.archivo_nombre = payload["archivo_nombre"]

    vb.fecha_gestion = datetime.now()
    await db.commit()

    await registrar_auditoria(db, usuario_actual.id, "Actualización de V°B°", f"V°B° ID {vb.id}: {vb.entidad} - {vb.tipo_permiso} → {vb.estado}")
    await db.commit()

    return {"mensaje": f"V°B° de {vb.entidad} actualizado a '{vb.estado}'."}

TLC_POR_ORIGEN = {
    "CL": {"paises": ["MX", "US", "CA", "KR", "CN", "JP", "AU", "NZ"], "nombre_tlc": "Chile"},
    "MX": {"paises": ["US", "CA", "EU", "JP"], "nombre_tlc": "México (T-MEC)"},
    "US": {"paises": ["MX", "CA", "KR", "SG"], "nombre_tlc": "EE.UU."},
    "CO": {"paises": ["US", "MX", "EU", "KR"], "nombre_tlc": "Colombia"},
}


@router.get("/tlc/evaluar")
async def evaluar_tlc(
    pais_origen: str = "",
    pais_destino: str = "",
    partida: str = "",
):
    """Evalúa si aplica un TLC entre país origen y destino."""
    if not pais_origen or not pais_destino:
        return {"tlc_aplica": False, "mensaje": "Faltan países para evaluar TLC."}

    tlc_destino = TLC_POR_ORIGEN.get(pais_destino.upper())
    if tlc_destino and pais_origen.upper() in tlc_destino["paises"]:
        return {
            "tlc_aplica": True,
            "nombre_tlc": f"{tlc_destino['nombre_tlc']} - {pais_origen.upper()}",
            "arancel_preferencial": 0,
            "arancel_general": 6.0,
        }

    return {
        "tlc_aplica": False,
        "nombre_tlc": None,
        "arancel_preferencial": None,
        "arancel_general": 6.0,
    }

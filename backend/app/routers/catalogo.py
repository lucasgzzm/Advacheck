from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
import json
import os

from .. import esquemas, modelos
from ..base_datos import get_db
from ..dependencias import obtener_usuario_actual

router = APIRouter(prefix="/api/catalogo", tags=["Catálogo Arancelario"])


@router.get("/arancel/secciones")
async def obtener_secciones_arancel():
    ruta = os.path.join(os.path.dirname(os.path.dirname(__file__)), "datos_arancel.json")
    if not os.path.exists(ruta):
        return {"secciones": [], "mensaje": "Base de datos arancelaria no disponible"}
    with open(ruta, encoding="utf-8") as f:
        data = json.load(f)
    return data


@router.get("/arancel/buscar")
async def buscar_en_arancel(
    q: str = Query(..., min_length=2),
):
    ruta = os.path.join(os.path.dirname(os.path.dirname(__file__)), "datos_arancel.json")
    if not os.path.exists(ruta):
        return {"resultados": []}

    with open(ruta, encoding="utf-8") as f:
        data = json.load(f)

    query = q.lower().strip()
    resultados = []

    for seccion in data.get("secciones", []):
        for cap in seccion.get("capitulos", []):
            if query in cap.get("codigo", "") or query in cap.get("titulo", "").lower():
                resultados.append({
                    "tipo": "capitulo",
                    "codigo": cap["codigo"],
                    "titulo": cap["titulo"],
                    "seccion": seccion.get("id", ""),
                    "notas": cap.get("notas", ""),
                })
            for partida in cap.get("partidas", []):
                if query in partida.get("codigo", "") or query in partida.get("titulo", "").lower():
                    resultados.append({
                        "tipo": "partida",
                        "codigo": partida["codigo"],
                        "titulo": partida["titulo"],
                        "capitulo": cap["codigo"],
                        "seccion": seccion.get("id", ""),
                    })

    return {"resultados": resultados[:50]}


@router.get("/arancel/partida/{codigo}/notas")
async def obtener_notas_partida(codigo: str):
    ruta = os.path.join(os.path.dirname(os.path.dirname(__file__)), "datos_arancel.json")
    if not os.path.exists(ruta):
        return {"capitulo": None, "notas": "", "mensaje": "Base de datos arancelaria no disponible"}

    with open(ruta, encoding="utf-8") as f:
        data = json.load(f)

    codigo_limpio = codigo.replace(".", "").replace("-", "").strip()
    codigo_capitulo = codigo_limpio[:2].zfill(2)

    for seccion in data.get("secciones", []):
        for cap in seccion.get("capitulos", []):
            if cap["codigo"] == codigo_capitulo:
                return {
                    "codigo_capitulo": codigo_capitulo,
                    "titulo_capitulo": cap["titulo"],
                    "seccion": seccion.get("id", ""),
                    "titulo_seccion": seccion.get("titulo", ""),
                    "notas": cap.get("notas", ""),
                    "codigo_original": codigo,
                }

    return {"codigo_capitulo": codigo_capitulo, "notas": "", "mensaje": "Capítulo no encontrado"}


@router.get("/partidas")
async def buscar_partidas(
    q: str = "",
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    consulta = select(modelos.CatalogoPartida).order_by(
        desc(modelos.CatalogoPartida.frecuencia_uso)
    )

    if q:
        consulta = consulta.filter(
            modelos.CatalogoPartida.descripcion_producto.ilike(f"%{q}%")
        )

    resultado = await db.execute(consulta.limit(50))
    partidas = resultado.scalars().all()

    return [
        {
            "id": p.id,
            "descripcion_producto": p.descripcion_producto,
            "partida_arancelaria": p.partida_arancelaria,
            "frecuencia_uso": p.frecuencia_uso,
            "ultima_actualizacion": p.ultima_actualizacion.isoformat() if p.ultima_actualizacion else None,
        }
        for p in partidas
    ]


@router.post("/partidas", status_code=status.HTTP_201_CREATED)
async def registrar_partida(
    partida: esquemas.CatalogoPartidaCreate,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    resultado = await db.execute(
        select(modelos.CatalogoPartida).filter(
            modelos.CatalogoPartida.descripcion_producto.ilike(
                f"%{partida.descripcion_producto}%"
            ),
            modelos.CatalogoPartida.partida_arancelaria == partida.partida_arancelaria,
        )
    )
    existente = resultado.scalars().first()

    if existente:
        existente.frecuencia_uso += 1
        existente.usuario_id = usuario_actual.id
        await db.commit()
        return {
            "mensaje": "Partida existente actualizada.",
            "frecuencia": existente.frecuencia_uso,
        }

    nueva = modelos.CatalogoPartida(
        descripcion_producto=partida.descripcion_producto,
        partida_arancelaria=partida.partida_arancelaria,
        usuario_id=usuario_actual.id,
    )
    db.add(nueva)
    await db.commit()
    return {"mensaje": "Nueva partida registrada en el catálogo."}

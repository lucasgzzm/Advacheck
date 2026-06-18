from fastapi import APIRouter, Depends, HTTPException, status
import os
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from .. import esquemas, modelos
from ..base_datos import get_db
from ..dependencias import obtener_usuario_actual

router = APIRouter(prefix="/api/catalogo", tags=["Catalogo Arancelario"])

@router.get("/arancel", status_code=status.HTTP_200_OK)
async def obtener_catalogo_arancelario():
    ruta_archivo = os.path.join(os.path.dirname(__file__), "..", "datos_arancel.json")
    try:
        with open(ruta_archivo, "r", encoding="utf-8") as f:
            datos = json.load(f)
        return datos
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error leyendo el catálogo arancelario")

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
    return {"mensaje": "Nueva partida registrada en el catalogo."}

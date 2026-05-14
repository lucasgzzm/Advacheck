from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import List

from .. import esquemas, modelos
from ..base_datos import get_db
from .autenticacion import get_current_admin

router = APIRouter(
    prefix="/api/admin",
    tags=["Administración"]
)


@router.get("/metrics")
async def get_global_metrics(
    db: AsyncSession = Depends(get_db),
    admin: modelos.Usuario = Depends(get_current_admin)
):
    """Devuelve las métricas globales del sistema para el panel de administrador."""

    total_res = await db.execute(select(func.count(modelos.DocumentoProcesado.id)))
    total = total_res.scalar() or 0

    riesgo_alto_res = await db.execute(select(func.count(modelos.DocumentoProcesado.id)).filter(modelos.DocumentoProcesado.riesgo == "alto"))
    riesgo_alto = riesgo_alto_res.scalar() or 0

    riesgo_medio_res = await db.execute(select(func.count(modelos.DocumentoProcesado.id)).filter(modelos.DocumentoProcesado.riesgo == "medio"))
    riesgo_medio = riesgo_medio_res.scalar() or 0

    riesgo_bajo_res = await db.execute(select(func.count(modelos.DocumentoProcesado.id)).filter(modelos.DocumentoProcesado.riesgo == "bajo"))
    riesgo_bajo = riesgo_bajo_res.scalar() or 0

    usuarios_res = await db.execute(select(func.count(modelos.Usuario.id)).filter(modelos.Usuario.activo == True))
    usuarios_activos = usuarios_res.scalar() or 0

    return {
        "total_operaciones": total,
        "riesgos": {
            "alto": riesgo_alto,
            "medio": riesgo_medio,
            "bajo": riesgo_bajo,
            "alto_porcentaje": round((riesgo_alto / total * 100), 1) if total > 0 else 0,
            "medio_porcentaje": round((riesgo_medio / total * 100), 1) if total > 0 else 0,
            "bajo_porcentaje": round((riesgo_bajo / total * 100), 1) if total > 0 else 0
        },
        "analistas_activos": usuarios_activos,
        "salud_ocr": 98.5
    }


@router.get("/documents", response_model=List[esquemas.DocumentoProcesadoResponse])
async def get_all_documents(
    db: AsyncSession = Depends(get_db),
    admin: modelos.Usuario = Depends(get_current_admin)
):
    """Devuelve el historial completo de documentos de todos los usuarios."""
    result = await db.execute(
        select(modelos.DocumentoProcesado)
        .order_by(desc(modelos.DocumentoProcesado.fecha_analisis))
    )
    return result.scalars().all()


@router.get("/users", response_model=List[esquemas.UserResponse])
async def get_all_users(
    db: AsyncSession = Depends(get_db),
    admin: modelos.Usuario = Depends(get_current_admin)
):
    """Lista todos los usuarios registrados con su rol."""
    result = await db.execute(select(modelos.Usuario))
    usuarios = result.scalars().all()

    respuesta = []
    for u in usuarios:
        rol_res = await db.execute(select(modelos.Rol).filter(modelos.Rol.id == u.rol_id))
        rol = rol_res.scalars().first()
        respuesta.append({
            "id": u.id,
            "nombre": u.nombre,
            "email": u.email,
            "rol_nombre": rol.nombre if rol else "Agente",
            "activo": u.activo
        })
    return respuesta


@router.patch("/users/{u_id}/status")
async def toggle_user_status(
    u_id: int,
    db: AsyncSession = Depends(get_db),
    admin: modelos.Usuario = Depends(get_current_admin)
):
    """Activa o desactiva la cuenta de un usuario y registra el evento en auditoría."""
    result = await db.execute(select(modelos.Usuario).filter(modelos.Usuario.id == u_id))
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="No puedes bloquear tu propia cuenta.")

    user.activo = not user.activo
    nuevo_estado = "Activo" if user.activo else "Bloqueado"

    log = modelos.Auditoria(
        accion="Cambio de Estado de Usuario",
        detalles=f"Usuario '{user.nombre}' ({user.email}) marcado como {nuevo_estado}.",
        usuario_id=admin.id
    )
    db.add(log)
    await db.commit()

    return {"mensaje": f"Estado del usuario {user.nombre} actualizado a {nuevo_estado}"}


@router.get("/roles")
async def get_roles(
    db: AsyncSession = Depends(get_db),
    admin: modelos.Usuario = Depends(get_current_admin)
):
    """Lista los roles disponibles en el sistema."""
    result = await db.execute(select(modelos.Rol))
    return result.scalars().all()


@router.patch("/users/{u_id}/role")
async def change_user_role(
    u_id: int,
    rol_id: int,
    db: AsyncSession = Depends(get_db),
    admin: modelos.Usuario = Depends(get_current_admin)
):
    """Cambia el rol de un usuario y registra el evento en auditoría."""
    result = await db.execute(select(modelos.Usuario).filter(modelos.Usuario.id == u_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="No puedes cambiar tu propio rol.")

    rol_res = await db.execute(select(modelos.Rol).filter(modelos.Rol.id == rol_id))
    rol = rol_res.scalars().first()
    if not rol:
        raise HTTPException(status_code=404, detail="El rol especificado no existe")

    user.rol_id = rol_id

    log = modelos.Auditoria(
        accion="Cambio de Rol de Usuario",
        detalles=f"Rol de '{user.nombre}' ({user.email}) actualizado a '{rol.nombre}'.",
        usuario_id=admin.id
    )
    db.add(log)
    await db.commit()

    return {"mensaje": f"Rol de {user.nombre} actualizado a {rol.nombre}"}


@router.get("/auditoria")
async def get_auditoria(
    db: AsyncSession = Depends(get_db),
    admin: modelos.Usuario = Depends(get_current_admin)
):
    """
    Obtiene el log de auditoría completo.
    Usa un JOIN eficiente para evitar el antipatrón N+1 queries.
    """
    result = await db.execute(
        select(
            modelos.Auditoria.id,
            modelos.Auditoria.fecha_accion,
            modelos.Auditoria.accion,
            modelos.Auditoria.detalles,
            modelos.Auditoria.usuario_id,
            modelos.Usuario.nombre.label("usuario_nombre")
        )
        .join(modelos.Usuario, modelos.Auditoria.usuario_id == modelos.Usuario.id)
        .order_by(desc(modelos.Auditoria.fecha_accion))
    )
    rows = result.mappings().all()

    return [
        {
            "id": r["id"],
            "fecha_accion": r["fecha_accion"].isoformat(),
            "accion": r["accion"],
            "detalles": r["detalles"],
            "usuario_id": r["usuario_id"],
            "usuario_nombre": r["usuario_nombre"]
        }
        for r in rows
    ]

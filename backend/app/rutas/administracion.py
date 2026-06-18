from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, update, delete, and_
from sqlalchemy.orm import selectinload
from typing import List
import json
from datetime import datetime, timedelta, timezone

from .. import esquemas, modelos
from ..servicios.servicio_auditoria import registrar_auditoria
from ..base_datos import get_db
from ..seguridad import generar_hash
from ..configuracion import GEMINI_API_KEY
from ..servicios.servicio_texto import AITextService
from ..dependencias import (
    obtener_admin_actual,
    limpiar_sesiones_expiradas,
    usuarios_conectados,
    obtener_rol_usuario,
)

router = APIRouter(prefix="/api/admin", tags=["Administracion"])

REGLAS_POR_DEFECTO = [
    {
        "nombre_regla": "IncotermValidationRule",
        "nombre_mostrar": "Validacion de Incoterm",
        "descripcion": "Verifica que el Incoterm declarado sea valido y que los cargos de flete/seguro sean consistentes.",
        "parametros": {"incoterms_permitidos": ["FOB","CIF","CFR","CPT","CIP","EXW","FCA","FAS","DAT","DAP","DDP"]},
    },
    {
        "nombre_regla": "CIFSquareRule",
        "nombre_mostrar": "Cuadre Aritmetico CIF",
        "descripcion": "Valida que Subtotal + Flete + Seguro + Otros sea igual al Total declarado, con tolerancia configurable.",
        "parametros": {"tolerancia_usd": 2.0},
    },
    {
        "nombre_regla": "HSCodeVistoBuenoRule",
        "nombre_mostrar": "Vistos Buenos por Partida Arancelaria",
        "descripcion": "Cruza la partida HS contra el catalogo de entidades regulatorias y alerta si faltan permisos.",
        "parametros": {"umbral_faltantes_bloqueo": 3},
    },
    {
        "nombre_regla": "PesoBultosRule",
        "nombre_mostrar": "Validacion de Pesos y Bultos",
        "descripcion": "Verifica que peso bruto y bultos coincidan entre BL, Packing List y Factura.",
        "parametros": {"tolerancia_peso_kg": 5.0, "tolerancia_bultos": 1, "tolerancia_porcentual_peso": 0.05},
    },
    {
        "nombre_regla": "ProveedorIdentidadRule",
        "nombre_mostrar": "Identidad del Exportador / Proveedor",
        "descripcion": "Compara nombre y Tax ID del exportador entre Factura y BL para detectar suplantaciones.",
        "parametros": {"umbral_similitud": 0.75},
    },
]

async def _sembrar_reglas_si_vacio(db: AsyncSession):
    resultado = await db.execute(select(func.count(modelos.ReglaConfiguracion.id)))
    total = resultado.scalar() or 0
    if total > 0:
        return
    for r in REGLAS_POR_DEFECTO:
        db.add(modelos.ReglaConfiguracion(
            nombre_regla=r["nombre_regla"],
            nombre_mostrar=r["nombre_mostrar"],
            descripcion=r["descripcion"],
            activa=True,
            severidad="BLOQUEANTE",
            parametros=json.dumps(r["parametros"]),
        ))
    await db.commit()

@router.get("/metrics")
async def obtener_metricas_globales(
    db: AsyncSession = Depends(get_db),
    admin: modelos.Usuario = Depends(obtener_admin_actual),
):
    await limpiar_sesiones_expiradas()

    total = (await db.execute(select(func.count(modelos.DocumentoProcesado.id)))).scalar() or 0

    riesgo_alto = (
        await db.execute(
            select(func.count(modelos.DocumentoProcesado.id)).filter(
                func.lower(modelos.DocumentoProcesado.riesgo) == "alto"
            )
        )
    ).scalar() or 0

    riesgo_medio = (
        await db.execute(
            select(func.count(modelos.DocumentoProcesado.id)).filter(
                func.lower(modelos.DocumentoProcesado.riesgo) == "medio"
            )
        )
    ).scalar() or 0

    riesgo_bajo = (
        await db.execute(
            select(func.count(modelos.DocumentoProcesado.id)).filter(
                func.lower(modelos.DocumentoProcesado.riesgo) == "bajo"
            )
        )
    ).scalar() or 0

    def porcentaje(valor):
        return round((valor / total * 100), 1) if total > 0 else 0

    return {
        "total_operaciones": total,
        "riesgos": {
            "alto": riesgo_alto,
            "medio": riesgo_medio,
            "bajo": riesgo_bajo,
            "alto_porcentaje": porcentaje(riesgo_alto),
            "medio_porcentaje": porcentaje(riesgo_medio),
            "bajo_porcentaje": porcentaje(riesgo_bajo),
        },
        "analistas_activos": len(usuarios_conectados),
        "salud_ocr": 98.5,
    }

@router.get("/health")
async def health_check(
    db: AsyncSession = Depends(get_db),
    admin: modelos.Usuario = Depends(obtener_admin_actual),
):
    ahora = datetime.now(timezone.utc).replace(tzinfo=None)

    gemini_configurado = bool(GEMINI_API_KEY)
    gemini_estado = await AITextService.obtener_estado() if gemini_configurado else {}
    gemini_online = gemini_estado.get("online", False)
    gemini_rate_limited = gemini_estado.get("rate_limited", False)
    gemini_retry_after = gemini_estado.get("retry_after")
    gemini_motivo = gemini_estado.get("motivo")

    hace_7_dias = ahora - timedelta(days=7)

    total_docs = await db.scalar(select(func.count(modelos.DocumentoProcesado.id)))
    docs_7d = await db.scalar(
        select(func.count(modelos.DocumentoProcesado.id)).where(
            modelos.DocumentoProcesado.fecha_analisis >= hace_7_dias
        )
    )

    docs_en_cola = await db.scalar(
        select(func.count(modelos.DocumentoProcesado.id)).where(
            and_(
                modelos.DocumentoProcesado.estado == "En Revisión",
                modelos.DocumentoProcesado.bloqueado == False,
            )
        )
    )

    docs_con_error = await db.scalar(
        select(func.count(modelos.DocumentoProcesado.id)).where(
            and_(
                modelos.DocumentoProcesado.fecha_analisis >= hace_7_dias,
                modelos.DocumentoProcesado.riesgo == "Alto",
                modelos.DocumentoProcesado.estado != "Archivado",
            )
        )
    )

    total_7d = docs_7d or 0
    errores_7d = docs_con_error or 0
    salud_ocr = round((1 - (errores_7d / max(total_7d, 1))) * 100, 1)

    return {
        "gemini": {
            "configurado": gemini_configurado,
            "online": gemini_online,
            "rate_limited": gemini_rate_limited,
            "retry_after": gemini_retry_after,
            "motivo": gemini_motivo,
        },
        "db": {
            "conectado": True,
            "documentos_totales": total_docs or 0,
        },
        "ocr": {
            "salud_porcentaje": salud_ocr,
            "documentos_7d": total_7d,
            "errores_7d": errores_7d,
        },
        "cola": {
            "pendientes": docs_en_cola or 0,
        },
        "timestamp": ahora.isoformat(),
    }

@router.get("/common-errors")
async def errores_comunes(
    db: AsyncSession = Depends(get_db),
    admin: modelos.Usuario = Depends(obtener_admin_actual),
):
    ahora = datetime.now(timezone.utc).replace(tzinfo=None)
    hace_30d = ahora - timedelta(days=30)

    # Obtenemos todos los resultados de pre-validación de los últimos 30 días
    resultado_query = await db.execute(
        select(modelos.DocumentoProcesado.prevalidacion_resultado).where(
            and_(
                modelos.DocumentoProcesado.fecha_analisis >= hace_30d,
                modelos.DocumentoProcesado.prevalidacion_resultado.isnot(None)
            )
        )
    )
    resultados = resultado_query.scalars().all()

    # Mapeo de etapas a nombres amigables y colores
    MAPEO_ERRORES = {
        "Validacion Documental y Formal": {"tipo": "Datos Incompletos (Formato)", "color": "#f97316"},
        "Validacion Comercial CIF + SQUARE": {"tipo": "Inconsistencia Comercial / CIF", "color": "#ef4444"},
        "Validacion Normativa (Vistos Buenos)": {"tipo": "Permisos Faltantes", "color": "#8b5cf6"},
        "Validacion de Pesos, Bultos y Cantidades": {"tipo": "Diferencia de Pesos/Bultos", "color": "#3b82f6"},
        "Validacion de Valoracion y Precios": {"tipo": "Alerta de Valoración", "color": "#ec4899"},
        "Validacion de Plazos y Vigencias": {"tipo": "Plazos Excedidos", "color": "#f59e0b"}
    }

    conteo_errores = {}

    for res in resultados:
        if not isinstance(res, dict) or "etapas" not in res:
            continue
            
        for etapa in res.get("etapas", []):
            if etapa.get("estado") in ["FAIL", "WARNING"]:
                titulo_original = etapa.get("titulo", "Error Desconocido")
                if titulo_original in MAPEO_ERRORES:
                    if titulo_original not in conteo_errores:
                        conteo_errores[titulo_original] = 0
                    conteo_errores[titulo_original] += 1

    # Formatear la lista de resultados para el frontend
    lista_errores = []
    for titulo_original, cantidad in conteo_errores.items():
        info = MAPEO_ERRORES[titulo_original]
        lista_errores.append({
            "tipo": info["tipo"],
            "cantidad": cantidad,
            "color": info["color"]
        })

    # Ordenar de mayor a menor y tomar el Top 4
    lista_errores.sort(key=lambda x: x["cantidad"], reverse=True)
    return lista_errores[:4]

@router.get("/documents", response_model=List[esquemas.DocumentoProcesadoResponse])
async def obtener_todos_documentos(
    db: AsyncSession = Depends(get_db),
    admin: modelos.Usuario = Depends(obtener_admin_actual),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
):
    resultado = await db.execute(
        select(modelos.DocumentoProcesado)
        .options(
            selectinload(modelos.DocumentoProcesado.partidas),
            selectinload(modelos.DocumentoProcesado.usuario_rel),
        )
        .order_by(desc(modelos.DocumentoProcesado.fecha_analisis))
        .offset(skip)
        .limit(limit)
    )
    docs = resultado.scalars().all()
    respuesta = []
    for doc in docs:
        datos = esquemas.DocumentoProcesadoResponse.model_validate(doc).model_dump()
        datos["usuario_nombre"] = doc.usuario_rel.nombre if doc.usuario_rel else None
        respuesta.append(datos)
    return respuesta

@router.get("/users", response_model=List[esquemas.UserResponse])
async def obtener_todos_usuarios(
    db: AsyncSession = Depends(get_db),
    admin: modelos.Usuario = Depends(obtener_admin_actual),
):
    await limpiar_sesiones_expiradas()

    resultado = await db.execute(
        select(
            modelos.Usuario.id,
            modelos.Usuario.nombre,
            modelos.Usuario.email,
            modelos.Usuario.activo,
            modelos.Rol.nombre.label("rol_nombre"),
        ).join(modelos.Rol, modelos.Usuario.rol_id == modelos.Rol.id)
    )
    filas = resultado.mappings().all()

    return [
        {
            "id": f["id"],
            "nombre": f["nombre"],
            "email": f["email"],
            "rol_nombre": f["rol_nombre"],
            "activo": f["activo"],
            "online": f["id"] in usuarios_conectados,
        }
        for f in filas
    ]

@router.patch("/users/{usuario_id}/status")
async def cambiar_estado_usuario(
    usuario_id: int,
    db: AsyncSession = Depends(get_db),
    admin: modelos.Usuario = Depends(obtener_admin_actual),
):
    resultado = await db.execute(
        select(modelos.Usuario).filter(modelos.Usuario.id == usuario_id)
    )
    usuario = resultado.scalars().first()

    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if usuario.id == admin.id:
        raise HTTPException(
            status_code=400, detail="No puedes bloquear tu propia cuenta."
        )

    usuario.activo = not usuario.activo
    nuevo_estado = "Activo" if usuario.activo else "Bloqueado"

    await registrar_auditoria(db, admin.id, "Cambio de Estado de Usuario", f"Usuario '{usuario.nombre}' ({usuario.email}) marcado como {nuevo_estado}.")
    await db.commit()

    return {
        "mensaje": f"Estado del usuario {usuario.nombre} actualizado a {nuevo_estado}"
    }

@router.get("/roles")
async def obtener_roles(
    db: AsyncSession = Depends(get_db),
    admin: modelos.Usuario = Depends(obtener_admin_actual),
):
    resultado = await db.execute(select(modelos.Rol))
    return resultado.scalars().all()

@router.patch("/users/{usuario_id}/role")
async def cambiar_rol_usuario(
    usuario_id: int,
    rol_id: int,
    db: AsyncSession = Depends(get_db),
    admin: modelos.Usuario = Depends(obtener_admin_actual),
):
    resultado = await db.execute(
        select(modelos.Usuario).filter(modelos.Usuario.id == usuario_id)
    )
    usuario = resultado.scalars().first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if usuario.id == admin.id:
        raise HTTPException(
            status_code=400, detail="No puedes cambiar tu propio rol."
        )

    resultado_rol = await db.execute(
        select(modelos.Rol).filter(modelos.Rol.id == rol_id)
    )
    rol = resultado_rol.scalars().first()
    if not rol:
        raise HTTPException(status_code=404, detail="El rol especificado no existe")

    usuario.rol_id = rol_id

    await registrar_auditoria(db, admin.id, "Cambio de Rol de Usuario", f"Rol de '{usuario.nombre}' ({usuario.email}) actualizado a '{rol.nombre}'.")
    await db.commit()

    return {"mensaje": f"Rol de {usuario.nombre} actualizado a {rol.nombre}"}

@router.delete("/users/{usuario_id}")
async def eliminar_usuario(
    usuario_id: int,
    db: AsyncSession = Depends(get_db),
    admin: modelos.Usuario = Depends(obtener_admin_actual),
):
    resultado = await db.execute(
        select(modelos.Usuario).filter(modelos.Usuario.id == usuario_id)
    )
    usuario = resultado.scalars().first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if usuario.id == admin.id:
        raise HTTPException(
            status_code=400,
            detail="No puedes eliminar tu propia cuenta de administrador.",
        )

    await db.execute(
        update(modelos.DocumentoProcesado)
        .filter(modelos.DocumentoProcesado.usuario_id == usuario_id)
        .values(usuario_id=None)
    )
    await db.execute(
        update(modelos.CatalogoPartida)
        .filter(modelos.CatalogoPartida.usuario_id == usuario_id)
        .values(usuario_id=None)
    )
    await db.execute(
        delete(modelos.Observacion).filter(
            modelos.Observacion.usuario_id == usuario_id
        )
    )
    await db.execute(
        delete(modelos.Auditoria).filter(
            modelos.Auditoria.usuario_id == usuario_id
        )
    )

    await registrar_auditoria(db, admin.id, "Eliminacion de Usuario",
        f"Usuario '{usuario.nombre}' ({usuario.email}) eliminado permanentemente por el Administrador."
    )

    await db.delete(usuario)
    await db.commit()

    return {
        "mensaje": f"Usuario {usuario.nombre} y todas sus dependencias asociadas eliminados con exito."
    }

@router.post("/users", status_code=status.HTTP_201_CREATED)
async def crear_usuario(
    body: esquemas.AdminCreateUserRequest,
    db: AsyncSession = Depends(get_db),
    admin: modelos.Usuario = Depends(obtener_admin_actual),
):
    resultado = await db.execute(
        select(modelos.Usuario).filter(modelos.Usuario.email == body.email)
    )
    if resultado.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El correo electronico ya esta registrado.",
        )

    resultado_rol = await db.execute(
        select(modelos.Rol).filter(modelos.Rol.id == body.rol_id)
    )
    rol = resultado_rol.scalars().first()
    if not rol:
        raise HTTPException(status_code=404, detail="El rol especificado no existe")

    nuevo_usuario = modelos.Usuario(
        nombre=body.nombre,
        email=body.email,
        contrasena_hash=generar_hash(body.password),
        activo=True,
        rol_id=body.rol_id,
    )
    db.add(nuevo_usuario)
    await db.flush()
    await db.refresh(nuevo_usuario)

    await registrar_auditoria(db, admin.id, "Creacion de Usuario", f"Admin '{admin.nombre}' creo el usuario '{nuevo_usuario.nombre}' ({nuevo_usuario.email}) con rol '{rol.nombre}'.")
    await db.commit()

    return {
        "mensaje": f"Usuario {nuevo_usuario.nombre} creado exitosamente con rol {rol.nombre}",
        "usuario_id": nuevo_usuario.id,
    }

@router.get("/auditoria")
async def obtener_auditoria(
    db: AsyncSession = Depends(get_db),
    admin: modelos.Usuario = Depends(obtener_admin_actual),
):
    resultado = await db.execute(
        select(
            modelos.Auditoria.id,
            modelos.Auditoria.fecha_accion,
            modelos.Auditoria.accion,
            modelos.Auditoria.detalles,
            modelos.Auditoria.usuario_id,
            modelos.Usuario.nombre.label("usuario_nombre"),
        )
        .join(modelos.Usuario, modelos.Auditoria.usuario_id == modelos.Usuario.id)
        .order_by(desc(modelos.Auditoria.fecha_accion))
    )
    filas = resultado.mappings().all()

    return [
        {
            "id": f["id"],
            "fecha_accion": f["fecha_accion"].isoformat(),
            "accion": f["accion"],
            "detalles": f["detalles"],
            "usuario_id": f["usuario_id"],
            "usuario_nombre": f["usuario_nombre"],
        }
        for f in filas
    ]

@router.get("/rules", response_model=List[esquemas.ReglaConfiguracionResponse])
async def obtener_reglas(
    db: AsyncSession = Depends(get_db),
    admin: modelos.Usuario = Depends(obtener_admin_actual),
):
    await _sembrar_reglas_si_vacio(db)
    resultado = await db.execute(
        select(
            modelos.ReglaConfiguracion.id,
            modelos.ReglaConfiguracion.nombre_regla,
            modelos.ReglaConfiguracion.nombre_mostrar,
            modelos.ReglaConfiguracion.descripcion,
            modelos.ReglaConfiguracion.activa,
            modelos.ReglaConfiguracion.severidad,
            modelos.ReglaConfiguracion.parametros,
            modelos.ReglaConfiguracion.ultima_modificacion,
            modelos.Usuario.nombre.label("modificado_por"),
        )
        .outerjoin(
            modelos.Usuario,
            modelos.ReglaConfiguracion.modificado_por_id == modelos.Usuario.id,
        )
        .order_by(modelos.ReglaConfiguracion.id)
    )
    filas = resultado.mappings().all()
    return [
        {
            "id": f["id"],
            "nombre_regla": f["nombre_regla"],
            "nombre_mostrar": f["nombre_mostrar"],
            "descripcion": f["descripcion"],
            "activa": f["activa"],
            "severidad": f["severidad"],
            "parametros": json.loads(f["parametros"]) if f.get("parametros") else None,
            "ultima_modificacion": f["ultima_modificacion"],
            "modificado_por": f["modificado_por"],
        }
        for f in filas
    ]

@router.put("/rules/{rule_id}/toggle")
async def toggle_regla(
    rule_id: int,
    body: esquemas.ReglaToggleRequest,
    db: AsyncSession = Depends(get_db),
    admin: modelos.Usuario = Depends(obtener_admin_actual),
):
    resultado = await db.execute(
        select(modelos.ReglaConfiguracion).filter(modelos.ReglaConfiguracion.id == rule_id)
    )
    regla = resultado.scalars().first()
    if not regla:
        raise HTTPException(status_code=404, detail="Regla no encontrada")

    regla.activa = body.activa
    regla.ultima_modificacion = datetime.now(timezone.utc).replace(tzinfo=None)
    regla.modificado_por_id = admin.id

    await registrar_auditoria(db, admin.id, "Toggle Regla", (
            f"Regla '{regla.nombre_regla}' {'activada' if body.activa else 'desactivada'} "
            f"por {admin.nombre}."
        ))
    await db.commit()
    return {"mensaje": f"Regla {'activada' if body.activa else 'desactivada'}", "activa": regla.activa}

@router.put("/rules/{rule_id}/severity")
async def cambiar_severidad_regla(
    rule_id: int,
    body: esquemas.ReglaSeveridadRequest,
    db: AsyncSession = Depends(get_db),
    admin: modelos.Usuario = Depends(obtener_admin_actual),
):
    resultado = await db.execute(
        select(modelos.ReglaConfiguracion).filter(modelos.ReglaConfiguracion.id == rule_id)
    )
    regla = resultado.scalars().first()
    if not regla:
        raise HTTPException(status_code=404, detail="Regla no encontrada")

    severidad_anterior = regla.severidad
    regla.severidad = body.severidad
    regla.ultima_modificacion = datetime.now(timezone.utc).replace(tzinfo=None)
    regla.modificado_por_id = admin.id

    await registrar_auditoria(db, admin.id, "Cambio de Severidad de Regla", (
            f"Regla '{regla.nombre_regla}': severidad cambiada de "
            f"'{severidad_anterior}' a '{body.severidad}' por {admin.nombre}."
        ))
    await db.commit()
    return {
        "mensaje": f"Severidad actualizada a '{body.severidad}'",
        "severidad": regla.severidad,
    }

@router.put("/rules/{rule_id}/threshold")
async def cambiar_umbral_regla(
    rule_id: int,
    body: esquemas.ReglaThresholdRequest,
    db: AsyncSession = Depends(get_db),
    admin: modelos.Usuario = Depends(obtener_admin_actual),
):
    resultado = await db.execute(
        select(modelos.ReglaConfiguracion).filter(modelos.ReglaConfiguracion.id == rule_id)
    )
    regla = resultado.scalars().first()
    if not regla:
        raise HTTPException(status_code=404, detail="Regla no encontrada")

    parametros_previos = regla.parametros
    regla.parametros = json.dumps(body.parametros)
    regla.ultima_modificacion = datetime.now(timezone.utc).replace(tzinfo=None)
    regla.modificado_por_id = admin.id

    await registrar_auditoria(db, admin.id, "Cambio de Umbral de Regla", (
            f"Regla '{regla.nombre_regla}': parametros actualizados de "
            f"'{parametros_previos}' a '{json.dumps(body.parametros)}' por {admin.nombre}."
        ))
    await db.commit()
    return {
        "mensaje": "Parametros de umbral actualizados",
        "parametros": body.parametros,
    }

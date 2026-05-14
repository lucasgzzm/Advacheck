from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List
from pydantic import BaseModel

from .autenticacion import get_current_user
from .. import esquemas, modelos
from ..base_datos import get_db
from ..servicios import SistemaReglasAduaneras
from ..servicio_extraccion import ExtractorService

router = APIRouter(
    prefix="/api/facturas",
    tags=["Facturas"]
)


@router.post("/", response_model=esquemas.FacturaResponse, status_code=status.HTTP_201_CREATED)
async def registrar_y_evaluar_factura(factura_req: esquemas.FacturaCreate, envio_id: int, db: AsyncSession = Depends(get_db)):
    """
    Registra una factura manualmente, la evalúa con el motor de reglas
    y persiste el resultado junto con sus ítems en la BD.
    """
    # Evaluar la factura completa con el motor de reglas
    evaluacion_global = SistemaReglasAduaneras.procesar_factura_completa(factura_req)
    
    # Guardar la cabecera de la factura
    nueva_factura = modelos.Factura(
        numero_factura=factura_req.numero_factura,
        fecha_emision=factura_req.fecha_emision,
        monto_total=factura_req.monto_total,
        moneda=factura_req.moneda,
        emisor_nombre=factura_req.emisor_nombre,
        riesgo_calculado=evaluacion_global.nivel_riesgo_general,
        observaciones_riesgo=evaluacion_global.observaciones,
        envio_id=envio_id
    )
    
    db.add(nueva_factura)
    await db.flush()
    
    # Guardar cada ítem evaluado individualmente
    for req_item in factura_req.detalles:
        evaluacion_item = SistemaReglasAduaneras.evaluar_item(req_item)
        nuevo_item = modelos.FacturaDetalle(
            descripcion_producto=req_item.descripcion_producto,
            cantidad=req_item.cantidad,
            precio_unitario=req_item.precio_unitario,
            partida_arancelaria_sugerida=evaluacion_item.sugerencia_partida,
            inconsistente=evaluacion_item.inconsistente,
            factura_id=nueva_factura.id
        )
        db.add(nuevo_item)
        
    await db.commit()
    await db.refresh(nueva_factura)
    
    return nueva_factura


@router.post("/scan")
async def escanear_factura_pdf(
    guardar: bool = True,
    file: UploadFile = File(...), 
    db: AsyncSession = Depends(get_db),
    current_user: modelos.Usuario = Depends(get_current_user)
):
    """
    Recibe un PDF, extrae los datos con OCR + Gemini,
    los evalúa con el motor de reglas y devuelve la previsualización.
    Opcionalmente guarda un registro en el historial de documentos procesados.
    """
    if not file.filename.endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se admiten archivos PDF."
        )

    try:
        # Leer el contenido binario del archivo
        contenido = await file.read()
        
        # Procesar con el servicio de extracción (OCR + análisis de texto)
        datos_extraidos = await ExtractorService.extract_from_pdf(contenido)
        
        # Adaptar los datos al esquema de evaluación del motor de reglas
        factura_mock = esquemas.FacturaCreate(
            numero_factura=datos_extraidos.get("numero_factura", "N/A"),
            fecha_emision=None, 
            monto_total=datos_extraidos.get("monto_total_cif", 0.0),
            moneda=datos_extraidos.get("moneda", "USD"),
            incoterm=datos_extraidos.get("incoterm"),
            pais_origen=datos_extraidos.get("pais_origen"),
            monto_subtotal=datos_extraidos.get("monto_subtotal", 0.0),
            monto_flete=datos_extraidos.get("monto_flete", 0.0),
            monto_seguro=datos_extraidos.get("monto_seguro", 0.0),
            monto_otros_gastos=datos_extraidos.get("monto_otros_gastos", 0.0),
            peso_bruto=datos_extraidos.get("pesos", {}).get("bruto", 0.0),
            peso_neto=datos_extraidos.get("pesos", {}).get("neto", 0.0),
            emisor_nombre=datos_extraidos.get("emisor", {}).get("nombre", "Desconocido"),
            emisor_tax_id=datos_extraidos.get("emisor", {}).get("tax_id"),
            receptor_nombre=datos_extraidos.get("receptor", {}).get("nombre"),
            receptor_tax_id=datos_extraidos.get("receptor", {}).get("tax_id"),
            receptor_pais=datos_extraidos.get("receptor", {}).get("pais"),
            detalles=[
                esquemas.FacturaDetalleCreate(
                    descripcion_producto=d["descripcion_producto"],
                    cantidad=d["cantidad"],
                    precio_unitario=d["precio_unitario"]
                ) for d in datos_extraidos.get("detalles", [])
            ]
        )
        
        # Evaluar riesgo con el motor de reglas
        evaluacion = SistemaReglasAduaneras.procesar_factura_completa(factura_mock)
        
        # Preparar los ítems con las partidas sugeridas
        items_evaluados = []
        for d in datos_extraidos["detalles"]:
            items_evaluados.append({
                "descripcion_producto": d["descripcion_producto"],
                "cantidad": d["cantidad"],
                "precio_unitario": d["precio_unitario"],
                "partida_sugerida": d.get("partida_arancelaria_sugerida", "0000.00.00.00")
            })

        # Guardar en el historial de documentos procesados (si está activado)
        doc_id = None
        if guardar:
            try:
                nuevo_log = modelos.DocumentoProcesado(
                    nombre_archivo=file.filename,
                    proveedor=datos_extraidos["emisor"].get("nombre", "Desconocido"),
                    cliente=datos_extraidos["receptor"].get("nombre", "Importador"),
                    total_cif=datos_extraidos.get("monto_total_cif", 0),
                    riesgo=evaluacion.nivel_riesgo_general,
                    usuario_id=current_user.id
                )
                db.add(nuevo_log)
                
                auditoria_log = modelos.Auditoria(
                    accion="Análisis de Documento",
                    detalles=f"Extracción y evaluación de riesgo para '{file.filename}'.",
                    usuario_id=current_user.id
                )
                db.add(auditoria_log)
                
                await db.commit()
                await db.refresh(nuevo_log)
                doc_id = nuevo_log.id
            except Exception as db_exception:
                print(f"Error guardando historial en BD: {str(db_exception)}")

        # Armar la respuesta para el frontend
        return {
            "id": doc_id,
            "remitente": {
                "nombre": datos_extraidos["emisor"].get("nombre", "No detectado"),
                "direccion": datos_extraidos["emisor"].get("direccion", "No detectada"), 
                "documento": datos_extraidos["emisor"].get("tax_id", "No detectado")
            },
            "destinatario": {
                "nombre": datos_extraidos["receptor"].get("nombre", "Importador"),
                "direccion": datos_extraidos["receptor"].get("direccion", "No detectada"),
                "documento": datos_extraidos["receptor"].get("tax_id", "No detectado")
            },
            "factura": {
                "numero": datos_extraidos["numero_factura"],
                "fecha": datos_extraidos["fecha_emision"],
                "moneda": datos_extraidos["moneda"],
                "incoterm": datos_extraidos.get("incoterm"),
                "pais_origen": datos_extraidos.get("pais_origen")
            },
            "transporte": {
                "paisOrigen": datos_extraidos["emisor"].get("pais", "No detectado"),
                "metodo": "No detectado",
                "courier": "No detectado",
                "tracking": "No detectado"
            },
            "economia": {
                "total": datos_extraidos.get("monto_total_cif", 0),
                "subtotal": datos_extraidos.get("monto_subtotal", 0),
                "envio": datos_extraidos.get("monto_flete", 0),
                "seguro": datos_extraidos.get("monto_seguro", 0),
                "otros": datos_extraidos.get("monto_otros_gastos", 0)
            },
            "logistica": {
                "peso_bruto": datos_extraidos.get("pesos", {}).get("bruto", 0),
                "peso_neto": datos_extraidos.get("pesos", {}).get("neto", 0),
                "unidad_peso": datos_extraidos.get("pesos", {}).get("unidad", "kg")
            },
            "riesgo": evaluacion.nivel_riesgo_general,
            "observaciones": evaluacion.observaciones,
            "partidaPrincipal": items_evaluados[0]["partida_sugerida"] if items_evaluados else "No detectada", 
            "detalles": items_evaluados,
            "validacion_error": datos_extraidos.get("validacion_error", False),
            "mensaje_error": datos_extraidos.get("mensaje_error", ""),
            "ai_usage": datos_extraidos.get("_ai_metadata")
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error procesando el PDF: {str(e)}"
        )

@router.post("/scan-multi")
async def escanear_multiples_documentos(
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: modelos.Usuario = Depends(get_current_user)
):
    """
    Recibe múltiples PDFs (Factura, BL, Packing List, etc.), extrae sus datos
    y realiza una validación cruzada.
    """
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="Se requieren al menos 2 documentos para la validación cruzada.")
    if len(files) > 5:
        raise HTTPException(status_code=400, detail="Máximo 5 documentos permitidos.")
        
    for f in files:
        if not f.filename.endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Solo se admiten archivos PDF.")
            
    try:
        files_bytes = [await f.read() for f in files]
        resultado = await ExtractorService.cross_validate(files_bytes)
        
        # Auditoría
        log = modelos.Auditoria(
            accion="Validación Cruzada",
            detalles=f"Se realizó validación cruzada de {len(files)} documentos.",
            usuario_id=current_user.id
        )
        db.add(log)
        await db.commit()
        
        return {"status": "success", "data": resultado}
    except Exception as e:
        print(f"Error general en validación cruzada: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado durante la validación: {str(e)}"
        )


@router.get("/historial", response_model=List[esquemas.DocumentoProcesadoResponse])
async def obtener_historial_escaneos(
    db: AsyncSession = Depends(get_db), 
    current_user: modelos.Usuario = Depends(get_current_user)
):
    """Devuelve el historial de documentos procesados por el usuario actual."""
    result = await db.execute(
        select(modelos.DocumentoProcesado)
        .filter(modelos.DocumentoProcesado.usuario_id == current_user.id)
        .order_by(desc(modelos.DocumentoProcesado.fecha_analisis))
    )
    historial = result.scalars().all()
    return historial


class AprobarPayload(BaseModel):
    nuevo_total: float = None
    solicitar_revision: bool = False


@router.put("/{factura_id}/aprobar")
async def aprobar_factura(
    factura_id: int, 
    payload: AprobarPayload,
    db: AsyncSession = Depends(get_db),
    current_user: modelos.Usuario = Depends(get_current_user)
):
    """Marca un documento como aprobado o pendiente de revisión superior."""
    # Obtener el rol del usuario actual
    result_rol = await db.execute(select(modelos.Rol).filter(modelos.Rol.id == current_user.rol_id))
    rol = result_rol.scalars().first()
    is_admin = rol and rol.nombre == "Administrador"

    # Si es admin, puede aprobar cualquier documento. Si es agente, solo los suyos.
    if is_admin:
        result = await db.execute(
            select(modelos.DocumentoProcesado).filter(modelos.DocumentoProcesado.id == factura_id)
        )
    else:
        result = await db.execute(
            select(modelos.DocumentoProcesado)
            .filter(modelos.DocumentoProcesado.id == factura_id)
            .filter(modelos.DocumentoProcesado.usuario_id == current_user.id)
        )
    
    doc = result.scalars().first()
    
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El documento no existe o no tienes permisos para modificarlo."
        )
        
    if payload.nuevo_total is not None:
        doc.total_cif = payload.nuevo_total
        
    if payload.solicitar_revision and not is_admin:
        doc.estado = "Pendiente Aprobación Admin"
        mensaje = "Operación enviada a revisión superior (Riesgo Alto)."
        auditoria_log = modelos.Auditoria(
            accion="Solicitud de Revisión",
            detalles=f"Documento '{doc.nombre_archivo}' (ID: {doc.id}) enviado a revisión superior.",
            usuario_id=current_user.id
        )
        # Notificar a todos los admins
        admins_result = await db.execute(
            select(modelos.Usuario)
            .join(modelos.Rol)
            .filter(modelos.Rol.nombre == "Administrador")
        )
        for admin_user in admins_result.scalars().all():
            notif = modelos.Notificacion(
                titulo="Solicitud de Revisión",
                mensaje=f"{current_user.nombre} solicita revisión del documento '{doc.nombre_archivo}' (Riesgo Alto).",
                tipo="alerta",
                documento_id=doc.id,
                usuario_destino_id=admin_user.id,
                usuario_origen_id=current_user.id
            )
            db.add(notif)
    else:
        doc.estado = "Aprobado (Validado)"
        mensaje = "Documento aprobado y sincronizado con éxito."
        auditoria_log = modelos.Auditoria(
            accion="Aprobación de Documento",
            detalles=f"Documento '{doc.nombre_archivo}' (ID: {doc.id}) aprobado. Total CIF: {doc.total_cif}",
            usuario_id=current_user.id
        )
        # Notificar al dueño del documento
        if doc.usuario_id and doc.usuario_id != current_user.id:
            notif = modelos.Notificacion(
                titulo="Documento Aprobado",
                mensaje=f"Tu documento '{doc.nombre_archivo}' ha sido aprobado por {current_user.nombre}.",
                tipo="aprobacion",
                documento_id=doc.id,
                usuario_destino_id=doc.usuario_id,
                usuario_origen_id=current_user.id
            )
            db.add(notif)
        
    db.add(auditoria_log)
    await db.commit()
    return {"mensaje": mensaje}


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_documento(
    doc_id: int, 
    db: AsyncSession = Depends(get_db),
    current_user: modelos.Usuario = Depends(get_current_user)
):
    """Elimina un documento del historial. Solo el dueño puede hacerlo."""
    result = await db.execute(
        select(modelos.DocumentoProcesado)
        .filter(modelos.DocumentoProcesado.id == doc_id)
        .filter(modelos.DocumentoProcesado.usuario_id == current_user.id)
    )
    doc = result.scalars().first()
    
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El documento no existe o no tienes permisos para eliminarlo."
        )
    
    auditoria_log = modelos.Auditoria(
        accion="Eliminación de Documento",
        detalles=f"Documento '{doc.nombre_archivo}' (ID: {doc.id}) eliminado.",
        usuario_id=current_user.id
    )
    db.add(auditoria_log)
    await db.delete(doc)
    await db.commit()
    return None


# ════════════════════════════════════════════════════════════════════
# OBSERVACIONES POR DOCUMENTO
# ════════════════════════════════════════════════════════════════════

@router.get("/{doc_id}/observaciones")
async def obtener_observaciones(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: modelos.Usuario = Depends(get_current_user)
):
    """Obtiene las observaciones de un documento."""
    result = await db.execute(
        select(
            modelos.Observacion.id,
            modelos.Observacion.contenido,
            modelos.Observacion.tipo,
            modelos.Observacion.fecha_creacion,
            modelos.Observacion.usuario_id,
            modelos.Usuario.nombre.label("usuario_nombre")
        )
        .join(modelos.Usuario, modelos.Observacion.usuario_id == modelos.Usuario.id)
        .filter(modelos.Observacion.documento_id == doc_id)
        .order_by(desc(modelos.Observacion.fecha_creacion))
    )
    rows = result.mappings().all()
    return [
        {
            "id": r["id"],
            "contenido": r["contenido"],
            "tipo": r["tipo"],
            "fecha_creacion": r["fecha_creacion"].isoformat(),
            "usuario_id": r["usuario_id"],
            "usuario_nombre": r["usuario_nombre"]
        }
        for r in rows
    ]


@router.post("/{doc_id}/observaciones", status_code=status.HTTP_201_CREATED)
async def crear_observacion(
    doc_id: int,
    obs: esquemas.ObservacionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: modelos.Usuario = Depends(get_current_user)
):
    """Crea una nueva observación vinculada a un documento."""
    # Verificar que el documento existe
    result = await db.execute(
        select(modelos.DocumentoProcesado).filter(modelos.DocumentoProcesado.id == doc_id)
    )
    doc = result.scalars().first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")

    nueva_obs = modelos.Observacion(
        contenido=obs.contenido,
        tipo=obs.tipo,
        documento_id=doc_id,
        usuario_id=current_user.id
    )
    db.add(nueva_obs)

    # Auditoría
    log = modelos.Auditoria(
        accion="Observación Agregada",
        detalles=f"Observación añadida al documento '{doc.nombre_archivo}' (ID: {doc.id}): {obs.contenido[:100]}",
        usuario_id=current_user.id
    )
    db.add(log)
    await db.commit()
    await db.refresh(nueva_obs)

    return {"id": nueva_obs.id, "mensaje": "Observación registrada correctamente."}


# ════════════════════════════════════════════════════════════════════
# CATÁLOGO INTELIGENTE DE PARTIDAS ARANCELARIAS
# ════════════════════════════════════════════════════════════════════

@router.get("/catalogo/partidas")
async def buscar_partidas(
    q: str = "",
    db: AsyncSession = Depends(get_db),
    current_user: modelos.Usuario = Depends(get_current_user)
):
    """Busca partidas arancelarias en el catálogo por descripción de producto."""
    query = select(modelos.CatalogoPartida).order_by(desc(modelos.CatalogoPartida.frecuencia_uso))
    
    if q:
        query = query.filter(modelos.CatalogoPartida.descripcion_producto.ilike(f"%{q}%"))
    
    result = await db.execute(query.limit(50))
    partidas = result.scalars().all()
    
    return [
        {
            "id": p.id,
            "descripcion_producto": p.descripcion_producto,
            "partida_arancelaria": p.partida_arancelaria,
            "frecuencia_uso": p.frecuencia_uso,
            "ultima_actualizacion": p.ultima_actualizacion.isoformat() if p.ultima_actualizacion else None
        }
        for p in partidas
    ]


@router.post("/catalogo/partidas", status_code=status.HTTP_201_CREATED)
async def registrar_partida(
    partida: esquemas.CatalogoPartidaCreate,
    db: AsyncSession = Depends(get_db),
    current_user: modelos.Usuario = Depends(get_current_user)
):
    """Registra o actualiza una partida arancelaria en el catálogo inteligente."""
    # Buscar si ya existe una entrada similar
    result = await db.execute(
        select(modelos.CatalogoPartida).filter(
            modelos.CatalogoPartida.descripcion_producto.ilike(f"%{partida.descripcion_producto}%"),
            modelos.CatalogoPartida.partida_arancelaria == partida.partida_arancelaria
        )
    )
    existente = result.scalars().first()

    if existente:
        existente.frecuencia_uso += 1
        existente.usuario_id = current_user.id
        await db.commit()
        return {"mensaje": "Partida existente actualizada.", "frecuencia": existente.frecuencia_uso}
    else:
        nueva = modelos.CatalogoPartida(
            descripcion_producto=partida.descripcion_producto,
            partida_arancelaria=partida.partida_arancelaria,
            usuario_id=current_user.id
        )
        db.add(nueva)
        await db.commit()
        return {"mensaje": "Nueva partida registrada en el catálogo."}


# ════════════════════════════════════════════════════════════════════
# NOTIFICACIONES IN-APP
# ════════════════════════════════════════════════════════════════════

@router.get("/notificaciones/mis")
async def obtener_mis_notificaciones(
    db: AsyncSession = Depends(get_db),
    current_user: modelos.Usuario = Depends(get_current_user)
):
    """Obtiene las notificaciones del usuario actual."""
    result = await db.execute(
        select(modelos.Notificacion)
        .filter(modelos.Notificacion.usuario_destino_id == current_user.id)
        .order_by(desc(modelos.Notificacion.fecha_creacion))
        .limit(30)
    )
    notifs = result.scalars().all()
    
    return [
        {
            "id": n.id,
            "titulo": n.titulo,
            "mensaje": n.mensaje,
            "tipo": n.tipo,
            "leida": n.leida,
            "fecha_creacion": n.fecha_creacion.isoformat(),
            "documento_id": n.documento_id
        }
        for n in notifs
    ]


@router.patch("/notificaciones/{notif_id}/leer")
async def marcar_notificacion_leida(
    notif_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: modelos.Usuario = Depends(get_current_user)
):
    """Marca una notificación como leída."""
    result = await db.execute(
        select(modelos.Notificacion)
        .filter(modelos.Notificacion.id == notif_id)
        .filter(modelos.Notificacion.usuario_destino_id == current_user.id)
    )
    notif = result.scalars().first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notificación no encontrada.")
    
    notif.leida = True
    await db.commit()
    return {"mensaje": "Notificación marcada como leída."}


@router.patch("/notificaciones/leer-todas")
async def marcar_todas_leidas(
    db: AsyncSession = Depends(get_db),
    current_user: modelos.Usuario = Depends(get_current_user)
):
    """Marca todas las notificaciones del usuario como leídas."""
    from sqlalchemy import update
    await db.execute(
        update(modelos.Notificacion)
        .where(modelos.Notificacion.usuario_destino_id == current_user.id)
        .where(modelos.Notificacion.leida == False)
        .values(leida=True)
    )
    await db.commit()
    return {"mensaje": "Todas las notificaciones marcadas como leídas."}


# ════════════════════════════════════════════════════════════════════
# PERFIL DE RIESGO POR PROVEEDOR
# ════════════════════════════════════════════════════════════════════

@router.get("/proveedores/perfiles")
async def obtener_perfiles_proveedores(
    db: AsyncSession = Depends(get_db),
    current_user: modelos.Usuario = Depends(get_current_user)
):
    """Genera el perfil de riesgo de cada proveedor basado en datos históricos."""
    from sqlalchemy import func, case

    result = await db.execute(
        select(
            modelos.DocumentoProcesado.proveedor,
            func.count(modelos.DocumentoProcesado.id).label("total_operaciones"),
            func.sum(case((modelos.DocumentoProcesado.riesgo == "alto", 1), else_=0)).label("riesgo_alto"),
            func.sum(case((modelos.DocumentoProcesado.riesgo == "medio", 1), else_=0)).label("riesgo_medio"),
            func.sum(case((modelos.DocumentoProcesado.riesgo == "bajo", 1), else_=0)).label("riesgo_bajo"),
            func.avg(modelos.DocumentoProcesado.total_cif).label("promedio_cif"),
            func.max(modelos.DocumentoProcesado.fecha_analisis).label("ultima_operacion"),
        )
        .filter(modelos.DocumentoProcesado.proveedor.isnot(None))
        .group_by(modelos.DocumentoProcesado.proveedor)
        .order_by(desc(func.count(modelos.DocumentoProcesado.id)))
    )
    rows = result.mappings().all()

    perfiles = []
    for r in rows:
        total = r["total_operaciones"]
        alto = r["riesgo_alto"] or 0
        tasa_riesgo = round((alto / total * 100), 1) if total > 0 else 0
        
        # Determinar nivel de riesgo general del proveedor
        if tasa_riesgo >= 50:
            nivel = "critico"
        elif tasa_riesgo >= 25:
            nivel = "elevado"
        elif alto > 0:
            nivel = "moderado"
        else:
            nivel = "confiable"
        
        perfiles.append({
            "proveedor": r["proveedor"],
            "total_operaciones": total,
            "riesgo_alto": alto,
            "riesgo_medio": r["riesgo_medio"] or 0,
            "riesgo_bajo": r["riesgo_bajo"] or 0,
            "tasa_riesgo_porcentaje": tasa_riesgo,
            "nivel_proveedor": nivel,
            "promedio_cif": round(r["promedio_cif"] or 0, 2),
            "ultima_operacion": r["ultima_operacion"].isoformat() if r["ultima_operacion"] else None,
        })

    return perfiles

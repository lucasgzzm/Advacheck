from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean, Enum
from sqlalchemy.orm import relationship, backref
import enum
from .base_datos import Base

# --- Enumeraciones para estados tipificados ---

class NivelRiesgo(str, enum.Enum):
    """Niveles de riesgo para clasificar operaciones (bajo, medio, alto)."""
    BAJO = "bajo"
    MEDIO = "medio"
    ALTO = "alto"

class EstadoEnvio(str, enum.Enum):
    """Estados posibles de un envío durante su ciclo de vida."""
    REVISION = "en_revision"
    APROBADO = "aprobado"
    OBSERVADO = "observado"


# --- Modelos de la base de datos (Normalización 3NF) ---

class Rol(Base):
    """Tabla de roles del sistema (Administrador, Agente, etc.)."""
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(50), unique=True, nullable=False)
    descripcion = Column(String(200), nullable=True)

    usuarios_rel = relationship("Usuario", back_populates="rol_rel")


class Usuario(Base):
    """Usuarios registrados en la plataforma."""
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(150), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    contrasena_hash = Column("hashed_password", String(255), nullable=False)
    activo = Column(Boolean, default=True)
    
    # Relación con el rol asignado
    rol_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    
    rol_rel = relationship("Rol", back_populates="usuarios_rel")
    auditoria_rel = relationship("Auditoria", back_populates="usuario_rel")


class Cliente(Base):
    """Registro de importadores/exportadores (cartera de clientes del agente)."""
    __tablename__ = "clientes"

    id = Column(Integer, primary_key=True, index=True)
    razon_social = Column(String(255), nullable=False)
    identificacion_fiscal = Column(String(50), index=True, nullable=False)
    direccion = Column(String(500), nullable=True)
    email = Column(String(255), nullable=True)
    telefono = Column(String(50), nullable=True)
    contacto_nombre = Column(String(255), nullable=True)
    activo = Column(Boolean, default=True)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)

    usuario_rel = relationship("Usuario")

    envios_rel = relationship("Envio", back_populates="cliente_rel")


# ─── DEPRECATED MODELS ──────────────────────────────────────────────
# Las tablas envios, facturas y factura_detalles corresponden a la
# versión anterior del sistema (antes de la migración a DocumentoProcesado/Partida).
# Se mantienen para no romper queries históricas, pero no se usan en
# nueva funcionalidad. Migrar datos existentes cuando sea posible.


class Envio(Base):
    """[DEPRECATED] Cabecera logística que agrupa una o varias facturas de importación.
    
    Usar DocumentoProcesado en lugar de esta tabla para toda funcionalidad nueva.
    """
    __tablename__ = "envios"

    id = Column(Integer, primary_key=True, index=True)
    referencia_operativa = Column(String(100), unique=True, index=True, nullable=False)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    estado = Column(String(20), default=EstadoEnvio.REVISION.value, nullable=False)
    
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    
    cliente_rel = relationship("Cliente", back_populates="envios_rel")
    facturas_rel = relationship("Factura", back_populates="envio_rel")


class Factura(Base):
    """[DEPRECATED] Cabecera del documento comercial (factura de importación).
    
    Usar DocumentoProcesado en lugar de esta tabla para toda funcionalidad nueva.
    """
    __tablename__ = "facturas"

    id = Column(Integer, primary_key=True, index=True)
    numero_factura = Column(String(100), index=True, nullable=False)
    fecha_emision = Column(DateTime, nullable=True)
    monto_total = Column(Float, nullable=True)
    moneda = Column(String(10), default="USD")
    emisor_nombre = Column(String(255), nullable=True)
    
    # Campos calculados por el motor de reglas
    riesgo_calculado = Column(String(20), default=NivelRiesgo.MEDIO.value)
    observaciones_riesgo = Column(String(500), nullable=True)
    pre_aprobada = Column(Boolean, default=False)
    
    envio_id = Column(Integer, ForeignKey("envios.id"), nullable=False)
    
    envio_rel = relationship("Envio", back_populates="facturas_rel")
    detalles_rel = relationship("FacturaDetalle", back_populates="factura_rel")


class FacturaDetalle(Base):
    """[DEPRECATED] Líneas individuales (ítems/productos) dentro de una factura.
    
    Usar Partida en lugar de esta tabla para toda funcionalidad nueva.
    """
    __tablename__ = "factura_detalles"

    id = Column(Integer, primary_key=True, index=True)
    descripcion_producto = Column(String(500), nullable=False)
    cantidad = Column(Float, nullable=False)
    precio_unitario = Column(Float, nullable=False)
    
    # Partida arancelaria: sugerida por el sistema y corregida manualmente
    partida_arancelaria_sugerida = Column(String(50), nullable=True)
    partida_arancelaria_corregida = Column(String(50), nullable=True)
    
    inconsistente = Column(Boolean, default=False)
    
    factura_id = Column(Integer, ForeignKey("facturas.id"), nullable=False)
    
    factura_rel = relationship("Factura", back_populates="detalles_rel")


class Auditoria(Base):
    """Registro de acciones realizadas por los usuarios para trazabilidad."""
    __tablename__ = "auditoria"

    id = Column(Integer, primary_key=True, index=True)
    fecha_accion = Column(DateTime, default=datetime.utcnow)
    accion = Column(String(255), nullable=False)
    detalles = Column(String(1000), nullable=True)
    
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    
    usuario_rel = relationship("Usuario", back_populates="auditoria_rel")


class DocumentoProcesado(Base):
    """Historial de documentos escaneados y procesados por el sistema."""
    __tablename__ = "documentos_procesados"

    id = Column(Integer, primary_key=True, index=True)
    nombre_archivo = Column(String(255), nullable=False)
    fecha_analisis = Column(DateTime, default=datetime.utcnow)
    proveedor = Column(String(255), nullable=True)
    cliente = Column(String(255), nullable=True)
    total_cif = Column(Float, nullable=True)
    riesgo = Column(String(50), nullable=True)
    estado = Column(String(50), default="En Revisión")
    bloqueado = Column(Boolean, default=False)
    fecha_bloqueo = Column(DateTime, nullable=True)
    bloqueado_por_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    
    # ID del usuario que procesó el documento
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    usuario_rel = relationship("Usuario", foreign_keys=[usuario_id])
    observaciones_rel = relationship("Observacion", back_populates="documento_rel", cascade="all, delete-orphan")
    notificaciones_rel = relationship("Notificacion", back_populates="documento_rel", cascade="all, delete-orphan")
    ruta_archivo = Column(String(512), nullable=True)
    estado_aduanero = Column(String(50), default="En Revision")
    fecha_presentacion = Column(DateTime, nullable=True)
    fecha_aforo_documental = Column(DateTime, nullable=True)
    fecha_aforo_fisico = Column(DateTime, nullable=True)
    fecha_liquidacion = Column(DateTime, nullable=True)
    fecha_liberacion = Column(DateTime, nullable=True)
    bloqueado_por_rel = relationship("Usuario", foreign_keys=[bloqueado_por_id])
    
    # Columnas financieras para landed cost
    flete = Column(Float, nullable=True)
    seguro = Column(Float, nullable=True)
    otros = Column(Float, nullable=True)

    dua_generado = Column(Boolean, default=False)

    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=True)
    cliente_rel = relationship("Cliente")

    despachante_id = Column(Integer, ForeignKey("despachantes.id"), nullable=True)
    despachante_rel = relationship("Despachante", back_populates="documentos_rel")


class Observacion(Base):
    """Notas y observaciones vinculadas a un documento procesado."""
    __tablename__ = "observaciones"

    id = Column(Integer, primary_key=True, index=True)
    contenido = Column(String(2000), nullable=False)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    tipo = Column(String(50), default="nota")  # nota, alerta, correccion
    
    documento_id = Column(Integer, ForeignKey("documentos_procesados.id"), nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    
    documento_rel = relationship("DocumentoProcesado", back_populates="observaciones_rel")
    usuario_rel = relationship("Usuario")


class CatalogoPartida(Base):
    """Memoria inteligente de clasificaciones arancelarias corregidas por humanos."""
    __tablename__ = "catalogo_partidas"

    id = Column(Integer, primary_key=True, index=True)
    descripcion_producto = Column(String(500), nullable=False, index=True)
    partida_arancelaria = Column(String(50), nullable=False)
    frecuencia_uso = Column(Integer, default=1)
    ultima_actualizacion = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Quién lo clasificó por última vez
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    usuario_rel = relationship("Usuario")


class VistoBueno(Base):
    """Regulaciones y Restricciones No Arancelarias (RRNA) requeridas por partida.
    Cada documento puede requerir múltiples V°B° de distintas entidades regulatorias."""
    __tablename__ = "vistos_buenos"

    id = Column(Integer, primary_key=True, index=True)
    entidad = Column(String(100), nullable=False)  # ej: COFEPRIS, ISP, SENASA, SCT, IFT
    tipo_permiso = Column(String(100), nullable=False)  # ej: Certificado Sanitario, Registro Sanitario, Permiso Ambiental
    estado = Column(String(50), default="pendiente")  # pendiente, aprobado, rechazado, no_requerido
    fecha_gestion = Column(DateTime, nullable=True)
    observaciones = Column(String(1000), nullable=True)
    archivo_nombre = Column(String(255), nullable=True)

    documento_id = Column(Integer, ForeignKey("documentos_procesados.id"), nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)

    documento_rel = relationship("DocumentoProcesado", backref="vistos_buenos_rel")
    usuario_rel = relationship("Usuario")


class Notificacion(Base):
    """Notificaciones in-app para comunicación entre admin y analistas."""
    __tablename__ = "notificaciones"

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String(255), nullable=False)
    mensaje = Column(String(1000), nullable=False)
    tipo = Column(String(50), default="info")  # info, aprobacion, rechazo, alerta
    leida = Column(Boolean, default=False)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    
    # Enlace opcional al documento relacionado
    documento_id = Column(Integer, ForeignKey("documentos_procesados.id"), nullable=True)
    documento_rel = relationship("DocumentoProcesado", back_populates="notificaciones_rel")
    
    # A quién va dirigida
    usuario_destino_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    # Quién la generó (sistema o admin)
    usuario_origen_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    
    usuario_destino_rel = relationship("Usuario", foreign_keys=[usuario_destino_id])
    usuario_origen_rel = relationship("Usuario", foreign_keys=[usuario_origen_id])


class Garantia(Base):
    """Garantías, pólizas o seguros vinculados a un documento aduanero."""
    __tablename__ = "garantias"

    id = Column(Integer, primary_key=True, index=True)
    tipo = Column(String(50), nullable=False)  # Poliza, Seguro, Boleta, Garantia
    numero = Column(String(100), nullable=False)
    monto = Column(Float, nullable=False)
    moneda = Column(String(10), default="USD")
    fecha_emision = Column(DateTime, nullable=True)
    fecha_vencimiento = Column(DateTime, nullable=True)
    estado = Column(String(50), default="Vigente")  # Vigente, Vencida, Ejecutada
    emisor = Column(String(255), nullable=True)
    observaciones = Column(String(1000), nullable=True)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)

    documento_id = Column(Integer, ForeignKey("documentos_procesados.id"), nullable=False)
    documento_rel = relationship("DocumentoProcesado", backref="garantias_rel")


class Partida(Base):
    """Ítems/líneas de un documento procesado."""
    __tablename__ = "partidas"

    id = Column(Integer, primary_key=True, index=True)
    documento_id = Column(Integer, ForeignKey("documentos_procesados.id"), nullable=False)
    descripcion = Column(String(500), nullable=True)
    cantidad = Column(Float, nullable=True)
    precio_unitario = Column(Float, nullable=True)
    partida_sugerida = Column(String(50), nullable=True)
    partida_corregida = Column(String(50), nullable=True)
    orden = Column(Integer, nullable=True)

    documento_rel = relationship("DocumentoProcesado", backref=backref("partidas", cascade="all, delete-orphan"))


class Despachante(Base):
    """Agentes de aduana / despachantes vinculados a documentos."""
    __tablename__ = "despachantes"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(255), nullable=False)
    rut = Column(String(50), nullable=True)
    telefono = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    direccion = Column(String(500), nullable=True)
    activo = Column(Boolean, default=True)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)

    documentos_rel = relationship("DocumentoProcesado", back_populates="despachante_rel")


class ReglaConfiguracion(Base):
    """Configuración dinámica de reglas del motor de validación aduanera."""
    __tablename__ = "reglas_configuracion"

    id = Column(Integer, primary_key=True, index=True)
    nombre_regla = Column(String(100), unique=True, nullable=False, index=True)
    nombre_mostrar = Column(String(255), nullable=False)
    descripcion = Column(String(1000), nullable=True)
    activa = Column(Boolean, default=True)
    severidad = Column(String(50), default="BLOQUEANTE", nullable=False)
    parametros = Column(String(2000), nullable=True)
    ultima_modificacion = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    modificado_por_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    modificado_por_rel = relationship("Usuario")


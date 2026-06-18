from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean, Enum, JSON
from sqlalchemy.orm import relationship, backref
import enum
from .base_datos import Base

# Valores posibles para el nivel de riesgo de un documento
class NivelRiesgo(str, enum.Enum):
    BAJO = "bajo"
    MEDIO = "medio"
    ALTO = "alto"

# Almacena los roles del sistema (Administrador, Usuario, etc)
class Rol(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(50), unique=True, nullable=False)
    descripcion = Column(String(200), nullable=True)

    usuarios_rel = relationship("Usuario", back_populates="rol_rel")

# Representa un usuario registrado en el sistema
class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(150), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    contrasena_hash = Column("hashed_password", String(255), nullable=False)
    activo = Column(Boolean, default=True)

    rol_id = Column(Integer, ForeignKey("roles.id"), nullable=False)

    rol_rel = relationship("Rol", back_populates="usuarios_rel")
    auditoria_rel = relationship("Auditoria", back_populates="usuario_rel")

# Representa un cliente asociado a documentos de importacion
class Cliente(Base):
    __tablename__ = "clientes"

    id = Column(Integer, primary_key=True, index=True)
    razon_social = Column(String(255), nullable=False)
    identificacion_fiscal = Column(String(50), index=True, nullable=False)
    direccion = Column(String(500), nullable=True)
    email = Column(String(255), nullable=True)
    telefono = Column(String(50), nullable=True)
    contacto_nombre = Column(String(255), nullable=True)
    activo = Column(Boolean, default=True)
    fecha_creacion = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)

    usuario_rel = relationship("Usuario")

# Registro de auditoria para rastrear acciones de los usuarios
class Auditoria(Base):
    __tablename__ = "auditoria"

    id = Column(Integer, primary_key=True, index=True)
    fecha_accion = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    accion = Column(String(255), nullable=False)
    detalles = Column(String(1000), nullable=True)

    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)

    usuario_rel = relationship("Usuario", back_populates="auditoria_rel")

# Almacena documentos de importacion procesados con sus metadatos
class DocumentoProcesado(Base):
    __tablename__ = "documentos_procesados"

    id = Column(Integer, primary_key=True, index=True)
    nombre_archivo = Column(String(255), nullable=False)
    fecha_analisis = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    proveedor = Column(String(255), nullable=True)
    cliente = Column(String(255), nullable=True)
    total_cif = Column(Float, nullable=True)
    riesgo = Column(String(50), nullable=True)
    estado = Column(String(50), default="En Revisión")
    bloqueado = Column(Boolean, default=False)
    fecha_bloqueo = Column(DateTime, nullable=True)
    bloqueado_por_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)

    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    usuario_rel = relationship("Usuario", foreign_keys=[usuario_id])
    observaciones_rel = relationship("Observacion", back_populates="documento_rel", cascade="all, delete-orphan")
    ruta_archivo = Column(String(512), nullable=True)
    estado_aduanero = Column(String(50), default="En Revision")
    fecha_presentacion = Column(DateTime, nullable=True)
    fecha_aforo_documental = Column(DateTime, nullable=True)
    fecha_aforo_fisico = Column(DateTime, nullable=True)
    fecha_liquidacion = Column(DateTime, nullable=True)
    fecha_liberacion = Column(DateTime, nullable=True)
    bloqueado_por_rel = relationship("Usuario", foreign_keys=[bloqueado_por_id])

    flete = Column(Float, nullable=True)
    seguro = Column(Float, nullable=True)
    otros = Column(Float, nullable=True)

    dua_generado = Column(Boolean, default=False)

    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=True)
    cliente_rel = relationship("Cliente")

    fecha_emision = Column(String(50), nullable=True)
    moneda = Column(String(10), nullable=True)
    monto_subtotal = Column(Float, nullable=True)
    remitente_dir = Column(String(500), nullable=True)
    remitente_doc = Column(String(100), nullable=True)
    destinatario_dir = Column(String(500), nullable=True)
    transporte_pais = Column(String(100), nullable=True)
    transporte_metodo = Column(String(100), nullable=True)
    peso_bruto = Column(Float, nullable=True)
    peso_neto = Column(Float, nullable=True)
    receptor_tax = Column(String(100), nullable=True)

    numero_factura = Column(String(100), nullable=True)
    incoterm = Column(String(10), nullable=True)
    pais_origen = Column(String(100), nullable=True)

    hash_pdf = Column(String(64), nullable=True, index=True)

    datos_originales = Column(JSON, nullable=True)

    prevalidacion_resultado = Column(JSON, nullable=True)

# Notas u observaciones asociadas a un documento procesado
class Observacion(Base):
    __tablename__ = "observaciones"

    id = Column(Integer, primary_key=True, index=True)
    contenido = Column(String(2000), nullable=False)
    fecha_creacion = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    tipo = Column(String(50), default="nota")

    documento_id = Column(Integer, ForeignKey("documentos_procesados.id"), nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)

    documento_rel = relationship("DocumentoProcesado", back_populates="observaciones_rel")
    usuario_rel = relationship("Usuario")

# Catalogo de partidas arancelarias con frecuencia de uso
class CatalogoPartida(Base):
    __tablename__ = "catalogo_partidas"

    id = Column(Integer, primary_key=True, index=True)
    descripcion_producto = Column(String(500), nullable=False, index=True)
    partida_arancelaria = Column(String(50), nullable=False)
    frecuencia_uso = Column(Integer, default=1)
    ultima_actualizacion = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    usuario_rel = relationship("Usuario")

# Permisos o autorizaciones regulatorias vinculadas a un documento
class VistoBueno(Base):
    __tablename__ = "vistos_buenos"

    id = Column(Integer, primary_key=True, index=True)
    entidad = Column(String(100), nullable=False)
    tipo_permiso = Column(String(100), nullable=False)
    estado = Column(String(50), default="pendiente")
    fecha_gestion = Column(DateTime, nullable=True)
    observaciones = Column(String(1000), nullable=True)
    archivo_nombre = Column(String(255), nullable=True)

    documento_id = Column(Integer, ForeignKey("documentos_procesados.id"), nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)

    documento_rel = relationship("DocumentoProcesado", backref="vistos_buenos_rel")
    usuario_rel = relationship("Usuario")

# Lineas o items individuales dentro de un documento procesado
class Partida(Base):
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

# Reglas de prevalidacion configurables por el administrador
class ReglaConfiguracion(Base):
    __tablename__ = "reglas_configuracion"

    id = Column(Integer, primary_key=True, index=True)
    nombre_regla = Column(String(100), unique=True, nullable=False, index=True)
    nombre_mostrar = Column(String(255), nullable=False)
    descripcion = Column(String(1000), nullable=True)
    activa = Column(Boolean, default=True)
    severidad = Column(String(50), default="BLOQUEANTE", nullable=False)
    parametros = Column(String(2000), nullable=True)
    ultima_modificacion = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    modificado_por_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    modificado_por_rel = relationship("Usuario")

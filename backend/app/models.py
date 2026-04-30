from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean, Enum
from sqlalchemy.orm import relationship
import enum
from .database import Base

# --- Enumeraciones para estados tipificados ---

class NivelRiesgo(str, enum.Enum):
    BAJO = "bajo"
    MEDIO = "medio"
    ALTO = "alto"

class EstadoEnvio(str, enum.Enum):
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
    hashed_password = Column(String(255), nullable=False)
    activo = Column(Boolean, default=True)
    
    # Relación con el rol asignado
    rol_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    
    rol_rel = relationship("Rol", back_populates="usuarios_rel")
    auditoria_rel = relationship("Auditoria", back_populates="usuario_rel")


class Cliente(Base):
    """Registro de operadores comerciales o importadores."""
    __tablename__ = "clientes"

    id = Column(Integer, primary_key=True, index=True)
    razon_social = Column(String(255), unique=True, index=True, nullable=False)
    identificacion_fiscal = Column(String(50), unique=True, nullable=False)
    direccion = Column(String(500), nullable=True)

    envios_rel = relationship("Envio", back_populates="cliente_rel")


class Envio(Base):
    """Cabecera logística que agrupa una o varias facturas de importación."""
    __tablename__ = "envios"

    id = Column(Integer, primary_key=True, index=True)
    referencia_operativa = Column(String(100), unique=True, index=True, nullable=False)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    estado = Column(String(20), default=EstadoEnvio.REVISION.value, nullable=False)
    
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    
    cliente_rel = relationship("Cliente", back_populates="envios_rel")
    facturas_rel = relationship("Factura", back_populates="envio_rel")


class Factura(Base):
    """Cabecera del documento comercial (factura de importación)."""
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
    """Líneas individuales (ítems/productos) dentro de una factura."""
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
    
    # ID del usuario que procesó el documento
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    usuario_rel = relationship("Usuario")

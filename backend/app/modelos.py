from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean, Enum, JSON
from sqlalchemy.orm import relationship, backref
import enum
from .base_datos import Base

# --- Enumeraciones para estados tipificados ---

class NivelRiesgo(str, enum.Enum):
    """Los tres niveles de riesgo que se le asigna a cada operacion: bajo, medio o alto."""
    BAJO = "bajo"
    MEDIO = "medio"
    ALTO = "alto"


# --- Modelos de la base de datos ---

class Rol(Base):
    """Roles del sistema: Administrador, Agente de Aduana, etc.
    Cada rol tiene distintos permisos en la plataforma.
    """
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(50), unique=True, nullable=False)
    descripcion = Column(String(200), nullable=True)

    usuarios_rel = relationship("Usuario", back_populates="rol_rel")


class Usuario(Base):
    """Usuarios registrados en la plataforma. Cada uno tiene un rol y puede
    procesar documentos, ver historial, etc. segun su permiso.
    """
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(150), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    contrasena_hash = Column("hashed_password", String(255), nullable=False)
    activo = Column(Boolean, default=True)

    rol_id = Column(Integer, ForeignKey("roles.id"), nullable=False)

    rol_rel = relationship("Rol", back_populates="usuarios_rel")
    auditoria_rel = relationship("Auditoria", back_populates="usuario_rel")


class Cliente(Base):
    """Cartera de clientes del agente de aduana: importadores/exportadores
    para quienes se gestionan los documentos.
    """
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


class Auditoria(Base):
    """Registro de auditoria: cada accion importante que hace un usuario
    queda grabada aca para trazabilidad.
    """
    __tablename__ = "auditoria"

    id = Column(Integer, primary_key=True, index=True)
    fecha_accion = Column(DateTime, default=datetime.utcnow)
    accion = Column(String(255), nullable=False)
    detalles = Column(String(1000), nullable=True)

    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)

    usuario_rel = relationship("Usuario", back_populates="auditoria_rel")


class DocumentoProcesado(Base):
    """La tabla principal: cada fila es un documento (factura, packing list, etc.)
    que fue subido, procesado y evaluado por el sistema.
    """
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

    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    usuario_rel = relationship("Usuario", foreign_keys=[usuario_id])
    observaciones_rel = relationship("Observacion", back_populates="documento_rel", cascade="all, delete-orphan")
    notificaciones_rel = relationship("Notificacion", back_populates="documento_rel", cascade="all, delete-orphan")
    ruta_archivo = Column(String(512), nullable=True)
    estado_aduanero = Column(String(50), default="En Revision")
    # Fechas del ciclo aduanero: desde que se presenta hasta que se libera
    fecha_presentacion = Column(DateTime, nullable=True)
    fecha_aforo_documental = Column(DateTime, nullable=True)
    fecha_aforo_fisico = Column(DateTime, nullable=True)
    fecha_liquidacion = Column(DateTime, nullable=True)
    fecha_liberacion = Column(DateTime, nullable=True)
    bloqueado_por_rel = relationship("Usuario", foreign_keys=[bloqueado_por_id])

    # Datos financieros: se usan para calcular el landed cost
    flete = Column(Float, nullable=True)
    seguro = Column(Float, nullable=True)
    otros = Column(Float, nullable=True)

    dua_generado = Column(Boolean, default=False)

    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=True)
    cliente_rel = relationship("Cliente")

    despachante_id = Column(Integer, ForeignKey("despachantes.id"), nullable=True)
    despachante_rel = relationship("Despachante", back_populates="documentos_rel")

    # Datos de la factura extraídos por OCR/IA
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

    # Número real de la factura extraído por IA (no confundir con nombre_archivo)
    numero_factura = Column(String(100), nullable=True)
    # Término de comercio internacional: FOB, CIF, EXW, etc.
    incoterm = Column(String(10), nullable=True)
    # País de origen de la mercancía
    pais_origen = Column(String(100), nullable=True)

    # Datos originales extraídos por la IA: se guarda el JSON completo para
    # poder comparar qué campos modificó el usuario respecto a lo que detectó la IA
    datos_originales = Column(JSON, nullable=True)

    # Resultado completo de la prevalidación (7 etapas) para poder generar
    # informes PDF sin tener que re-ejecutar el motor de reglas
    prevalidacion_resultado = Column(JSON, nullable=True)


class Observacion(Base):
    """Notas que los usuarios agregan a un documento: comentarios, alertas, correcciones."""
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
    """Memoria de clasificaciones arancelarias: cuando un usuario corrige la partida
    de un producto, queda registrado aca para que el sistema aprenda y sugiera mejor.
    """
    __tablename__ = "catalogo_partidas"

    id = Column(Integer, primary_key=True, index=True)
    descripcion_producto = Column(String(500), nullable=False, index=True)
    partida_arancelaria = Column(String(50), nullable=False)
    frecuencia_uso = Column(Integer, default=1)
    ultima_actualizacion = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    usuario_rel = relationship("Usuario")


class VistoBueno(Base):
    """Registros de Vistos Buenos (V°B°) que necesita un documento de parte de
    entidades regulatorias como SENASA, ISP, COFEPRIS, etc.
    Cada documento puede requerir varios V°B° segun sus partidas arancelarias.
    """
    __tablename__ = "vistos_buenos"

    id = Column(Integer, primary_key=True, index=True)
    entidad = Column(String(100), nullable=False)
    tipo_permiso = Column(String(100), nullable=False)
    estado = Column(String(50), default="pendiente")  # pendiente, aprobado, rechazado, no_requerido
    fecha_gestion = Column(DateTime, nullable=True)
    observaciones = Column(String(1000), nullable=True)
    archivo_nombre = Column(String(255), nullable=True)

    documento_id = Column(Integer, ForeignKey("documentos_procesados.id"), nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)

    documento_rel = relationship("DocumentoProcesado", backref="vistos_buenos_rel")
    usuario_rel = relationship("Usuario")


class Notificacion(Base):
    """Notificaciones internas entre el administrador y los analistas.
    Por ejemplo: "Documento X necesita revision", "Y fue aprobado".
    """
    __tablename__ = "notificaciones"

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String(255), nullable=False)
    mensaje = Column(String(1000), nullable=False)
    tipo = Column(String(50), default="info")  # info, aprobacion, rechazo, alerta
    leida = Column(Boolean, default=False)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)

    documento_id = Column(Integer, ForeignKey("documentos_procesados.id"), nullable=True)
    documento_rel = relationship("DocumentoProcesado", back_populates="notificaciones_rel")

    usuario_destino_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    usuario_origen_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)

    usuario_destino_rel = relationship("Usuario", foreign_keys=[usuario_destino_id])
    usuario_origen_rel = relationship("Usuario", foreign_keys=[usuario_origen_id])


class Garantia(Base):
    """Garantias, polizas o seguros asociados a un documento aduanero.
    Por ejemplo: poliza de seguro de transporte, boleta de garantia, etc.
    """
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
    """Cada Item/producto dentro de un documento.
    Un documento puede tener muchas partidas (ej: 10 productos distintos en una factura).
    """
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
    """Agentes de aduana registrados. Se pueden asignar a documentos
    para indicar quien gestiona cada tramite.
    """
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
    """Configuracion dinamica de las reglas del motor de prevalidacion.
    Desde el panel admin se pueden activar/desactivar reglas y cambiar su severidad.
    """
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

from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime
from .modelos import NivelRiesgo, EstadoEnvio

# --- Esquemas de validación (DTOs) ---
# Definen la estructura de los datos que entran y salen de la API,
# separándolos de los modelos de la base de datos.

class FacturaDetalleBase(BaseModel):
    """Esquema base con los campos de un detalle de factura."""
    descripcion_producto: str = Field(..., description="Nombre del artículo importado")
    cantidad: float
    precio_unitario: float
    partida_arancelaria_corregida: Optional[str] = None

class FacturaDetalleCreate(FacturaDetalleBase):
    """Esquema para crear un nuevo detalle de factura."""
    pass

class FacturaDetalleResponse(FacturaDetalleBase):
    """Respuesta con los datos completos de un detalle de factura."""
    id: int
    partida_arancelaria_sugerida: Optional[str]
    inconsistente: bool

    class Config:
        """Configuración de ORM para Pydantic."""
        from_attributes = True

class FacturaBase(BaseModel):
    """Esquema base con los campos de una factura."""
    numero_factura: str
    fecha_emision: Optional[datetime]
    monto_total: Optional[float]
    moneda: str = "USD"
    incoterm: Optional[str] = None
    pais_origen: Optional[str] = None
    monto_subtotal: Optional[float] = 0
    monto_flete: Optional[float] = 0
    monto_seguro: Optional[float] = 0
    monto_otros_gastos: Optional[float] = 0
    peso_bruto: Optional[float] = 0
    peso_neto: Optional[float] = 0
    emisor_nombre: Optional[str]
    emisor_tax_id: Optional[str] = None
    receptor_nombre: Optional[str] = None
    receptor_tax_id: Optional[str] = None
    receptor_pais: Optional[str] = None

class FacturaCreate(FacturaBase):
    """Esquema para crear una factura con sus detalles."""
    detalles: List[FacturaDetalleCreate]

class FacturaResponse(FacturaBase):
    """Respuesta con datos completos de factura, incluyendo riesgo."""
    id: int
    riesgo_calculado: str
    observaciones_riesgo: Optional[str]
    pre_aprobada: bool
    detalles: List[FacturaDetalleResponse] = []

    class Config:
        """Configuración de ORM para Pydantic."""
        from_attributes = True

class EnvioBase(BaseModel):
    """Esquema base con la referencia de un envío."""
    referencia_operativa: str

class EnvioCreate(EnvioBase):
    """Esquema para crear un envío con facturas asociadas."""
    cliente_id: int
    facturas: List[FacturaCreate] = []

class EnvioResponse(EnvioBase):
    """Respuesta con datos completos del envío y sus facturas."""
    id: int
    fecha_creacion: datetime
    estado: str
    facturas: List[FacturaResponse] = []

    class Config:
        """Configuración de ORM para Pydantic."""
        from_attributes = True

# --- Esquemas de autenticación ---

class LoginRequest(BaseModel):
    """Esquema de solicitud de inicio de sesión."""
    email: EmailStr
    password: str
    remember: bool = False

class RegisterRequest(BaseModel):
    """Esquema de solicitud de registro de nuevo usuario."""
    nombre: str = Field(..., min_length=2)
    email: EmailStr
    password: str = Field(..., min_length=6)

class Token(BaseModel):
    """Esquema de respuesta con el token JWT."""
    access_token: str
    token_type: str
    user_name: str
    user_role: str

class TokenData(BaseModel):
    """Esquema de datos contenidos en el token JWT."""
    email: Optional[str] = None

class UserResponse(BaseModel):
    """Respuesta con datos públicos del usuario."""
    id: int
    nombre: str
    email: EmailStr
    rol_nombre: str
    activo: bool
    online: bool = False

    class Config:
        """Configuración de ORM para Pydantic."""
        from_attributes = True

class AdminCreateUserRequest(BaseModel):
    """Esquema para que el admin cree un nuevo usuario."""
    nombre: str = Field(..., min_length=2)
    email: EmailStr
    password: str = Field(..., min_length=6)
    rol_id: int

class GarantiaCreate(BaseModel):
    """Esquema para crear una garantía."""
    tipo: str = Field(..., description="Poliza, Seguro, Boleta, Garantia")
    numero: str
    monto: float
    moneda: str = "USD"
    fecha_emision: Optional[datetime] = None
    fecha_vencimiento: Optional[datetime] = None
    estado: str = "Vigente"
    emisor: Optional[str] = None
    observaciones: Optional[str] = None

class GarantiaResponse(BaseModel):
    """Respuesta con datos completos de una garantía."""
    id: int
    tipo: str
    numero: str
    monto: float
    moneda: str
    fecha_emision: Optional[datetime] = None
    fecha_vencimiento: Optional[datetime] = None
    estado: str
    emisor: Optional[str] = None
    observaciones: Optional[str] = None
    fecha_creacion: datetime
    documento_id: int

    class Config:
        """Configuración de ORM para Pydantic."""
        from_attributes = True

class PasswordChangeRequest(BaseModel):
    """Esquema de solicitud de cambio de contraseña."""
    current_password: str
    new_password: str = Field(..., min_length=6)
    confirm_password: str

class DocumentoProcesadoResponse(BaseModel):
    """Respuesta con datos completos de un documento procesado."""
    id: int
    nombre_archivo: str
    fecha_analisis: datetime
    proveedor: Optional[str] = None
    cliente: Optional[str] = None
    total_cif: Optional[float] = None
    flete: Optional[float] = None
    seguro: Optional[float] = None
    otros: Optional[float] = None
    riesgo: Optional[str] = None
    estado: Optional[str] = None
    bloqueado: bool = False
    ruta_archivo: Optional[str] = None
    estado_aduanero: Optional[str] = None
    fecha_presentacion: Optional[datetime] = None
    fecha_aforo_documental: Optional[datetime] = None
    fecha_aforo_fisico: Optional[datetime] = None
    fecha_liquidacion: Optional[datetime] = None
    fecha_liberacion: Optional[datetime] = None
    despachante_id: Optional[int] = None
    cliente_id: Optional[int] = None
    dua_generado: bool = False
    partidas: List[PartidaResponse] = []

    class Config:
        """Configuración de ORM para Pydantic."""
        from_attributes = True


class DespachanteCreate(BaseModel):
    """Esquema para crear un despachante de aduana."""
    nombre: str
    rut: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    direccion: Optional[str] = None

class DespachanteResponse(BaseModel):
    """Respuesta con datos completos de un despachante."""
    id: int
    nombre: str
    rut: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    direccion: Optional[str] = None
    activo: bool
    fecha_creacion: datetime

    class Config:
        """Configuración de ORM para Pydantic."""
        from_attributes = True


# --- Esquemas de Clientes ---

class ClienteCreate(BaseModel):
    """Esquema para crear un nuevo cliente."""
    razon_social: str
    identificacion_fiscal: str
    direccion: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    contacto_nombre: Optional[str] = None

class ClienteUpdate(BaseModel):
    """Esquema para actualizar parcialmente un cliente."""
    razon_social: Optional[str] = None
    identificacion_fiscal: Optional[str] = None
    direccion: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    contacto_nombre: Optional[str] = None
    activo: Optional[bool] = None

class ClienteResponse(BaseModel):
    """Respuesta con datos completos de un cliente."""
    id: int
    razon_social: str
    identificacion_fiscal: str
    direccion: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    contacto_nombre: Optional[str] = None
    activo: bool
    fecha_creacion: datetime

    class Config:
        """Configuración de ORM para Pydantic."""
        from_attributes = True

class PartidaCreate(BaseModel):
    """Esquema para crear una partida de documento."""
    descripcion: Optional[str] = None
    cantidad: Optional[float] = None
    precio_unitario: Optional[float] = None
    partida_sugerida: Optional[str] = None
    partida_corregida: Optional[str] = None
    orden: Optional[int] = None


class PartidaResponse(BaseModel):
    """Respuesta con datos completos de una partida."""
    id: int
    documento_id: int
    descripcion: Optional[str] = None
    cantidad: Optional[float] = None
    precio_unitario: Optional[float] = None
    partida_sugerida: Optional[str] = None
    partida_corregida: Optional[str] = None
    orden: Optional[int] = None

    class Config:
        """Configuración de ORM para Pydantic."""
        from_attributes = True


class DocumentoProcesadoUpdate(BaseModel):
    """Esquema para actualizar parcialmente un documento procesado."""
    nombre_archivo: Optional[str] = None
    proveedor: Optional[str] = None
    cliente: Optional[str] = None
    total_cif: Optional[float] = None
    flete: Optional[float] = None
    seguro: Optional[float] = None
    otros: Optional[float] = None
    riesgo: Optional[str] = None
    cliente_id: Optional[int] = None
    dua_generado: Optional[bool] = None
    partidas: Optional[List[PartidaCreate]] = None


class AvanzarEstadoAduaneroRequest(BaseModel):
    """Esquema para avanzar el estado aduanero de un documento."""
    estado: str = Field(..., description="Nuevo estado aduanero: Presentado, En Aforo Documental, En Aforo Fisico, Liquidado, Liberado")


# --- Esquemas de Observaciones ---

class ObservacionCreate(BaseModel):
    """Esquema para crear una observación."""
    contenido: str = Field(..., min_length=1, max_length=2000)
    tipo: str = "nota"  # nota, alerta, correccion

class ObservacionResponse(BaseModel):
    """Respuesta con datos de una observación."""
    id: int
    contenido: str
    tipo: str
    fecha_creacion: datetime
    usuario_nombre: Optional[str] = None

    class Config:
        """Configuración de ORM para Pydantic."""
        from_attributes = True


# --- Esquemas de Catálogo de Partidas ---

class CatalogoPartidaCreate(BaseModel):
    """Esquema para crear una entrada en el catálogo de partidas."""
    descripcion_producto: str = Field(..., min_length=2)
    partida_arancelaria: str = Field(..., min_length=4)

class CatalogoPartidaResponse(BaseModel):
    """Respuesta con datos de una partida del catálogo."""
    id: int
    descripcion_producto: str
    partida_arancelaria: str
    frecuencia_uso: int
    ultima_actualizacion: datetime

    class Config:
        """Configuración de ORM para Pydantic."""
        from_attributes = True


# --- Esquemas de Notificaciones ---

class NotificacionResponse(BaseModel):
    """Respuesta con datos de una notificación."""
    id: int
    titulo: str
    mensaje: str
    tipo: str
    leida: bool
    fecha_creacion: datetime
    documento_id: Optional[int] = None

    class Config:
        """Configuración de ORM para Pydantic."""
        from_attributes = True


# --- Esquemas de Validación Cruzada Multi-Documento ---

class DocumentoEstructurado(BaseModel):
    """Esquema de un documento estructurado extraído por IA."""
    tipo: str = Field(
        ...,
        description="Tipo de documento: FACTURA, PACKING_LIST, BL",
    )
    datos: dict = Field(
        ...,
        description="Diccionario estructurado extraído por Gemini con campos normalizados",
    )

class SolicitudValidacionCruzada(BaseModel):
    """Esquema de solicitud de validación cruzada entre documentos."""
    documentos: List[DocumentoEstructurado] = Field(
        ...,
        min_length=2,
        max_length=5,
        description="Lista de documentos estructurados a validar cruzadamente",
    )

class DiscrepanciaValidacion(BaseModel):
    """Esquema de una discrepancia encontrada en la validación."""
    campo: str = Field(..., description="Nombre del campo con discrepancia")
    descripcion: str = Field(..., description="Descripción detallada del descalce")
    severidad: str = Field(..., pattern=r"^(ALTA|MEDIA|BAJA)$")
    detalle: Optional[dict] = Field(
        default=None,
        description="Información adicional estructurada (valores enfrentados, porcentajes, etc.)",
    )

class ResultadoValidacionCruzada(BaseModel):
    """Esquema del resultado completo de la validación cruzada."""
    documentos_identificados: List[str] = Field(
        ...,
        description="Lista de tipos de documentos que se identificaron",
    )
    discrepancias_encontradas: bool
    lista_discrepancias: List[DiscrepanciaValidacion] = Field(
        ...,
        description="Lista detallada de descalces encontrados",
    )
    coincidencias_clave: List[str] = Field(
        ...,
        description="Lista de campos que coinciden correctamente entre documentos",
    )
    conclusion: str = Field(
        ...,
        description="Resumen ejecutivo de la validación cruzada",
    )


# --- Esquemas de Configuración del Motor de Reglas ---

class ReglaConfiguracionResponse(BaseModel):
    """Respuesta con datos de una regla de configuración."""
    id: int
    nombre_regla: str
    nombre_mostrar: str
    descripcion: Optional[str] = None
    activa: bool
    severidad: str
    parametros: Optional[dict] = None
    ultima_modificacion: Optional[datetime] = None
    modificado_por: Optional[str] = None

    class Config:
        """Configuración de ORM para Pydantic."""
        from_attributes = True

class ReglaToggleRequest(BaseModel):
    """Esquema para activar/desactivar una regla."""
    activa: bool

class ReglaSeveridadRequest(BaseModel):
    """Esquema para cambiar la severidad de una regla."""
    severidad: str = Field(..., pattern=r"^(IGNORAR|ADVERTENCIA|BLOQUEANTE)$")

class ReglaThresholdRequest(BaseModel):
    """Esquema para ajustar los umbrales de una regla."""
    parametros: dict


# --- Esquemas de Prevalidación (7 Etapas) ---

class ControlPrevalidacionResponse(BaseModel):
    """Esquema de un control individual en la prevalidación."""
    nombre: str
    estado: str
    mensaje: str
    detalle: Optional[str] = None

class EtapaPrevalidacionResponse(BaseModel):
    """Esquema de una etapa completa de prevalidación."""
    numero: int
    titulo: str
    descripcion: str
    estado: str
    controles: List[ControlPrevalidacionResponse] = []
    resumen: Optional[str] = None

class ResultadoPrevalidacionResponse(BaseModel):
    """Esquema del resultado global de la prevalidación."""
    riesgo_global: str
    puntaje_riesgo: float
    etapas: List[EtapaPrevalidacionResponse]


# --- Esquemas de Bloqueo y Archivo de Intercambio ---

class PrevalidarAprobarRequest(BaseModel):
    """Esquema de confirmación para prevalidar y aprobar."""
    confirmar: bool = Field(default=True, description="Confirmación explícita del bloqueo del documento.")

class ArchivoIntercambioResponse(BaseModel):
    """Esquema de respuesta con archivos de intercambio (XML/JSON)."""
    xml: str
    json: dict


class SolicitudAprobacion(BaseModel):
    """Esquema de solicitud de aprobación con posibles ajustes."""
    nuevo_total: Optional[float] = None
    solicitar_revision: bool = False

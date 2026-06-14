from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime

# --- DTOs (Data Transfer Objects): validan lo que entra y sale por la API ---

# ---- Facturas (solo para escaneo) ----

class FacturaDetalleBase(BaseModel):
    """Campos base de un detalle de factura: producto, cantidad, precio y partida corregida."""
    descripcion_producto: str
    cantidad: float
    precio_unitario: float
    partida_arancelaria_corregida: Optional[str] = None

class FacturaDetalleCreate(FacturaDetalleBase):
    pass

class FacturaBase(BaseModel):
    """Una factura comercial: datos del emisor, receptor, montos, moneda, incoterm, pesos."""
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
    """Se usa en el endpoint /scan para recibir la factura completa con sus items."""
    detalles: List[FacturaDetalleCreate]

# ---- Auth ----

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember: bool = False

class RegisterRequest(BaseModel):
    """Registro de usuario nuevo: nombre, email y contraseña (min 6 caracteres)."""
    nombre: str = Field(..., min_length=2)
    email: EmailStr
    password: str = Field(..., min_length=6)

class Token(BaseModel):
    """Respuesta del login: el JWT que el frontend guarda y manda en cada request."""
    access_token: str
    token_type: str
    user_name: str
    user_role: str

class UserResponse(BaseModel):
    """Datos publicos de un usuario (nunca se devuelve la contraseña)."""
    id: int
    nombre: str
    email: EmailStr
    rol_nombre: str
    activo: bool
    online: bool = False

    class Config:
        from_attributes = True

class AdminCreateUserRequest(BaseModel):
    """El admin puede crear usuarios directamente (sin aprobacion)."""
    nombre: str = Field(..., min_length=2)
    email: EmailStr
    password: str = Field(..., min_length=6)
    rol_id: int

class PasswordChangeRequest(BaseModel):
    """Cambio de contrasena: requiere la actual y la nueva confirmada."""
    current_password: str
    new_password: str = Field(..., min_length=6)
    confirm_password: str

# ---- Garantias ----

class GarantiaCreate(BaseModel):
    """Campos necesarios para registrar una garantia/poliza asociada a un documento."""
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
    """Garantia tal como se devuelve al frontend, con todos sus campos."""
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
        from_attributes = True

# ---- Documentos Procesados ----

class DocumentoProcesadoResponse(BaseModel):
    """El documento completo que se devuelve al frontend, con sus partidas."""
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

    # Nombre del analista que subio el documento (se poblada en endpoint admin)
    usuario_nombre: Optional[str] = None

    # Nuevos campos extras
    fecha_emision: Optional[str] = None
    moneda: Optional[str] = None
    monto_subtotal: Optional[float] = None
    remitente_dir: Optional[str] = None
    remitente_doc: Optional[str] = None
    destinatario_dir: Optional[str] = None
    transporte_pais: Optional[str] = None
    transporte_metodo: Optional[str] = None
    peso_bruto: Optional[float] = None
    peso_neto: Optional[float] = None
    receptor_tax: Optional[str] = None
    numero_factura: Optional[str] = None
    incoterm: Optional[str] = None
    pais_origen: Optional[str] = None

    # Datos originales que devolvió la IA al escanear, para comparar cambios
    datos_originales: Optional[dict] = None

    # Resultado completo de la prevalidación (7 etapas con controles) para
    # mostrarlo en el frontend o al generar informes PDF
    prevalidacion_resultado: Optional[dict] = None

    class Config:
        from_attributes = True


class DocumentoProcesadoUpdate(BaseModel):
    """Campos que se pueden modificar de un documento existente."""
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

    # Campos extra para guardar datos de la factura
    fecha_emision: Optional[str] = None
    moneda: Optional[str] = None
    monto_subtotal: Optional[float] = None
    remitente_dir: Optional[str] = None
    remitente_doc: Optional[str] = None
    destinatario_dir: Optional[str] = None
    transporte_pais: Optional[str] = None
    transporte_metodo: Optional[str] = None
    peso_bruto: Optional[float] = None
    peso_neto: Optional[float] = None
    receptor_tax: Optional[str] = None
    numero_factura: Optional[str] = None
    incoterm: Optional[str] = None
    pais_origen: Optional[str] = None

# ---- Partidas ----

class PartidaCreate(BaseModel):
    """Cada linea/item de un documento. Lleva descripcion, cantidad, precio y partida."""
    descripcion: Optional[str] = None
    cantidad: Optional[float] = None
    precio_unitario: Optional[float] = None
    partida_sugerida: Optional[str] = None
    partida_corregida: Optional[str] = None
    orden: Optional[int] = None


class PartidaResponse(BaseModel):
    """Partida tal como se devuelve al frontend."""
    id: int
    documento_id: int
    descripcion: Optional[str] = None
    cantidad: Optional[float] = None
    precio_unitario: Optional[float] = None
    partida_sugerida: Optional[str] = None
    partida_corregida: Optional[str] = None
    orden: Optional[int] = None

    class Config:
        from_attributes = True

# ---- Despachantes ----

class DespachanteCreate(BaseModel):
    """Registro de un agente de aduana."""
    nombre: str
    rut: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    direccion: Optional[str] = None

class DespachanteResponse(BaseModel):
    """Datos de un despachante tal como se devuelven al frontend."""
    id: int
    nombre: str
    rut: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    direccion: Optional[str] = None
    activo: bool
    fecha_creacion: datetime

    class Config:
        from_attributes = True

# ---- Clientes ----

class ClienteCreate(BaseModel):
    """Registro de un importador/exportador."""
    razon_social: str
    identificacion_fiscal: str
    direccion: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    contacto_nombre: Optional[str] = None

class ClienteUpdate(BaseModel):
    """Campos editables de un cliente."""
    razon_social: Optional[str] = None
    identificacion_fiscal: Optional[str] = None
    direccion: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    contacto_nombre: Optional[str] = None
    activo: Optional[bool] = None

class ClienteResponse(BaseModel):
    """Cliente tal como se devuelve al frontend."""
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
        from_attributes = True

# ---- Estados Aduaneros ----

class AvanzarEstadoAduaneroRequest(BaseModel):
    """Para avanzar el estado aduanero paso a paso:
    Presentado -> En Aforo Documental -> En Aforo Fisico -> Liquidado -> Liberado.
    """
    estado: str = Field(..., description="Nuevo estado aduanero: Presentado, En Aforo Documental, En Aforo Fisico, Liquidado, Liberado")

# ---- Observaciones ----

class ObservacionCreate(BaseModel):
    """Una nota que el usuario agrega a un documento."""
    contenido: str = Field(..., min_length=1, max_length=2000)
    tipo: str = "nota"

# ---- Catalogo de Partidas ----

class CatalogoPartidaCreate(BaseModel):
    """Nueva entrada en el catalogo de clasificaciones arancelarias aprendidas."""
    descripcion_producto: str = Field(..., min_length=2)
    partida_arancelaria: str = Field(..., min_length=4)

# ---- Configuracion del Motor de Reglas ----

class ReglaConfiguracionResponse(BaseModel):
    """Regla del motor de prevalidacion, con su severidad y parametros."""
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
        from_attributes = True

class ReglaToggleRequest(BaseModel):
    """Encender o apagar una regla."""
    activa: bool

class ReglaSeveridadRequest(BaseModel):
    """Cambiar la severidad: IGNORAR, ADVERTENCIA o BLOQUEANTE."""
    severidad: str = Field(..., pattern=r"^(IGNORAR|ADVERTENCIA|BLOQUEANTE)$")

class ReglaThresholdRequest(BaseModel):
    """Ajustar los parametros/umbrales de una regla (ej: monto maximo)."""
    parametros: dict

# ---- Bloqueo y Aprobacion ----

class PrevalidarAprobarRequest(BaseModel):
    """Confirmacion para prevalidar y aprobar un documento bloqueado."""
    confirmar: bool = Field(default=True, description="Confirmacion explicita del bloqueo del documento.")


class SolicitudAprobacion(BaseModel):
    """Solicitud de aprobacion con ajustes opcionales al total."""
    nuevo_total: Optional[float] = None
    solicitar_revision: bool = False

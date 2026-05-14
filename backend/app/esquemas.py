from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime
from .modelos import NivelRiesgo, EstadoEnvio

# --- Esquemas de validación (DTOs) ---
# Definen la estructura de los datos que entran y salen de la API,
# separándolos de los modelos de la base de datos.

class FacturaDetalleBase(BaseModel):
    descripcion_producto: str = Field(..., description="Nombre del artículo importado")
    cantidad: float
    precio_unitario: float
    partida_arancelaria_corregida: Optional[str] = None

class FacturaDetalleCreate(FacturaDetalleBase):
    pass

class FacturaDetalleResponse(FacturaDetalleBase):
    id: int
    partida_arancelaria_sugerida: Optional[str]
    inconsistente: bool

    class Config:
        orm_mode = True
        from_attributes = True

class FacturaBase(BaseModel):
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
    detalles: List[FacturaDetalleCreate]

class FacturaResponse(FacturaBase):
    id: int
    riesgo_calculado: str
    observaciones_riesgo: Optional[str]
    pre_aprobada: bool
    detalles: List[FacturaDetalleResponse] = []

    class Config:
        orm_mode = True
        from_attributes = True

class EnvioBase(BaseModel):
    referencia_operativa: str

class EnvioCreate(EnvioBase):
    cliente_id: int
    facturas: List[FacturaCreate] = []

class EnvioResponse(EnvioBase):
    id: int
    fecha_creacion: datetime
    estado: str
    facturas: List[FacturaResponse] = []

    class Config:
        orm_mode = True
        from_attributes = True

# --- Esquemas de autenticación ---

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember: bool = False

class RegisterRequest(BaseModel):
    nombre: str = Field(..., min_length=2)
    email: EmailStr
    password: str = Field(..., min_length=6)

class Token(BaseModel):
    access_token: str
    token_type: str
    user_name: str
    user_role: str

class TokenData(BaseModel):
    email: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    nombre: str
    email: EmailStr
    rol_nombre: str
    activo: bool

    class Config:
        from_attributes = True

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)
    confirm_password: str

class DocumentoProcesadoResponse(BaseModel):
    id: int
    nombre_archivo: str
    fecha_analisis: datetime
    proveedor: Optional[str]
    cliente: Optional[str]
    total_cif: Optional[float]
    riesgo: Optional[str]
    estado: Optional[str]

    class Config:
        from_attributes = True


# --- Esquemas de Observaciones ---

class ObservacionCreate(BaseModel):
    contenido: str = Field(..., min_length=1, max_length=2000)
    tipo: str = "nota"  # nota, alerta, correccion

class ObservacionResponse(BaseModel):
    id: int
    contenido: str
    tipo: str
    fecha_creacion: datetime
    usuario_nombre: Optional[str] = None

    class Config:
        from_attributes = True


# --- Esquemas de Catálogo de Partidas ---

class CatalogoPartidaCreate(BaseModel):
    descripcion_producto: str = Field(..., min_length=2)
    partida_arancelaria: str = Field(..., min_length=4)

class CatalogoPartidaResponse(BaseModel):
    id: int
    descripcion_producto: str
    partida_arancelaria: str
    frecuencia_uso: int
    ultima_actualizacion: datetime

    class Config:
        from_attributes = True


# --- Esquemas de Notificaciones ---

class NotificacionResponse(BaseModel):
    id: int
    titulo: str
    mensaje: str
    tipo: str
    leida: bool
    fecha_creacion: datetime
    documento_id: Optional[int] = None

    class Config:
        from_attributes = True

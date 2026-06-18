from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime

class FacturaDetalleBase(BaseModel):
    descripcion_producto: str
    cantidad: float
    precio_unitario: float
    partida_arancelaria_corregida: Optional[str] = None

class FacturaDetalleCreate(FacturaDetalleBase):
    pass

class FacturaBase(BaseModel):
    numero_factura: Optional[str] = None
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
    refresh_token: str
    token_type: str
    user_name: str
    user_role: str

class UserResponse(BaseModel):
    id: int
    nombre: str
    email: EmailStr
    rol_nombre: str
    activo: bool
    online: bool = False

    class Config:
        from_attributes = True

class AdminCreateUserRequest(BaseModel):
    nombre: str = Field(..., min_length=2)
    email: EmailStr
    password: str = Field(..., min_length=6)
    rol_id: int

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)
    confirm_password: str

class DocumentoProcesadoResponse(BaseModel):
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
    cliente_id: Optional[int] = None
    dua_generado: bool = False
    partidas: List[PartidaResponse] = []

    usuario_nombre: Optional[str] = None

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

    datos_originales: Optional[dict] = None

    prevalidacion_resultado: Optional[dict] = None

    class Config:
        from_attributes = True

class DocumentoProcesadoUpdate(BaseModel):
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

class PartidaCreate(BaseModel):
    descripcion: Optional[str] = None
    cantidad: Optional[float] = None
    precio_unitario: Optional[float] = None
    partida_sugerida: Optional[str] = None
    partida_corregida: Optional[str] = None
    orden: Optional[int] = None

class PartidaResponse(BaseModel):
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

class ClienteCreate(BaseModel):
    razon_social: str
    identificacion_fiscal: str
    direccion: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    contacto_nombre: Optional[str] = None

class ClienteUpdate(BaseModel):
    razon_social: Optional[str] = None
    identificacion_fiscal: Optional[str] = None
    direccion: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    contacto_nombre: Optional[str] = None
    activo: Optional[bool] = None

class ClienteResponse(BaseModel):
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

class AvanzarEstadoAduaneroRequest(BaseModel):
    estado: str = Field(..., description="Nuevo estado aduanero: Presentado, En Aforo Documental, En Aforo Fisico, Liquidado, Liberado")

class ObservacionCreate(BaseModel):
    contenido: str = Field(..., min_length=1, max_length=2000)
    tipo: str = "nota"

class CatalogoPartidaCreate(BaseModel):
    descripcion_producto: str = Field(..., min_length=2)
    partida_arancelaria: str = Field(..., min_length=4)

class ReglaConfiguracionResponse(BaseModel):
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
    activa: bool

class ReglaSeveridadRequest(BaseModel):
    severidad: str = Field(..., pattern=r"^(IGNORAR|ADVERTENCIA|BLOQUEANTE)$")

class ReglaThresholdRequest(BaseModel):
    parametros: dict

class PrevalidarAprobarRequest(BaseModel):
    confirmar: bool = Field(default=True, description="Confirmacion explicita del bloqueo del documento.")

class SolicitudAprobacion(BaseModel):
    nuevo_total: Optional[float] = None
    solicitar_revision: bool = False

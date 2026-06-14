import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  AlertCircle, CheckCircle, Save, XCircle, ArrowLeft, Download,
  ShieldAlert, Shield, Sparkles, Loader2, Scale, Calculator, FileText,
  Globe, Printer, Send, MessageSquare, Scan,
  DollarSign, MapPin, Package, Truck, User, UserCheck, Flag, Edit3, Lock,
} from 'lucide-react';
import { useAuth } from '../contexto/ContextoAuth';
import ObservacionesPanel from '../componentes/ObservacionesPanel';
import AsistenteClasificacionArancelaria from '../componentes/AsistenteClasificacionArancelaria';
import PdfTextSelector from '../componentes/PdfTextSelector';
import GestorVistosBuenos from '../componentes/GestorVistosBuenos';
import { API_BASE, peticionPut, peticionPost, peticionGet, obtenerToken } from '../servicios/api';
import PipelinePrevalidacion from '../componentes/PipelinePrevalidacion';
import ModalConfirmacionPartida from '../componentes/ModalConfirmacionPartida';
import ItemsTable from '../componentes/ItemsTable';
import { cssVar as v } from '../libreria/utilidades';

/* Mapa de niveles de riesgo con etiquetas, colores e íconos */
const STATUS_MAP = {
  alto: { label: 'Fallo de Regla', color: v('red'), bg: 'rgba(239,68,68,0.12)', icon: XCircle },
  medio: { label: 'Requiere Revisión', color: v('yellow'), bg: 'rgba(245,158,11,0.12)', icon: AlertCircle },
  bajo: { label: 'Aprobado Automatico', color: v('green'), bg: 'rgba(16,185,129,0.12)', icon: CheckCircle },
};

/* Componente principal: vista detallada de una factura con visor PDF, edición y acciones */
const InvoiceDetail = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Administrador';
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const rawData = location.state?.fullData;
  const historyData = location.state?.historyData;
  const docIdForPdf = historyData?.id || rawData?.id || id;
  const pdfUrl = docIdForPdf ? `${API_BASE}/api/documentos/${docIdForPdf}/archivo` : null;
  const prevalidacionData = location.state?.prevalidacion;
  const rightPanelRef = useRef(null);
  const [documentoFetchado, setDocumentoFetchado] = useState(false);
  const [cargandoDoc, setCargandoDoc] = useState(!rawData && !historyData && !!id && id !== 'null' && id !== 'undefined');
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [pdfCargando, setPdfCargando] = useState(false);

  /* Construye el estado inicial de la factura desde tres fuentes posibles:
     1) rawData (resultado completo del escaneo, vía location.state.fullData)
     2) historyData (registro desde el historial, vía location.state.historyData)
     3) vacío (carga directa por ID desde la URL) */
  const buildInitialState = () => {
    if (rawData) {
      return {
        numero: rawData.factura?.numero ?? 'N/A',
        emisor: rawData.remitente?.nombre ?? 'N/A',
        fecha: rawData.factura?.fecha ?? '',
        monto_total: rawData.economia?.total ?? 0,
        monto_subtotal: rawData.economia?.subtotal ?? 0,
        riesgo: rawData.riesgo ?? 'medio',
        observaciones: rawData.observaciones ?? 'Revisión manual requerida.',
        moneda: rawData.factura?.moneda ?? 'USD',
        incoterm: rawData.factura?.incoterm ?? 'N/A',
        pais_origen: rawData.factura?.pais_origen ?? '',
        flete: rawData.economia?.envio ?? 0,
        seguro: rawData.economia?.seguro ?? 0,
        otros: rawData.economia?.otros ?? 0,
        receptor: rawData.destinatario?.nombre ?? '',
        receptor_tax: rawData.destinatario?.documento ?? '',
        remitente_dir: rawData.remitente?.direccion ?? '',
        remitente_doc: rawData.remitente?.documento ?? '',
        destinatario_dir: rawData.destinatario?.direccion ?? '',
        transporte_pais: rawData.transporte?.paisOrigen ?? '',
        transporte_metodo: rawData.transporte?.metodo ?? '',
        peso_bruto: rawData.logistica?.peso_bruto ?? 0,
        peso_neto: rawData.logistica?.peso_neto ?? 0,
        detalles: (rawData.detalles || []).map((d, i) => ({
          id: i + 1, descripcion: d.descripcion_producto,
          cantidad: d.cantidad, precio_unitario: d.precio_unitario,
          partida_sugerida: d.partida_sugerida, partida_corregida: '',
          inconsistente: false,
        })),
      };
    }
    if (historyData) {
      /* Toma los datos originales de la IA como respaldo para documentos
         creados antes de que existieran las columnas numero_factura, incoterm
         y pais_origen en la base de datos */
      const orig = historyData.datos_originales || {};
      return {
        numero: historyData.numero_factura ?? orig.numero_factura ?? historyData.nombre_archivo ?? 'N/A',
        emisor: historyData.proveedor ?? 'N/A',
        fecha: historyData.fecha_emision ?? '',
        monto_total: historyData.total_cif ?? 0,
        monto_subtotal: historyData.monto_subtotal ?? 0,
        riesgo: historyData.riesgo ?? 'medio',
        observaciones: 'Recuperado desde el historial.',
        moneda: historyData.moneda ?? 'USD',
        incoterm: historyData.incoterm ?? orig.incoterm ?? '',
        pais_origen: historyData.pais_origen ?? orig.pais_origen ?? '',
        flete: historyData.flete ?? 0,
        seguro: historyData.seguro ?? 0,
        otros: historyData.otros ?? 0,
        receptor: historyData.cliente ?? '', receptor_tax: historyData.receptor_tax ?? '',
        remitente_dir: historyData.remitente_dir ?? '',
        remitente_doc: historyData.remitente_doc ?? '',
        destinatario_dir: historyData.destinatario_dir ?? '',
        transporte_pais: historyData.transporte_pais ?? '',
        transporte_metodo: historyData.transporte_metodo ?? '',
        peso_bruto: historyData.peso_bruto ?? 0,
        peso_neto: historyData.peso_neto ?? 0,
        detalles: (historyData.partidas && historyData.partidas.length > 0)
          ? historyData.partidas.map((p, i) => ({
            id: p.id ?? i + 1, descripcion: p.descripcion,
            cantidad: p.cantidad, precio_unitario: p.precio_unitario,
            partida_sugerida: p.partida_sugerida ?? '',
            partida_corregida: p.partida_corregida ?? '',
            inconsistente: false,
          }))
          : [],
      };
    }
    return {
      numero: 'Cargando...', emisor: 'Cargando...', fecha: '',
      monto_total: 0, monto_subtotal: 0,
      riesgo: 'medio', observaciones: 'Recuperando datos del servidor...', moneda: 'USD',
      incoterm: '', pais_origen: '', flete: 0, seguro: 0, otros: 0,
      receptor: '', receptor_tax: '',
      remitente_dir: '', remitente_doc: '', destinatario_dir: '',
      transporte_pais: '', transporte_metodo: '',
      peso_bruto: 0, peso_neto: 0,
      detalles: [],
    };
  };

  const [factura, setFactura] = useState(buildInitialState);
  const [camposMod, setCamposMod] = useState({});

  /* Almacena el JSON completo que devolvió la IA al escanear, para poder
     comparar qué campos editó el usuario respecto al valor detectado originalmente */
  const [datosOriginales, setDatosOriginales] = useState(() => {
    const fuente = rawData?.datos_originales || historyData?.datos_originales || null;
    return fuente;
  });

  /* Mapa que relaciona cada campo del formulario con su ruta dentro del JSON
     de datos_originales. Si no hay ruta definida, el campo no tiene original */
  const MAPA_RUTAS_ORIGINAL = {
    monto_total: ['monto_total_cif'],
    monto_subtotal: ['monto_subtotal'],
    flete: ['monto_flete'],
    seguro: ['monto_seguro'],
    otros: ['monto_otros_gastos'],
    receptor: ['receptor', 'nombre'],
    receptor_tax: ['receptor', 'tax_id'],
    fecha: ['fecha_emision'],
    moneda: ['moneda'],
    transporte_pais: ['emisor', 'pais'],
    transporte_metodo: ['transporte_metodo'],
    peso_bruto: ['pesos', 'bruto'],
    peso_neto: ['pesos', 'neto'],
    remitente_dir: ['emisor', 'direccion'],
    remitente_doc: ['emisor', 'tax_id'],
    destinatario_dir: ['receptor', 'direccion'],
    emisor: ['emisor', 'nombre'],
    pais_origen: ['pais_origen'],
    incoterm: ['incoterm'],
    numero: ['numero_factura'],
  };

  /* Extrae el valor original de un campo desde datos_originales siguiendo la ruta del mapa */
  const obtenerOriginal = (campo) => {
    if (!datosOriginales) return undefined;
    const ruta = MAPA_RUTAS_ORIGINAL[campo];
    if (!ruta) return undefined;
    let valor = datosOriginales;
    for (const key of ruta) {
      if (valor == null || typeof valor !== 'object') return undefined;
      valor = valor[key];
    }
    return valor;
  };

  /* Componente que muestra el valor original de la IA debajo de un campo modificado */
  const ValorOriginal = ({ campo, formato }) => {
    const original = obtenerOriginal(campo);
    if (original === undefined || original === null) return null;
    const actual = campo === 'flete' ? flete
      : campo === 'seguro' ? seguro
      : campo === 'otros' ? otrosGastos
      : factura[campo];
    const originalStr = formato === 'moneda' ? `$${Number(original).toFixed(2)}` : String(original);
    const actualStr = formato === 'moneda' ? `$${Number(actual).toFixed(2)}` : String(actual);
    if (originalStr === actualStr) return null;
    return (
      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.2 }}>
        Original IA: {originalStr}
      </div>
    );
  };

  const VALID_INCOTERMS = new Set(['FOB','CIF','CFR','CPT','CIP','EXW','FCA','FAS','DAT','DAP','DDP']);
  const VALID_CURRENCIES = new Set(['USD','EUR','GBP','JPY','CNY','BRL','ARS','MXN','CLP','PEN','COP']);

  /* Componente interno: alerta de cuadratura aduanera de dos niveles.
     Nivel 1: suma de items (FOB) contra subtotal declarado.
     Nivel 2: subtotal + flete + seguro + otros contra total CIF.
     Si no hay subtotal declarado, se deriva como CIF - gastos. */
  const CuadraturaItems = () => {
    if (!factura.detalles || factura.detalles.length === 0) return null;
    const suma = factura.detalles.reduce((s, d) => s + (d.cantidad || 0) * (d.precio_unitario || 0), 0);
    const subtotalDecl = Number(factura.monto_subtotal || 0);
    const totalCif = Number(factura.monto_total) || 0;
    const totalFlete = Number(flete) || 0;
    const totalSeguro = Number(seguro) || 0;
    const totalOtros = Number(otrosGastos) || 0;
    const totalGastos = totalFlete + totalSeguro + totalOtros;

    /* Obtiene el subtotal de referencia: prioriza el declarado, si no lo deriva de CIF - gastos */
    const obtenerSubtotal = () => {
      if (subtotalDecl > 0) return { valor: subtotalDecl, label: 'Subtotal declarado' };
      const derivado = totalCif - totalGastos;
      if (derivado > 0) return { valor: derivado, label: 'Subtotal derivado (CIF − gastos)' };
      return null;
    };

    const st = obtenerSubtotal();
    if (!st || suma <= 0) return null;

    const diffItems = Math.abs(suma - st.valor);
    const diffItemsPct = (diffItems / st.valor) * 100;
    const cifReal = st.valor + totalGastos;
    const diffCif = Math.abs(cifReal - totalCif);
    const diffCifPct = totalCif > 0 ? (diffCif / totalCif) * 100 : 0;

    const hayErrorItems = diffItems > 2.00;
    const hayErrorCif = totalCif > 0 && diffCif > 2.00;

    if (!hayErrorItems && !hayErrorCif) return null;

    const colorItems = diffItemsPct > 5 ? v('red') : v('yellow');
    const colorCif = diffCifPct > 5 ? v('red') : v('yellow');
    const bgColor = hayErrorItems || hayErrorCif ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)';
    const borderColor = hayErrorItems || hayErrorCif ? v('red') + '30' : v('yellow') + '30';

    const lineStyle = {
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '6px 0', borderBottom: `1px solid ${v('card-border')}`,
      fontSize: '0.75rem', color: v('text-muted'),
    };
    const labelStyle = { fontWeight: 700, fontSize: '0.65rem', color: v('text-muted'), minWidth: '54px', textTransform: 'uppercase' };
    const valStyle = { color: v('text-main'), fontWeight: 600 };

    return (
      <div style={{
        borderRadius: '12px', marginTop: '0',
        background: bgColor, border: `1px solid ${borderColor}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px 0', fontSize: '0.8rem' }}>
          <AlertCircle size={14} color={hayErrorItems || hayErrorCif ? v('red') : v('yellow')} />
          <strong style={{ color: v('text-main') }}>Cuadratura Aduanera</strong>
        </div>
        <div style={{ padding: '0 14px 4px' }}>
          <div style={lineStyle}>
            <span style={labelStyle}>FOB</span>
            <span style={{ flex: 1 }}>
              Items <strong style={valStyle}>${suma.toFixed(2)}</strong>
              {' vs '}
              <strong style={valStyle}>${st.valor.toFixed(2)}</strong>
              {' ('}{st.label}{')'}
            </span>
            {hayErrorItems ? (
              <strong style={{ color: colorItems }}>
                ${diffItems.toFixed(2)} ({diffItemsPct.toFixed(1)}%)
              </strong>
            ) : (
              <span style={{ color: v('green'), fontWeight: 700 }}>✓</span>
            )}
          </div>
          {totalCif > 0 && (
            <div style={lineStyle}>
              <span style={labelStyle}>CIF</span>
              <span style={{ flex: 1 }}>
                <strong style={valStyle}>${st.valor.toFixed(2)}</strong>
                {' + '}<strong style={{ color: v('yellow') }}>${totalGastos.toFixed(2)}</strong>
                {' = '}<strong style={valStyle}>${cifReal.toFixed(2)}</strong>
                {' vs '}<strong style={valStyle}>${totalCif.toFixed(2)}</strong>
              </span>
              {hayErrorCif ? (
                <strong style={{ color: colorCif }}>
                  ${diffCif.toFixed(2)} ({diffCifPct.toFixed(1)}%)
                </strong>
              ) : (
                <span style={{ color: v('green'), fontWeight: 700 }}>✓</span>
              )}
            </div>
          )}
          <div style={{ ...lineStyle, borderBottom: 'none', flexWrap: 'wrap', gap: '4px 10px' }}>
            <span style={labelStyle}>Items</span>
            {factura.detalles.map((d, i) => (
              <span key={i} style={{ fontSize: '0.7rem' }}>
                #{i + 1}: {d.cantidad} × ${d.precio_unitario} = <strong style={valStyle}>${((d.cantidad || 0) * (d.precio_unitario || 0)).toFixed(2)}</strong>
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  };

  /* Estados independientes para flete, seguro y otros gastos.
     Usa ?? en vez de || para que el valor 0 real no sea tratado como falso y
     se reemplace por el fallback hardcodeado. */
  const [flete, setFlete] = useState(() => {
    const v = rawData?.economia?.envio ?? historyData?.flete ?? factura.flete;
    const r = parseFloat(v);
    return isNaN(r) ? 0 : r;
  });
  const [seguro, setSeguro] = useState(() => {
    const v = rawData?.economia?.seguro ?? historyData?.seguro ?? factura.seguro;
    const r = parseFloat(v);
    return isNaN(r) ? 0 : r;
  });
  const [otrosGastos, setOtrosGastos] = useState(() => {
    const v = rawData?.economia?.otros ?? historyData?.otros ?? factura.otros;
    const r = parseFloat(v);
    return isNaN(r) ? 0 : r;
  });
  const [paisDestino, setPaisDestino] = useState('CL');
  const [aplicaTLC, setAplicaTLC] = useState(false);
  const [dtaTasa, setDtaTasa] = useState(0.8);
  const [tabActivo, setTabActivo] = useState('detalles');
  const [despachantesList, setDespachantesList] = useState([]);
  const [despachanteId, setDespachanteId] = useState(null);
  const [despachanteData, setDespachanteData] = useState(null);
  const [clientesList, setClientesList] = useState([]);
  const [clienteSelectId, setClienteSelectId] = useState(null);
  const [isObsOpen, setIsObsOpen] = useState(true);
  const [tlcInfo, setTlcInfo] = useState(null);
  const [evaluandoTLC, setEvaluandoTLC] = useState(false);
  const [classificationData, setClassificationData] = useState({});
  const [aclaracionModal, setAclaracionModal] = useState(false);
  const [aclaracionMensaje, setAclaracionMensaje] = useState('');
  const [emailAclaracion, setEmailAclaracion] = useState('');
  const [aclaracionEnviando, setAclaracionEnviando] = useState(false);
  const [aclaracionEnviada, setAclaracionEnviada] = useState(false);
  const [aclaracionInfo, setAclaracionInfo] = useState('');
  const [informeModal, setInformeModal] = useState(false);
  const [informeEmail, setInformeEmail] = useState('');
  const [informeEnviando, setInformeEnviando] = useState(false);
  const [informeEnviado, setInformeEnviado] = useState(false);
  const [informeInfo, setInformeInfo] = useState('');
  const [informePais, setInformePais] = useState('CL');
  const [informeTLC, setInformeTLC] = useState(false);
  const [informeDTA, setInformeDTA] = useState(0.8);
  const [pdfSelectorField, setPdfSelectorField] = useState(null);
  const [rrnaDocuments, setRrnaDocuments] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [aprobarOk, setAprobarOk] = useState(false);
  const [vbbRefreshKey, setVbbRefreshKey] = useState(0);
  const [confirmacionPartida, setConfirmacionPartida] = useState({
    abierto: false, partida: '', descripcion: '', itemDescripcion: '',
    entidades: [], cargandoEntidades: false, metadata: null, itemId: null,
  });
  const [bloqueado, setBloqueado] = useState(false);
  const [prevalidando, setPrevalidando] = useState(false);
  const [landedCost, setLandedCost] = useState(null);
  const [landedCostLoading, setLandedCostLoading] = useState(false);

  /* Obtiene la configuracion visual segun el nivel de riesgo */
  const stats = STATUS_MAP[factura.riesgo] || STATUS_MAP.medio;
  const StatIcon = stats.icon;

  /* Extrae las partidas arancelarias únicas desde los detalles de la factura */
  const partidasList = factura.detalles
    .map(d => (d.partida_corregida || d.partida_sugerida || '').substring(0, 4))
    .filter(Boolean);
  const partidaPrincipal = partidasList[0] || '8471';

  /* Marca un campo del formulario como modificado para resaltarlo visualmente */
  const mkMod = (k) => setCamposMod(p => ({ ...p, [k]: true }));

  /* Actualiza un campo de un item específico dentro de los detalles */
  const handleCorrection = (idDetail, field, value) => {
    setFactura(prev => {
      const nd = prev.detalles.map(d => d.id === idDetail ? { ...d, [field]: value } : d);
      return { ...prev, detalles: nd };
    });
    mkMod(`item_${idDetail}_${field}`);
  };

  /* Solicita clasificación arancelaria por IA para un item */
  const handleAiClassification = async (idDetail, description) => {
    setClassificationData(prev => ({ ...prev, [idDetail]: { loading: true, error: null, result: null } }));
    try {
      const data = await peticionPost('/api/facturas/clasificar-item', { descripcion_producto: description });
      setClassificationData(prev => ({ ...prev, [idDetail]: { loading: false, error: null, result: data } }));
    } catch (err) {
      setClassificationData(prev => ({ ...prev, [idDetail]: { loading: false, error: err.message, result: null } }));
    }
  };

  /* Abre el modal de confirmación de partida arancelaria con las entidades regulatorias asociadas */
  const abrirConfirmacionPartida = async (idDetail, partida, metadata, descripcion) => {
    setConfirmacionPartida(p => ({ ...p, abierto: true, partida, descripcion, itemDescripcion: descripcion, metadata, itemId: idDetail, entidades: [], cargandoEntidades: true }));
    try {
      const data = await peticionGet(`/api/regulatorio/entidades-por-partida/${encodeURIComponent(partida)}`);
      setConfirmacionPartida(p => ({ ...p, entidades: data.entidades || [], cargandoEntidades: false }));
    } catch (err) {
      setConfirmacionPartida(p => ({ ...p, entidades: [], cargandoEntidades: false }));
      console.error('Error al obtener entidades:', err);
    }
  };

  /* Aplica la partida sugerida por IA al item y abre el modal de confirmación regulatoria */
  const handleAplicarPartidaIA = (idDetail, partida, metadata) => {
    setFactura(prev => {
      const nd = prev.detalles.map(d =>
        d.id === idDetail ? { ...d, partida_corregida: partida, partida_metadata: metadata } : d
      );
      return { ...prev, detalles: nd };
    });
    mkMod(`item_${idDetail}_partida`);
    const item = factura.detalles.find(d => d.id === idDetail);
    abrirConfirmacionPartida(idDetail, partida, metadata, item?.descripcion || '');
  };

  /* Confirma la partida, la registra en el catálogo y sincroniza los V°B° regulatorios */
  const handleConfirmarPartidaYVBB = async (entidadesSeleccionadas) => {
    const { partida, itemDescripcion, metadata, itemId } = confirmacionPartida;
    setConfirmacionPartida(p => ({ ...p, abierto: false }));
    try {
      await peticionPost('/api/catalogo/partidas', {
        descripcion_producto: itemDescripcion,
        partida_arancelaria: partida,
      });
    } catch (e) {
      console.error('Error registrando partida en catálogo:', e);
    }
    const docId = id || historyData?.id;
    if (docId && docId !== 'null') {
      try {
        const updatedPartidas = factura.detalles
          .map(d => d.id === itemId ? partida : (d.partida_corregida || d.partida_sugerida || ''))
          .map(p => p.substring(0, 4))
          .filter(Boolean);
        await peticionPost(`/api/regulatorio/documentos/${docId}/vistos-buenos/sincronizar`, {
          partidas: updatedPartidas,
        });
        setVbbRefreshKey(k => k + 1);
      } catch (e) {
        console.error('Error sincronizando V°B°:', e);
      }
    }
  };

  /* Envía una solicitud de aclaración al importador por correo electrónico */
  const handleSolicitarAclaracion = async () => {
    const docId = id || historyData?.id;
    if (!aclaracionMensaje.trim() || !docId || docId === 'null') return;
    setAclaracionEnviando(true);
    try {
      const res = await peticionPost(`/api/documentos/${docId}/solicitar-aclaracion`, {
        mensaje: aclaracionMensaje.trim(),
        email: emailAclaracion || null,
      });
      let infoExtra = '';
      if (res.email_enviado) {
        infoExtra = `Correo enviado a ${res.email_destino}`;
      } else if (res.email_destino) {
        infoExtra = `No se pudo enviar el correo a ${res.email_destino}. Revise la configuracion SMTP.`;
      } else {
        infoExtra = 'El importador no tiene email registrado.';
      }
      setAclaracionInfo(infoExtra);
      setAclaracionEnviada(true);
      setAclaracionModal(false);
      setAclaracionMensaje('');
    } catch (err) {
      alert('Error al enviar la solicitud: ' + err.message);
    } finally {
      setAclaracionEnviando(false);
    }
  };

  /* Envia el informe PDF por correo electronico */
  const handleEnviarInforme = async () => {
    const docId = id || historyData?.id;
    if (!informeEmail.trim() || !docId || docId === 'null') return;
    setInformeEnviando(true);
    try {
      const res = await peticionPost(`/api/documentos/${docId}/enviar-informe`, {
        email: informeEmail.trim(),
        pais_destino: informePais,
        aplica_tlc: informeTLC,
        dta_tasa: informeDTA,
      });
      setInformeInfo(res.email_enviado
        ? `Informe enviado a ${res.email_destino}`
        : 'No se pudo enviar el correo. Verifique la configuración SMTP.');
      setInformeEnviado(true);
      setInformeModal(false);
      setInformeEmail('');
    } catch (err) {
      alert('Error al enviar el informe: ' + err.message);
    } finally {
      setInformeEnviando(false);
    }
  };

  /* Maneja el texto extraído desde el selector de PDF y lo asigna al campo correspondiente */
  const handlePdfTextExtracted = (text) => {
    if (pdfSelectorField === 'monto_total') {
      const numeric = parseFloat(text.replace(/[^0-9.,]/g, '').replace(/\./g, '').replace(',', '.'));
      if (!isNaN(numeric)) { setFactura(prev => ({ ...prev, monto_total: numeric })); mkMod('monto_total'); }
    }
    setPdfSelectorField(null);
  };

  /* Asocia un archivo RRNA (registro sanitario) a un item */
  const handleRrnaFileUpload = (itemId, file) => {
    if (!file) return;
    setRrnaDocuments(prev => ({ ...prev, [itemId]: { name: file.name, status: 'Validado', loading: false } }));
  };

  /* Elimina un archivo RRNA previamente asociado a un item */
  const removeRrnaDocument = (itemId) => {
    setRrnaDocuments(prev => { const c = { ...prev }; delete c[itemId]; return c; });
  };

  const docId = id || historyData?.id;

  /* Obtiene el landed cost actualizado al cambiar los parámetros de simulación */
  useEffect(() => {
    if (!docId || docId === 'null' || docId === 'undefined') return;
    setLandedCostLoading(true);
    const params = new URLSearchParams({
      pais_destino: paisDestino,
      aplica_tlc: String(aplicaTLC),
      dta_tasa: String(dtaTasa),
    });
    peticionGet(`/api/documentos/${docId}/landed-cost?${params}`)
      .then(setLandedCost)
      .catch(() => setLandedCost(null))
      .finally(() => setLandedCostLoading(false));
  }, [paisDestino, aplicaTLC, dtaTasa, flete, seguro, otrosGastos]);

  /* Valores derivados del landed cost para mostrar en la liquidación tributaria */
  const lc = landedCost;
  const valorFOB = lc?.valor_fob ?? factura.detalles.reduce(
    (s, i) => s + (parseFloat(i.cantidad || 0) * parseFloat(i.precio_unitario || 0)), 0
  );
  const valorCIF = lc?.valor_cif ?? (valorFOB + parseFloat(flete || 0) + parseFloat(seguro || 0) + parseFloat(otrosGastos || 0));
  const impuestoAdValorem = lc?.impuesto_advalorem ?? 0;
  const dtaCalculado = lc?.dta ?? 0;
  const tasaIVA = lc?.tasa_iva ?? 19;
  const tasaAdValorem = lc?.tasa_advalorem ?? 6;
  const impuestoIVA = lc?.impuesto_iva ?? 0;
  const totalTributos = lc?.total_tributos ?? 0;

  /* Obtiene el documento desde la API cuando se carga directamente por URL (sin state) */
  useEffect(() => {
    if (!cargandoDoc || !id || id === 'null' || id === 'undefined') return;
    setCargandoDoc(true);
    peticionGet(`/api/documentos/${id}`)
      .then(data => {
        /* Toma los datos originales de la IA como respaldo para documentos
           creados antes de que existieran las columnas en la base de datos */
        const orig = data.datos_originales ?? {};
        setFactura(prev => ({
          ...prev,
          numero: data.numero_factura ?? orig.numero_factura ?? data.nombre_archivo ?? 'N/A',
          emisor: data.proveedor ?? 'N/A',
          monto_total: data.total_cif ?? 0,
          riesgo: data.riesgo ?? 'medio',
          observaciones: 'Cargado desde base de datos.',
          moneda: data.moneda ?? 'USD',
          incoterm: data.incoterm ?? orig.incoterm ?? '',
          pais_origen: data.pais_origen ?? orig.pais_origen ?? '',
          flete: data.flete ?? 0,
          seguro: data.seguro ?? 0,
          otros: data.otros ?? 0,
          receptor: data.cliente ?? '',
          subtotal: data.total_cif ?? 0,
          fecha: data.fecha_emision ?? '',
          monto_subtotal: data.monto_subtotal ?? 0,
          remitente_dir: data.remitente_dir ?? '',
          remitente_doc: data.remitente_doc ?? '',
          destinatario_dir: data.destinatario_dir ?? '',
          transporte_pais: data.transporte_pais ?? '',
          transporte_metodo: data.transporte_metodo ?? '',
          peso_bruto: data.peso_bruto ?? 0,
          peso_neto: data.peso_neto ?? 0,
          receptor_tax: data.receptor_tax ?? '',
          detalles: (data.partidas ?? []).map(p => ({
            id: p.id,
            descripcion: p.descripcion,
            cantidad: p.cantidad,
            precio_unitario: p.precio_unitario,
            partida_sugerida: p.partida_sugerida ?? '',
            partida_corregida: p.partida_corregida ?? '',
            inconsistente: false,
          })),
        }));
        if (data.datos_originales) setDatosOriginales(data.datos_originales);
        setFlete(data.flete ?? 0);
        setSeguro(data.seguro ?? 0);
        setOtrosGastos(data.otros ?? 0);
        if (data.bloqueado) setBloqueado(true);
        if (data.despachante_id) setDespachanteId(data.despachante_id);
        setDocumentoFetchado(true);
      })
      .catch(() => {})
      .finally(() => setCargandoDoc(false));
  }, []);

  /* Evalúa si aplica un tratado de libre comercio según el país de origen y la partida principal */
  useEffect(() => {
    setEvaluandoTLC(true);
    fetch(`/api/regulatorio/tlc/evaluar?pais_origen=${factura.pais_origen || 'CN'}&pais_destino=${paisDestino}&partida=${partidaPrincipal}`)
      .then(r => r.json())
      .then(data => { setTlcInfo(data); if (data.tlc_aplica) setAplicaTLC(true); })
      .catch(() => setTlcInfo(null))
      .finally(() => setEvaluandoTLC(false));
  }, [paisDestino, partidaPrincipal]);

  /* Sincroniza el estado bloqueado desde datos históricos o desde el fetch inicial */
  useEffect(() => {
    if (historyData?.bloqueado || documentoFetchado?.bloqueado) {
      setBloqueado(true);
    }
  }, [historyData, documentoFetchado]);

  /* Obtiene el PDF con autenticación JWT y lo convierte en blob local para evitar errores 401 */
  useEffect(() => {
    if (!pdfUrl) { setPdfBlobUrl(null); return; }
    let cancel = false;
    let blobUrl = null;
    setPdfCargando(true);
    const token = obtenerToken();
    fetch(pdfUrl, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then(blob => {
        if (!cancel) { blobUrl = URL.createObjectURL(blob); setPdfBlobUrl(blobUrl); }
      })
      .catch(() => { if (!cancel) setPdfBlobUrl(null); })
      .finally(() => { if (!cancel) setPdfCargando(false); });
    return () => { cancel = true; if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [pdfUrl]);

  /* Sincroniza despachante y cliente desde datos históricos o del fetch inicial */
  useEffect(() => {
    if (historyData?.despachante_id) {
      setDespachanteId(historyData.despachante_id);
    } else if (documentoFetchado?.despachante_id) {
      setDespachanteId(documentoFetchado.despachante_id);
    }
    if (documentoFetchado?.cliente_id) {
      setClienteSelectId(documentoFetchado.cliente_id);
    }
  }, [historyData, documentoFetchado]);

  /* Actualiza los datos completos del despachante al seleccionar uno */
  useEffect(() => {
    if (!despachanteId) { setDespachanteData(null); return; }
    const d = despachantesList.find(x => x.id === despachanteId);
    setDespachanteData(d || null);
  }, [despachanteId, despachantesList]);

  /* Cambia el despachante asignado al documento y persiste el cambio */
  const handleDespachanteChange = async (e) => {
    const val = e.target.value ? parseInt(e.target.value) : null;
    setDespachanteId(val);
    const docId = id || historyData?.id;
    if (!docId || docId === 'null') return;
    try {
      await peticionPut(`/api/documentos/${docId}/despachante`, { despachante_id: val });
    } catch {}
  };

  /* Guarda los cambios del documento en el backend */
  const handleGuardar = async () => {
    const targetId = id;
    if (!targetId || targetId === 'null' || targetId === 'undefined') {
      alert('El documento debe estar guardado en base de datos antes de editar.');
      return;
    }
    setGuardando(true);
    setSaveOk(false);
    try {
      await peticionPut(`/api/documentos/${targetId}`, {
        proveedor: factura.emisor,
        cliente: factura.receptor,
        total_cif: parseFloat(factura.monto_total) || 0,
        flete: parseFloat(flete) || 0,
        seguro: parseFloat(seguro) || 0,
        otros: parseFloat(otrosGastos) || 0,
        riesgo: factura.riesgo,
        cliente_id: clienteSelectId,
        partidas: (factura.detalles || []).map((d, i) => ({
          descripcion: d.descripcion,
          cantidad: d.cantidad,
          precio_unitario: d.precio_unitario,
          partida_sugerida: d.partida_sugerida,
          partida_corregida: d.partida_corregida,
          orden: i,
        })),
        /* Campos extra de la factura */
        fecha_emision: factura.fecha || '',
        moneda: factura.moneda || 'USD',
        monto_subtotal: parseFloat(factura.monto_subtotal) || 0,
        remitente_dir: factura.remitente_dir || '',
        remitente_doc: factura.remitente_doc || '',
        destinatario_dir: factura.destinatario_dir || '',
        transporte_pais: factura.transporte_pais || '',
        transporte_metodo: factura.transporte_metodo || '',
        peso_bruto: parseFloat(factura.peso_bruto) || 0,
        peso_neto: parseFloat(factura.peso_neto) || 0,
        receptor_tax: factura.receptor_tax || '',
        numero_factura: factura.numero || '',
        incoterm: factura.incoterm || '',
        pais_origen: factura.pais_origen || '',
      });
      setGuardando(false);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
    } catch (e) {
      setGuardando(false);
      alert('Error al guardar: ' + e.message);
    }
  };

  /* Aprueba el documento o solicita aprobación administrativa según el rol y riesgo */
  const handlePreAprove = async () => {
    setAprobarOk(false);
    const targetId = id || historyData?.id;
    const esAdmin = isAdmin;
    const esRiesgoAlto = factura.riesgo === 'alto';
    const requiereRevision = !esAdmin && esRiesgoAlto;
    if (targetId && targetId !== 'null') {
      try {
        const data = await peticionPut(`/api/documentos/${targetId}/aprobar`, {
          nuevo_total: parseFloat(factura.monto_total),
          solicitar_revision: requiereRevision,
        });
        setAprobarOk(true);
        setTimeout(() => { alert(data.mensaje || 'Operación procesada con éxito.'); navigate(esAdmin ? '/maestro' : '/historial'); }, 500);
      } catch (err) {
        alert('Error de red al intentar contactar con el servidor.');
      }
    } else {
      alert('¡Datos validados en memoria!');
      navigate('/');
    }
  };

  /* Prevalida, aprueba y bloquea el documento (solo administradores) */
  const handlePrevalidarAprobar = async () => {
    const targetId = id || historyData?.id;
    if (!targetId || targetId === 'null') {
      alert('No hay un documento en historial para prevalidar.');
      return;
    }
    setPrevalidando(true);
    try {
      await peticionPut(`/api/documentos/${targetId}/prevalidar-aprobar`, { confirmar: true });
      setBloqueado(true);
      setFactura(prev => ({ ...prev, estado: 'Aprobado' }));
      alert('Documento prevalidado, aprobado y bloqueado con éxito.');
    } catch (err) {
      alert('Error al prevalidar: ' + err.message);
    } finally {
      setPrevalidando(false);
    }
  };

  /* Exporta los detalles de la factura a un archivo CSV */
  const handleExportCSV = () => {
    const headers = ['Nro_Item', 'Descripcion_Producto', 'Cantidad', 'Precio_Unitario_USD', 'Total_Linea_USD', 'Partida_Arancelaria'];
    const rows = factura.detalles.map((item, index) => [
      index + 1, `"${item.descripcion}"`, item.cantidad, item.precio_unitario,
      (parseFloat(item.cantidad || 0) * parseFloat(item.precio_unitario || 0)).toFixed(2),
      item.partida_corregida || item.partida_sugerida,
    ]);
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `WebCheck_Factura_${factura.numero}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /* Objeto con estilos reutilizables para badges y alertas */
  const S = {
    badge: (color, bg) => ({
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '5px 14px', borderRadius: '20px', fontWeight: 700,
      fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.03em',
      background: bg, color, border: `1px solid ${color}40`,
    }),
    alertBox: (sev) => ({
      padding: '12px 16px', borderRadius: '10px',
      border: `1px solid ${sev === 'FAIL' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
      background: `${sev === 'FAIL' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)'}`,
      display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.8rem', lineHeight: 1.5,
    }),
  };

  return (
    <div className="fade-in" style={{ background: v('bg-color'), color: v('text-main') }}>
      {/* Encabezado con botón volver, título y acciones */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 28px',
        background: v('card-bg'),
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => navigate(isAdmin ? '/maestro' : '/historial')} className="btn btn-secondary" style={{ padding: '8px 12px' }} title="Volver">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, color: v('text-main'), letterSpacing: '-0.3px' }}>
              Revisión de Factura
            </h1>
            <p style={{ color: v('text-muted'), marginTop: '2px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{factura.emisor}</span>
              <span style={{ color: v('primary'), fontWeight: 600 }}>· {factura.numero}</span>
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={handleExportCSV} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
            <Download size={14} /> CSV
          </button>
          {!bloqueado && ((id && id !== 'null') || historyData?.id) && (
            <button onClick={() => { setAclaracionModal(true); setAclaracionEnviada(false); setAclaracionInfo(''); if (clienteSelectId) { const c = clientesList.find(x => x.id === clienteSelectId); if (c?.email) setEmailAclaracion(c.email); } }}
              className="btn" style={{ padding: '8px 14px', fontSize: '0.85rem', backgroundColor: 'rgba(245,158,11,0.1)', color: v('yellow'), border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600 }}>
              <MessageSquare size={14} /> Aclaración
            </button>
          )}
          {((id && id !== 'null') || historyData?.id) && (
            <button onClick={() => { setInformeModal(true); setInformeEnviado(false); setInformeInfo(''); if (clienteSelectId) { const c = clientesList.find(x => x.id === clienteSelectId); if (c?.email) setInformeEmail(c.email); } }}
              className="btn" style={{ padding: '8px 14px', fontSize: '0.85rem', backgroundColor: 'rgba(59,130,246,0.1)', color: v('primary'), border: '1px solid rgba(59,130,246,0.3)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600 }}>
              <Send size={14} /> Informe
            </button>
          )}
        </div>
      </div>

      {/* Pantalla dividida: PDF a la izquierda, formulario a la derecha */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', height: 'calc(100vh - 140px)' }}>
        {/* Panel izquierdo: visor de PDF */}
        <div className="glass-panel" style={{
          borderRadius: '10px', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 20px', borderBottom: `1px solid ${v('card-border')}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: v('text-muted'), margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={16} color={v('primary')} /> Documento Original (PDF)
            </h2>
            {pdfUrl && pdfBlobUrl && (
              <a href={pdfBlobUrl} download target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem', textDecoration: 'none' }}>
                <Download size={12} /> Descargar
              </a>
            )}
          </div>
          {pdfUrl ? (
            pdfCargando ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#525659', color: v('text-muted') }}>
                <Loader2 size={24} className="spin" />
              </div>
            ) : pdfBlobUrl ? (
              <object data={pdfBlobUrl} type="application/pdf" width="100%" height="100%" style={{ flex: 1, background: '#525659' }}>
                <p style={{ textAlign: 'center', padding: '40px', color: v('text-muted') }}>No se pudo cargar el PDF.</p>
              </object>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: v('text-muted'), padding: '40px', textAlign: 'center' }}>
                <FileText size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                <p>No se pudo cargar el PDF.</p>
                <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Verifica que el archivo exista en el servidor.</span>
              </div>
            )
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: v('text-muted'), padding: '40px', textAlign: 'center' }}>
              <FileText size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
              <p>El PDF original no está disponible.</p>
              <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Solo disponible para documentos escaneados a partir de esta actualización.</span>
            </div>
          )}
        </div>

        {/* Panel derecho: formulario de revisión */}
        <div ref={rightPanelRef} style={{
          overflowY: 'auto', overflowX: 'hidden', background: v('bg-color'),
          display: 'flex', flexDirection: 'column',
          border: `1px solid ${v('card-border')}`, borderRadius: '10px',
        }}>
          <div style={{ padding: '4px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {/* Barra de estado con indicador de riesgo */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={S.badge(stats.color, stats.bg)}>
                  <StatIcon size={14} /> {stats.label}
                </div>
                {bloqueado && (
                  <div style={{ ...S.badge('var(--green)', 'rgba(16,185,129,0.1)'), borderColor: 'rgba(16,185,129,0.3)' }}>
                    <Lock size={12} /> Aprobado
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.75rem', color: v('text-muted') }}>
                <UserCheck size={12} />
                {isAdmin ? 'Administrador' : 'Agente'} · {factura.moneda}
              </div>
            </div>

            {/* ——— Datos del Documento ——— */}
            <div className="glass-panel" style={{ padding: '8px 14px' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: v('text-muted'), letterSpacing: '0.04em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={12} /> Datos del Documento
              </div>
              <div className="grid-2" style={{ gap: '6px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Cliente</label>
                  <select className="form-input"
                    style={{ width: '100%', cursor: 'pointer', ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}
                    value={clienteSelectId || ''} disabled={bloqueado}
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value) : null;
                      setClienteSelectId(val);
                      if (val) { const c = clientesList.find(x => x.id === val); if (c) { setFactura(p => ({ ...p, receptor: c.razon_social })); setEmailAclaracion(c.email || ''); } }
                      else { setEmailAclaracion(''); }
                    }}
                  >
                    <option value="">— Sin cliente —</option>
                    {clientesList.map(c => (
                      <option key={c.id} value={c.id}>{c.razon_social} ({c.identificacion_fiscal})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Receptor</label>
                  <input className="form-input"
                    style={{ ...(camposMod['receptor'] ? { borderColor: v('primary'), boxShadow: `0 0 0 1px ${v('primary')}` } : {}), ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}
                    type="text" value={factura.receptor} disabled={bloqueado}
                    onChange={(e) => { if (!bloqueado) { setFactura(p => ({ ...p, receptor: e.target.value })); mkMod('receptor'); }}}
                  />
                  <ValorOriginal campo="receptor" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">RUT / Tax ID</label>
                  <input className="form-input" style={{
                    ...(camposMod.receptor_tax ? { borderColor: v('primary'), boxShadow: `0 0 0 1px ${v('primary')}` } : {}),
                    ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                  }}
                    type="text" value={factura.receptor_tax} disabled={bloqueado}
                    onChange={(e) => { if (!bloqueado) { setFactura(p => ({ ...p, receptor_tax: e.target.value })); mkMod('receptor_tax'); }}}
                  />
                  <ValorOriginal campo="receptor_tax" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">País Origen</label>
                  <input className="form-input" style={{
                    ...(camposMod.pais_origen ? { borderColor: v('primary'), boxShadow: `0 0 0 1px ${v('primary')}` } : {}),
                    ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                  }}
                    type="text" value={factura.pais_origen} disabled={bloqueado}
                    onChange={(e) => { if (!bloqueado) { setFactura(p => ({ ...p, pais_origen: e.target.value })); mkMod('pais_origen'); }}}
                  />
                  <ValorOriginal campo="pais_origen" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Incoterm</label>
                  <input className="form-input" style={{
                    ...(camposMod.incoterm ? { borderColor: v('primary'), boxShadow: `0 0 0 1px ${v('primary')}` } : {}),
                    ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                  }}
                    type="text" value={factura.incoterm} disabled={bloqueado}
                    onChange={(e) => { if (!bloqueado) { setFactura(p => ({ ...p, incoterm: e.target.value })); mkMod('incoterm'); }}}
                  />
                  <ValorOriginal campo="incoterm" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">N° Factura</label>
                  <input className="form-input" type="text" value={factura.numero} disabled />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Fecha Emisión</label>
                  <input className="form-input" type="text" value={factura.fecha} disabled={bloqueado}
                    style={{
                      ...(camposMod.fecha ? { borderColor: v('primary'), boxShadow: `0 0 0 1px ${v('primary')}` } : {}),
                      ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                    }}
                    onChange={(e) => { if (!bloqueado) { setFactura(p => ({ ...p, fecha: e.target.value })); mkMod('fecha'); }}}
                  />
                  <ValorOriginal campo="fecha" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Moneda</label>
                  <select className="form-input" value={factura.moneda} disabled={bloqueado}
                    style={{
                      ...(camposMod.moneda ? { borderColor: v('primary'), boxShadow: `0 0 0 1px ${v('primary')}` } : {}),
                      ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}), cursor: 'pointer',
                    }}
                    onChange={(e) => { if (!bloqueado) { setFactura(p => ({ ...p, moneda: e.target.value })); mkMod('moneda'); }}}>
                    {['USD','EUR','GBP','JPY','CNY','BRL','ARS','MXN','CLP','PEN','COP'].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <ValorOriginal campo="moneda" />
                </div>
              </div>
            </div>

            {/* ——— Direcciones ——— */}
            <div className="glass-panel" style={{ padding: '8px 14px' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: v('text-muted'), letterSpacing: '0.04em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={12} /> Direcciones
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                  <label className="form-label">Remitente</label>
                  <input className="form-input" type="text" value={factura.remitente_dir}
                    disabled={bloqueado} placeholder="No detectada"
                    style={{
                      fontSize: '0.78rem',
                      ...(camposMod.remitente_dir ? { borderColor: v('primary'), boxShadow: `0 0 0 1px ${v('primary')}` } : {}),
                      ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                    }}
                    onChange={(e) => { if (!bloqueado) { setFactura(p => ({ ...p, remitente_dir: e.target.value })); mkMod('remitente_dir'); }}}
                  />
                  <ValorOriginal campo="remitente_dir" />
                </div>
                <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                  <label className="form-label">Destinatario</label>
                  <input className="form-input" type="text" value={factura.destinatario_dir}
                    disabled={bloqueado} placeholder="No detectada"
                    style={{
                      fontSize: '0.78rem',
                      ...(camposMod.destinatario_dir ? { borderColor: v('primary'), boxShadow: `0 0 0 1px ${v('primary')}` } : {}),
                      ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                    }}
                    onChange={(e) => { if (!bloqueado) { setFactura(p => ({ ...p, destinatario_dir: e.target.value })); mkMod('destinatario_dir'); }}}
                  />
                  <ValorOriginal campo="destinatario_dir" />
                </div>
              </div>
            </div>

            {/* ——— Despachante ——— */}
            <div className="glass-panel" style={{ padding: '8px 14px' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: v('text-muted'), letterSpacing: '0.04em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User size={12} /> Despachante
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <select className="form-input" value={despachanteId || ''} onChange={handleDespachanteChange}
                    style={{ width: '100%', cursor: 'pointer' }}>
                    <option value="">Sin despachante</option>
                    {despachantesList.map(d => (
                      <option key={d.id} value={d.id}>{d.nombre}{d.rut ? ` (${d.rut})` : ''}</option>
                    ))}
                  </select>
                </div>
                {despachanteData && (
                  <div style={{ fontSize: '0.75rem', color: v('text-muted'), paddingBottom: '4px', whiteSpace: 'nowrap' }}>
                    {despachanteData.telefono && <span style={{ display: 'block' }}>Tel: {despachanteData.telefono}</span>}
                    {despachanteData.email && <span style={{ display: 'block' }}>Email: {despachanteData.email}</span>}
                  </div>
                )}
              </div>
            </div>

            {/* ——— Valores ——— */}
            <div className="glass-panel" style={{ padding: '8px 14px' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: v('text-muted'), letterSpacing: '0.04em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <DollarSign size={12} /> Valores
              </div>
              <div className="grid-2" style={{ gap: '6px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    Monto Total (USD)
                    {pdfUrl && (
                      <button onClick={() => setPdfSelectorField('monto_total')} title="Extraer del PDF"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: v('primary'), padding: 0, display: 'inline-flex' }}>
                        <Scan size={12} />
                      </button>
                    )}
                  </label>
                  <input className="form-input"
                    style={{
                      ...(camposMod.monto_total ? { borderColor: v('primary'), boxShadow: `0 0 0 1px ${v('primary')}` } : {}),
                      ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                      fontWeight: 700, color: v('green'),
                    }}
                    type="number" onWheel={e => e.target.blur()} value={factura.monto_total} disabled={bloqueado}
                    onChange={(e) => { if (!bloqueado) { setFactura(p => ({ ...p, monto_total: Math.max(0, parseFloat(e.target.value) || 0) })); mkMod('monto_total'); }}}
                  />
                  <ValorOriginal campo="monto_total" formato="moneda" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Subtotal (USD)</label>
                  <input className="form-input" type="number" onWheel={e => e.target.blur()}
                    value={factura.monto_subtotal} disabled={bloqueado}
                    style={{
                      ...(camposMod.monto_subtotal ? { borderColor: v('primary'), boxShadow: `0 0 0 1px ${v('primary')}` } : {}),
                      ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                    }}
                    onChange={(e) => { if (!bloqueado) { setFactura(p => ({ ...p, monto_subtotal: Math.max(0, parseFloat(e.target.value) || 0) })); mkMod('monto_subtotal'); }}}
                  />
                  <ValorOriginal campo="monto_subtotal" formato="moneda" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Flete (USD)</label>
                  <input className="form-input" style={{
                    ...(camposMod.flete ? { borderColor: v('primary'), boxShadow: `0 0 0 1px ${v('primary')}` } : {}),
                    ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                  }}
                    type="number" onWheel={e => e.target.blur()} value={flete} disabled={bloqueado}
                    onChange={(e) => { if (!bloqueado) { setFlete(Math.max(0, parseFloat(e.target.value) || 0)); mkMod('flete'); }}}
                  />
                  <ValorOriginal campo="flete" formato="moneda" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Seguro (USD)</label>
                  <input className="form-input" style={{
                    ...(camposMod.seguro ? { borderColor: v('primary'), boxShadow: `0 0 0 1px ${v('primary')}` } : {}),
                    ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                  }}
                    type="number" onWheel={e => e.target.blur()} value={seguro} disabled={bloqueado}
                    onChange={(e) => { if (!bloqueado) { setSeguro(Math.max(0, parseFloat(e.target.value) || 0)); mkMod('seguro'); }}}
                  />
                  <ValorOriginal campo="seguro" formato="moneda" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Otros (USD)</label>
                  <input className="form-input" style={{
                    ...(camposMod.otros ? { borderColor: v('primary'), boxShadow: `0 0 0 1px ${v('primary')}` } : {}),
                    ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                  }}
                    type="number" onWheel={e => e.target.blur()} value={otrosGastos} disabled={bloqueado}
                    onChange={(e) => { if (!bloqueado) { setOtrosGastos(Math.max(0, parseFloat(e.target.value) || 0)); mkMod('otros'); }}}
                  />
                  <ValorOriginal campo="otros" formato="moneda" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Valor CIF (USD)</label>
                  <input className="form-input" type="number" onWheel={e => e.target.blur()} value={valorCIF} disabled
                    style={{ fontWeight: 700, color: v('green'), opacity: 0.8 }}
                  />
                </div>
              </div>
            </div>

            {/* ——— Logística ——— */}
            <div className="glass-panel" style={{ padding: '8px 14px' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: v('text-muted'), letterSpacing: '0.04em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Truck size={12} /> Logística
              </div>
              <div className="grid-2" style={{ gap: '6px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">País Transporte</label>
                  <input className="form-input" type="text"
                    value={factura.transporte_pais} disabled={bloqueado} placeholder="No detectado"
                    style={{
                      ...(camposMod.transporte_pais ? { borderColor: v('primary'), boxShadow: `0 0 0 1px ${v('primary')}` } : {}),
                      ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}), fontSize: '0.8rem',
                    }}
                    onChange={(e) => { if (!bloqueado) { setFactura(p => ({ ...p, transporte_pais: e.target.value })); mkMod('transporte_pais'); }}}
                  />
                  <ValorOriginal campo="transporte_pais" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Método Transporte</label>
                  <input className="form-input" type="text"
                    value={factura.transporte_metodo} disabled={bloqueado} placeholder="No detectado"
                    style={{
                      ...(camposMod.transporte_metodo ? { borderColor: v('primary'), boxShadow: `0 0 0 1px ${v('primary')}` } : {}),
                      ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}), fontSize: '0.8rem',
                    }}
                    onChange={(e) => { if (!bloqueado) { setFactura(p => ({ ...p, transporte_metodo: e.target.value })); mkMod('transporte_metodo'); }}}
                  />
                  <ValorOriginal campo="transporte_metodo" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Peso Bruto (kg)</label>
                  <input className="form-input" type="number" onWheel={e => e.target.blur()}
                    value={factura.peso_bruto} disabled={bloqueado}
                    style={{
                      ...(camposMod.peso_bruto ? { borderColor: v('primary'), boxShadow: `0 0 0 1px ${v('primary')}` } : {}),
                      ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                    }}
                    onChange={(e) => { if (!bloqueado) { setFactura(p => ({ ...p, peso_bruto: Math.max(0, parseFloat(e.target.value) || 0) })); mkMod('peso_bruto'); }}}
                  />
                  <ValorOriginal campo="peso_bruto" formato="moneda" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Peso Neto (kg)</label>
                  <input className="form-input" type="number" onWheel={e => e.target.blur()}
                    value={factura.peso_neto} disabled={bloqueado}
                    style={{
                      ...(camposMod.peso_neto ? { borderColor: v('primary'), boxShadow: `0 0 0 1px ${v('primary')}` } : {}),
                      ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                    }}
                    onChange={(e) => { if (!bloqueado) { setFactura(p => ({ ...p, peso_neto: Math.max(0, parseFloat(e.target.value) || 0) })); mkMod('peso_neto'); }}}
                  />
                  <ValorOriginal campo="peso_neto" formato="moneda" />
                </div>
              </div>
            </div>



            <CuadraturaItems />

            {/* Pestañas: Detalles de Ítems / Liquidación Tributaria / V°B° Regulatorios */}
            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', borderBottom: `1px solid ${v('card-border')}` }}>
                {[
                  { id: 'detalles', label: 'Detalles de Ítems', icon: Package },
                  { id: 'simulador', label: 'Liquidación Tributaria', icon: Calculator },
                  { id: 'prevalidacion', label: 'Prevalidación', icon: Shield },
                  { id: 'vbb', label: 'V°B° Regulatorios', icon: Flag },
                ].map(tab => {
                  const Icon = tab.icon;
                  const activo = tabActivo === tab.id;
                  return (
                    <button key={tab.id} onClick={() => setTabActivo(tab.id)}
                      style={{
                        flex: 1, padding: '8px 10px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                        border: 'none', borderBottom: activo ? `2px solid ${v('primary')}` : '2px solid transparent',
                        background: activo ? v('hover-bg') : 'transparent',
                        color: activo ? v('primary') : v('text-muted'),
                        display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}>
                      <Icon size={13} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Contenido de la pestaña activa */}
              <div style={{ padding: '4px 12px' }}>
                {tabActivo === 'detalles' && (
                  <ItemsTable
                    items={factura.detalles}
                    sinAcordeon={true}
                    open={true}
                    bloqueado={bloqueado}
                    camposMod={camposMod}
                    classificationData={classificationData}
                    rrnaDocuments={rrnaDocuments}
                    onCorrection={handleCorrection}
                    onAiClassification={handleAiClassification}
                    onAplicarPartida={handleAplicarPartidaIA}
                    onRrnaUpload={handleRrnaFileUpload}
                    onRrnaRemove={removeRrnaDocument}
                  />
                )}
                {tabActivo === 'simulador' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: v('text-muted'), letterSpacing: '0.5px' }}>
                      Parámetros
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div className="form-group" style={{ marginBottom: 0, flex: '0 0 220px' }}>
                        <label className="form-label"><Globe size={12} style={{ marginRight: '4px' }} /> País Destino</label>
                        <select value={paisDestino} onChange={(e) => setPaisDestino(e.target.value)} className="form-input" style={{ cursor: 'pointer' }}>
                          <option value="CL">Chile (IVA 19%)</option>
                          <option value="MX">México (IVA 16% / DTA)</option>
                          <option value="ES">España - UE (IVA 21%)</option>
                        </select>
                      </div>
                      {paisDestino === 'MX' && (
                        <div className="form-group" style={{ marginBottom: 0, flex: '0 0 120px' }}>
                          <label className="form-label">Tasa DTA (%)</label>
                          <input className="form-input" type="number" onWheel={e => e.target.blur()} step="0.01" value={dtaTasa}
                            onChange={(e) => setDtaTasa(Math.max(0, parseFloat(e.target.value) || 0))}
                          />
                        </div>
                      )}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px', height: '38px',
                        padding: '0 12px', marginBottom: 0,
                        background: aplicaTLC ? 'rgba(16,185,129,0.08)' : 'transparent',
                        border: `1px solid ${aplicaTLC ? 'rgba(16,185,129,0.3)' : v('card-border')}`,
                        borderRadius: '10px',
                      }}>
                        <input type="checkbox" id="tlc" checked={aplicaTLC}
                          onChange={(e) => setAplicaTLC(e.target.checked)}
                          style={{ width: '16px', height: '16px', accentColor: v('green'), cursor: 'pointer' }}
                        />
                        <label htmlFor="tlc" style={{ fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', color: v('text-main'), whiteSpace: 'nowrap' }}>
                          Aplicar TLC
                          {evaluandoTLC && <Loader2 size={12} className="spin" style={{ marginLeft: '8px' }} />}
                          {tlcInfo?.tlc_aplica && <span style={{ color: v('green'), fontSize: '0.7rem', marginLeft: '8px' }}>✓ {tlcInfo.nombre_tlc}</span>}
                        </label>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: v('text-muted'), letterSpacing: '0.5px', marginTop: '4px' }}>
                      Resultados
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.01)', border: `1px solid ${v('card-border')}`, borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                      {landedCostLoading ? (
                        <div style={{ textAlign: 'center', color: v('text-muted'), padding: '8px' }}>
                          <Loader2 size={16} className="spin" /> Calculando...
                        </div>
                      ) : (landedCost ? (
                        <><Fila calc="Valor FOB" val={`$${landedCost.valor_fob.toFixed(2)}`} />
                        <Fila calc="Incrementables" val={`$${landedCost.flete + landedCost.seguro + landedCost.otros}`} muted />
                        <div style={{ borderTop: `1px dashed ${v('card-border')}`, paddingTop: '10px' }}>
                          <Fila calc="Valor Aduana (CIF)" val={`$${landedCost.valor_cif.toFixed(2)}`} accent />
                        </div>
                        <Fila calc={`Arancel (${landedCost.tasa_advalorem}%)`} val={`$${landedCost.impuesto_advalorem.toFixed(2)}`} />
                        {paisDestino === 'MX' && <Fila calc={`DTA (${dtaTasa}%)`} val={`$${landedCost.dta.toFixed(2)}`} />}
                        <Fila calc={`IVA (${landedCost.tasa_iva}%)`} val={`$${landedCost.impuesto_iva.toFixed(2)}`} />
                        <div style={{ borderTop: `2px solid ${v('accent')}`, paddingTop: '12px' }}>
                          <Fila calc="TOTAL TRIBUTOS" val={`$${landedCost.total_tributos.toFixed(2)}`} total />
                        </div></>
                      ) : (
                        <div style={{ textAlign: 'center', color: v('text-muted'), padding: '8px', fontSize: '0.75rem' }}>
                          Guarda el documento para ver la liquidación.
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {tabActivo === 'prevalidacion' && (
                  <PipelinePrevalidacion prevalidacion={prevalidacionData} />
                )}
                {tabActivo === 'vbb' && (
                  <>
                    <GestorVistosBuenos documentoId={Number(id || historyData?.id)} partidas={partidasList} refreshKey={vbbRefreshKey} />
                    <ObservacionesPanel documentoId={Number(id || historyData?.id)} />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Barra de acciones inferior con botones centrados */}
          <div style={{
            padding: '8px 16px', borderTop: `1px solid ${v('card-border')}`,
            background: v('card-bg'), display: 'flex', alignItems: 'center', gap: '10px',
            justifyContent: 'center', flexShrink: 0, position: 'sticky', bottom: 0,
          }}>
            <button onClick={handleGuardar} className="btn btn-secondary" disabled={guardando || bloqueado} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {guardando ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
              {guardando ? 'Guardando...' : 'Guardar Cambios'}
            </button>
            {saveOk && <span style={{ color: v('green'), fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={14} /> Guardado</span>}
            {!bloqueado && ((id && id !== 'null') || historyData?.id) && isAdmin && (
              <button onClick={handlePrevalidarAprobar} disabled={prevalidando} className="btn" style={{
                fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px',
                background: 'rgba(139, 92, 246, 0.1)', color: '#a78bfa',
                border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '10px',
                cursor: prevalidando ? 'not-allowed' : 'pointer',
              }}>
                {prevalidando ? <Loader2 size={16} className="spin" /> : <Lock size={16} />}
                {prevalidando ? 'Prevalidando...' : 'Prevalidar y Bloquear'}
              </button>
            )}
            {(!isAdmin && factura.riesgo === 'alto') ? (
              <button onClick={handlePreAprove} className="btn btn-danger" disabled={bloqueado} style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={16} /> Solicitar Aprobación Admin
              </button>
            ) : (
              <button onClick={handlePreAprove} className="btn btn-primary" disabled={aprobarOk || bloqueado} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {aprobarOk ? <Loader2 size={16} className="spin" /> : <CheckCircle size={16} />}
                {aprobarOk ? 'Aprobando...' : 'Aprobar Envío'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal selector de texto desde PDF */}
      {pdfSelectorField && pdfUrl && (
        <PdfTextSelector pdfUrl={pdfUrl} fieldLabel="Monto Total CIF"
          onClose={() => setPdfSelectorField(null)} onTextSelected={handlePdfTextExtracted}
        />
      )}

      {/* Modal para enviar informe PDF por correo */}
      {informeModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        }}>
          <div className="glass-panel" style={{ width: '520px', maxWidth: '90vw', padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(59,130,246,0.1)' }}>
                <Send size={22} color={v('primary')} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: v('text-main') }}>Enviar Informe PDF</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: v('text-muted') }}>
                  Se generará un PDF profesional con todos los datos del documento, prevalidación, liquidación tributaria, ítems y V°B°.
                </p>
              </div>
            </div>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
              Email del destinatario
            </label>
            <input className="form-input" type="email" value={informeEmail}
              onChange={(e) => setInformeEmail(e.target.value)}
              placeholder="correo@destinatario.com"
              style={{ marginBottom: '12px', fontFamily: 'inherit', width: '100%' }}
            />
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
                  <Globe size={12} /> País Destino
                </label>
                <select className="form-input" value={informePais}
                  onChange={(e) => setInformePais(e.target.value)}
                  style={{ width: '100%', cursor: 'pointer' }}>
                  <option value="CL">Chile (IVA 19%)</option>
                  <option value="MX">México (IVA 16%)</option>
                  <option value="ES">España / UE (IVA 21%)</option>
                </select>
              </div>
              {informePais === 'MX' && (
                <div style={{ flex: '0 0 120px' }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
                    Tasa DTA (%)
                  </label>
                  <input className="form-input" type="number" step="0.1" value={informeDTA}
                    onChange={(e) => setInformeDTA(Math.max(0, parseFloat(e.target.value) || 0))}
                    style={{ width: '100%' }}
                  />
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px 0' }}>
                <input type="checkbox" id="inf-tlc" checked={informeTLC}
                  onChange={(e) => setInformeTLC(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: v('green'), cursor: 'pointer' }}
                />
                <label htmlFor="inf-tlc" style={{ fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', color: v('text-main'), whiteSpace: 'nowrap' }}>
                  Aplicar TLC
                </label>
              </div>
            </div>
            {informeEnviado && (
              <div style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: v('green'), fontWeight: 600 }}>
                <CheckCircle size={16} /> {informeInfo}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setInformeModal(false); setInformeEmail(''); setInformeInfo(''); setInformePais('CL'); setInformeTLC(false); setInformeDTA(0.8); }} className="btn btn-secondary">Cancelar</button>
              <button onClick={handleEnviarInforme} disabled={!informeEmail.trim() || informeEnviando}
                className="btn" style={{
                  padding: '8px 20px', fontSize: '0.85rem', fontWeight: 700, background: v('primary'), color: 'white',
                  border: 'none', borderRadius: '10px', cursor: informeEmail.trim() ? 'pointer' : 'not-allowed',
                  opacity: informeEmail.trim() ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                {informeEnviando ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                Enviar Informe
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación de partida arancelaria */}
      <ModalConfirmacionPartida
        abierto={confirmacionPartida.abierto}
        partida={confirmacionPartida.partida}
        descripcion={confirmacionPartida.descripcion}
        itemDescripcion={confirmacionPartida.itemDescripcion}
        entidades={confirmacionPartida.entidades}
        cargandoEntidades={confirmacionPartida.cargandoEntidades}
        onConfirmar={handleConfirmarPartidaYVBB}
        onCerrar={() => setConfirmacionPartida(p => ({ ...p, abierto: false }))}
      />

      {/* Modal de solicitud de aclaración al importador */}
      {aclaracionModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        }}>
          <div className="glass-panel" style={{ width: '500px', maxWidth: '90vw', padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(245,158,11,0.1)' }}>
                <MessageSquare size={22} color={v('yellow')} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: v('text-main') }}>Solicitar Aclaración al Importador</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: v('text-muted') }}>
                  El documento quedará en estado <strong style={{ color: v('yellow') }}>"En Espera"</strong>.
                </p>
              </div>
            </div>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
              Email del importador
            </label>
            <input className="form-input" type="email" value={emailAclaracion}
              onChange={(e) => setEmailAclaracion(e.target.value)}
              placeholder="correo@importador.com"
              style={{ marginBottom: '12px', fontFamily: 'inherit', width: '100%' }}
            />
            <textarea value={aclaracionMensaje} onChange={(e) => setAclaracionMensaje(e.target.value)}
              placeholder="Describa qué dato falta o qué corrección necesita..."
              rows={5}
              className="form-input" style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
            {aclaracionEnviada && (
              <div style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: v('green'), fontWeight: 600 }}>
                <CheckCircle size={16} /> {aclaracionInfo}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setAclaracionModal(false); setAclaracionMensaje(''); setAclaracionInfo(''); setEmailAclaracion(''); }} className="btn btn-secondary">Cancelar</button>
              <button onClick={handleSolicitarAclaracion} disabled={!aclaracionMensaje.trim() || aclaracionEnviando}
                className="btn" style={{
                  padding: '8px 20px', fontSize: '0.85rem', fontWeight: 700, background: v('yellow'), color: 'white',
                  border: 'none', borderRadius: '10px', cursor: aclaracionMensaje.trim() ? 'pointer' : 'not-allowed',
                  opacity: aclaracionMensaje.trim() ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                {aclaracionEnviando ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                Enviar Solicitud
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* Componente que renderiza una fila de cálculo en la liquidación tributaria */
const Fila = ({ calc, val, muted, accent, total }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <span style={{ color: muted ? v('text-muted') : v('text-muted'), fontWeight: total ? 700 : 400 }}>{calc}</span>
    <span style={{ fontWeight: total ? 800 : 600, color: total ? v('accent') : accent ? v('green') : v('text-main'), fontSize: total ? '1rem' : '0.85rem' }}>{val}</span>
  </div>
);

export default InvoiceDetail;

import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  AlertCircle, CheckCircle, Save, XCircle, ArrowLeft, Download,
  ShieldAlert, Sparkles, Loader2, Scale, Calculator, FileText,
  Globe, Percent, Printer, Send, MessageSquare, Scan, Hash,
  DollarSign, Package, Truck, UserCheck, Flag, Edit3, Lock,
  Eye, EyeOff, ChevronDown, ChevronUp, Info, ThumbsUp,
  X, Upload, FileCode, FileJson, FileSearch, Receipt,
} from 'lucide-react';
import { useAuth } from '../context/ContextoAuth';
import ObservacionesPanel from '../components/ObservacionesPanel';
import AsistenteClasificacionArancelaria from '../components/AsistenteClasificacionArancelaria';
import PdfTextSelector from '../components/PdfTextSelector';
import GestorVistosBuenos from '../components/GestorVistosBuenos';
import GarantiasPanel from '../components/GarantiasPanel';
import { API_BASE, peticionPut, peticionPost, peticionGet } from '../services/api';
import PipelinePrevalidacion from '../components/PipelinePrevalidacion';
import ModalConfirmacionPartida from '../components/ModalConfirmacionPartida';
import EstadoAduaneroTimeline from '../components/EstadoAduaneroTimeline';
import ItemsTable from '../components/ItemsTable';


import { cssVar as v } from '../lib/utils';

const STATUS_MAP = {
  alto: { label: 'Fallo de Regla', color: v('red'), bg: 'rgba(239,68,68,0.12)', icon: XCircle },
  medio: { label: 'Requiere Revisión', color: v('yellow'), bg: 'rgba(245,158,11,0.12)', icon: AlertCircle },
  bajo: { label: 'Aprobado Automatico', color: v('green'), bg: 'rgba(16,185,129,0.12)', icon: CheckCircle },
};

// Componente principal: vista detallada de una factura con visor PDF, edición y acciones
const InvoiceDetail = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Administrador';
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const rawData = location.state?.fullData;
  const historyData = location.state?.historyData;
  const docIdForPdf = historyData?.id || rawData?.id || id;
  const pdfUrl = location.state?.fileUrl || (docIdForPdf ? `${API_BASE}/api/documentos/${docIdForPdf}/archivo` : null);
  const prevalidacionData = location.state?.prevalidacion;
  const rightPanelRef = useRef(null);
  const [documentoFetchado, setDocumentoFetchado] = useState(false);
  const [cargandoDoc, setCargandoDoc] = useState(!rawData && !historyData && !!id && id !== 'null' && id !== 'undefined');

  // Construye el estado inicial de la factura desde rawData, historyData o vacío
  const buildInitialState = () => {
    if (rawData) {
      return {
        numero: rawData.factura?.numero || 'N/A',
        emisor: rawData.remitente?.nombre || 'N/A',
        monto_total: rawData.economia?.total || 0,
        monto_subtotal: rawData.economia?.subtotal || 0,
        riesgo: rawData.riesgo || 'medio',
        observaciones: rawData.observaciones || 'Revisión manual requerida.',
        moneda: rawData.factura?.moneda || 'USD',
        incoterm: rawData.factura?.incoterm || 'N/A',
        pais_origen: rawData.factura?.pais_origen || '',
        flete: rawData.economia?.flete || 0,
        seguro: rawData.economia?.seguro || 0,
        otros: rawData.economia?.otros || 0,
        receptor: rawData.destinatario?.nombre || '',
        receptor_tax: rawData.destinatario?.documento || '',
        detalles: (rawData.detalles || []).map((d, i) => ({
          id: i + 1, descripcion: d.descripcion_producto,
          cantidad: d.cantidad, precio_unitario: d.precio_unitario,
          partida_sugerida: d.partida_sugerida, partida_corregida: '',
          inconsistente: false,
        })),
      };
    }
    if (historyData) {
      return {
        numero: historyData.nombre_archivo || 'N/A',
        emisor: historyData.proveedor || 'N/A',
        monto_total: historyData.total_cif || 0,
        riesgo: historyData.riesgo || 'medio',
        observaciones: 'Recuperado desde el historial.',
        moneda: 'USD', incoterm: 'CIF', pais_origen: '',
        flete: 0, seguro: 0, otros: 0,
        receptor: historyData.cliente || '', receptor_tax: '',
        detalles: [{
          id: 1, descripcion: 'Resumen consolidado', cantidad: 1,
          precio_unitario: historyData.total_cif || 0,
          partida_sugerida: 'No almacenada', partida_corregida: '', inconsistente: false,
        }],
      };
    }
    return {
      numero: 'Cargando...', emisor: 'Cargando...', monto_total: 0,
      riesgo: 'medio', observaciones: 'Recuperando datos del servidor...', moneda: 'USD',
      incoterm: 'CIF', pais_origen: '', flete: 0, seguro: 0, otros: 0,
      receptor: '', receptor_tax: '',
      detalles: [],
    };
  };

  const [factura, setFactura] = useState(buildInitialState);
  const [camposMod, setCamposMod] = useState({});

  const VALID_INCOTERMS = new Set(['FOB','CIF','CFR','CPT','CIP','EXW','FCA','FAS','DAT','DAP','DDP']);
  const VALID_CURRENCIES = new Set(['USD','EUR','GBP','JPY','CNY','BRL','ARS','MXN','CLP','PEN','COP']);

  // Renderiza una alerta de cuadratura si la suma de items difiere del subtotal/total
  const CuadraturaItems = () => {
    if (!factura.detalles || factura.detalles.length === 0) return null;
    const suma = factura.detalles.reduce((s, d) => s + (d.cantidad || 0) * (d.precio_unitario || 0), 0);
    const subtotal = Number(factura.monto_subtotal || factura.subtotal) || 0;
    const totalCif = Number(factura.monto_total) || 0;
    const ref = subtotal > 0 ? subtotal : totalCif;
    const labelRef = subtotal > 0 ? 'subtotal' : 'total CIF';
    const diff = Math.abs(suma - ref);
    const diffPct = ref > 0 ? (diff / ref) * 100 : 0;
    if (diff <= 2.00 || ref <= 0) return null;
    const fleteSeguro = totalCif > 0 && subtotal > 0
      ? ` (flete/seguro/otros suman $${(totalCif - subtotal).toFixed(2)})`
      : '';
    return (
      <div style={{
        padding: '14px 18px', borderRadius: '12px', marginTop: '0',
        background: diffPct > 5 ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
        border: `1px solid ${diffPct > 5 ? v('red') + '30' : v('yellow') + '30'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '0.8rem' }}>
          <AlertCircle size={14} color={diffPct > 5 ? v('red') : v('yellow')} />
          <strong style={{ color: v('text-main') }}>Cuadratura de Ítems</strong>
        </div>
        <div style={{ fontSize: '0.78rem', color: v('text-muted'), lineHeight: 1.6 }}>
          La suma de los {factura.detalles.length} ítem(s) da <strong style={{ color: v('text-main') }}>${suma.toFixed(2)}</strong>,
          pero el {labelRef} declarado es <strong style={{ color: v('text-main') }}>${ref.toFixed(2)}</strong>.
          {' '}Diferencia: <strong style={{ color: diffPct > 5 ? v('red') : v('yellow') }}>${diff.toFixed(2)} ({diffPct.toFixed(1)}%)</strong>.
          {fleteSeguro}
          {' '}Revisa y corrige los valores antes de numerar.
        </div>
        <div style={{ marginTop: '8px', display: 'flex', gap: '12px', fontSize: '0.7rem', color: v('text-muted') }}>
          {factura.detalles.map((d, i) => (
            <span key={i}>
              #{i + 1}: {d.cantidad} × ${d.precio_unitario} = <strong>${((d.cantidad || 0) * (d.precio_unitario || 0)).toFixed(2)}</strong>
            </span>
          ))}
        </div>
      </div>
    );
  };
  const [flete, setFlete] = useState(() => parseFloat(rawData?.economia?.envio || factura.flete || 850));
  const [seguro, setSeguro] = useState(() => parseFloat(rawData?.economia?.seguro || factura.seguro || 150));
  const [otrosGastos, setOtrosGastos] = useState(() => parseFloat(factura.otros || 100));
  const [paisDestino, setPaisDestino] = useState('CL');
  const [aplicaTLC, setAplicaTLC] = useState(false);
  const [dtaTasa, setDtaTasa] = useState(0.8);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(true);
  const [isDatosGeneralesOpen, setIsDatosGeneralesOpen] = useState(true);
  const [isDespachanteOpen, setIsDespachanteOpen] = useState(true);
  const [isMontosOpen, setIsMontosOpen] = useState(true);
  const [despachantesList, setDespachantesList] = useState([]);
  const [despachanteId, setDespachanteId] = useState(null);
  const [despachanteData, setDespachanteData] = useState(null);
  const [clientesList, setClientesList] = useState([]);
  const [clienteSelectId, setClienteSelectId] = useState(null);
  const [isDetallesOpen, setIsDetallesOpen] = useState(true);
  const [isVbbOpen, setIsVbbOpen] = useState(true);
  const [isObsOpen, setIsObsOpen] = useState(true);
  const [showPedimento, setShowPedimento] = useState(false);
  const [duaData, setDuaData] = useState(null);
  const [duaGenerando, setDuaGenerando] = useState(false);
  const [tlcInfo, setTlcInfo] = useState(null);
  const [evaluandoTLC, setEvaluandoTLC] = useState(false);
  const [classificationData, setClassificationData] = useState({});
  const [aclaracionModal, setAclaracionModal] = useState(false);
  const [aclaracionMensaje, setAclaracionMensaje] = useState('');
  const [aclaracionEnviando, setAclaracionEnviando] = useState(false);
  const [aclaracionEnviada, setAclaracionEnviada] = useState(false);
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
  const [exportandoXML, setExportandoXML] = useState(false);
  const [exportandoJSON, setExportandoJSON] = useState(false);
  const [estadoAduanero, setEstadoAduanero] = useState(historyData?.estado_aduanero || 'En Revision');
  const [landedCost, setLandedCost] = useState(null);
  const [landedCostLoading, setLandedCostLoading] = useState(false);

  const stats = STATUS_MAP[factura.riesgo] || STATUS_MAP.medio;
  const StatIcon = stats.icon;

  const partidasList = factura.detalles
    .map(d => (d.partida_corregida || d.partida_sugerida || '').substring(0, 4))
    .filter(Boolean);
  const partidaPrincipal = partidasList[0] || '8471';

  // Marca un campo como modificado
  const mkMod = (k) => setCamposMod(p => ({ ...p, [k]: true }));

  // Actualiza un campo de un item específico en los detalles
  const handleCorrection = (idDetail, field, value) => {
    setFactura(prev => {
      const nd = prev.detalles.map(d => d.id === idDetail ? { ...d, [field]: value } : d);
      return { ...prev, detalles: nd };
    });
    mkMod(`item_${idDetail}_${field}`);
  };

  // Clasifica un item mediante IA consultando el backend
  const handleAiClassification = async (idDetail, description) => {
    setClassificationData(prev => ({ ...prev, [idDetail]: { loading: true, error: null, result: null } }));
    try {
      const data = await peticionPost('/api/facturas/clasificar-item', { descripcion_producto: description });
      setClassificationData(prev => ({ ...prev, [idDetail]: { loading: false, error: null, result: data } }));
    } catch (err) {
      setClassificationData(prev => ({ ...prev, [idDetail]: { loading: false, error: err.message, result: null } }));
    }
  };

  // Abre el modal de confirmación de partida arancelaria con entidades regulatorias
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

  // Aplica la partida sugerida por IA y abre confirmación regulatoria
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

  // Confirma la partida, la registra en catálogo y sincroniza V°B°
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

  // Envía una solicitud de aclaración al importador
  const handleSolicitarAclaracion = async () => {
    const docId = id || historyData?.id;
    if (!aclaracionMensaje.trim() || !docId || docId === 'null') return;
    setAclaracionEnviando(true);
    try {
      await peticionPost(`/api/documentos/${docId}/solicitar-aclaracion`, { mensaje: aclaracionMensaje.trim() });
      setAclaracionEnviada(true);
      setAclaracionModal(false);
      setAclaracionMensaje('');
    } catch (err) {
      alert('Error al enviar la solicitud: ' + err.message);
    } finally {
      setAclaracionEnviando(false);
    }
  };

  // Maneja el texto extraído desde el selector de PDF
  const handlePdfTextExtracted = (text) => {
    if (pdfSelectorField === 'monto_total') {
      const numeric = parseFloat(text.replace(/[^0-9.,]/g, '').replace(/\./g, '').replace(',', '.'));
      if (!isNaN(numeric)) { setFactura(prev => ({ ...prev, monto_total: numeric })); mkMod('monto_total'); }
    }
    setPdfSelectorField(null);
  };

  // Asocia un archivo RRNA (etiqueta) a un item
  const handleRrnaFileUpload = (itemId, file) => {
    if (!file) return;
    setRrnaDocuments(prev => ({ ...prev, [itemId]: { name: file.name, status: 'Validado', loading: false } }));
  };

  // Elimina un archivo RRNA asociado a un item
  const removeRrnaDocument = (itemId) => {
    setRrnaDocuments(prev => { const c = { ...prev }; delete c[itemId]; return c; });
  };

  const docId = id || historyData?.id;
  // Obtiene el landed cost actualizado al cambiar parámetros de simulación
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

  // Fetch inicial del documento desde la API cuando hay un id
  useEffect(() => {
    if (!cargandoDoc || !id || id === 'null' || id === 'undefined') return;
    setCargandoDoc(true);
    peticionGet(`/api/documentos/${id}`)
      .then(data => {
        setFactura(prev => ({
          ...prev,
          numero: data.nombre_archivo || 'N/A',
          emisor: data.proveedor || 'N/A',
          monto_total: data.total_cif || 0,
          riesgo: data.riesgo || 'medio',
          observaciones: 'Cargado desde base de datos.',
          moneda: 'USD',
          flete: data.flete || 0,
          seguro: data.seguro || 0,
          otros: data.otros || 0,
          receptor: data.cliente || '',
          subtotal: data.total_cif || 0,
          detalles: (data.partidas || []).map(p => ({
            id: p.id,
            descripcion: p.descripcion,
            cantidad: p.cantidad,
            precio_unitario: p.precio_unitario,
            partida_sugerida: p.partida_sugerida,
            partida_corregida: p.partida_corregida,
            inconsistente: false,
          })),
        }));
        setFlete(data.flete || 0);
        setSeguro(data.seguro || 0);
        setOtrosGastos(data.otros || 0);
        setEstadoAduanero(data.estado_aduanero || 'En Revision');
        if (data.bloqueado) setBloqueado(true);
        if (data.despachante_id) setDespachanteId(data.despachante_id);
        setDocumentoFetchado(true);
      })
      .catch(() => {})
      .finally(() => setCargandoDoc(false));
  }, []);

  // Evalúa si aplica un TLC según país de origen y partida principal
  useEffect(() => {
    setEvaluandoTLC(true);
    fetch(`/api/regulatorio/tlc/evaluar?pais_origen=${factura.pais_origen || 'CN'}&pais_destino=${paisDestino}&partida=${partidaPrincipal}`)
      .then(r => r.json())
      .then(data => { setTlcInfo(data); if (data.tlc_aplica) setAplicaTLC(true); })
      .catch(() => setTlcInfo(null))
      .finally(() => setEvaluandoTLC(false));
  }, [paisDestino, partidaPrincipal]);

  // Sincroniza estado bloqueado desde datos históricos o fetch
  useEffect(() => {
    if (historyData?.bloqueado || documentoFetchado?.bloqueado) {
      setBloqueado(true);
    }
  }, [historyData, documentoFetchado]);

  // Sincroniza despachante y cliente desde datos históricos o fetch
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

  // Actualiza datos del despachante seleccionado
  useEffect(() => {
    if (!despachanteId) { setDespachanteData(null); return; }
    const d = despachantesList.find(x => x.id === despachanteId);
    setDespachanteData(d || null);
  }, [despachanteId, despachantesList]);

  // Cambia el despachante asignado al documento
  const handleDespachanteChange = async (e) => {
    const val = e.target.value ? parseInt(e.target.value) : null;
    setDespachanteId(val);
    const docId = id || historyData?.id;
    if (!docId || docId === 'null') return;
    try {
      await peticionPut(`/api/documentos/${docId}/despachante`, { despachante_id: val });
    } catch {}
  };

  // Genera el DUA (Documento Único Aduanero) en el backend
  const handleGenerarDUA = async () => {
    const docId = id || historyData?.id;
    if (!docId || docId === 'null') return;
    setDuaGenerando(true);
    try {
      const res = await peticionPost(`/api/documentos/${docId}/generar-dua`);
      if (res) setDuaData(res);
    } catch {}
    finally { setDuaGenerando(false); }
  };

  // Descarga el DUA como archivo JSON
  const handleDescargarDUA = () => {
    if (!duaData) return;
    const blob = new Blob([JSON.stringify(duaData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DUA_${id || historyData?.id || 'export'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Guarda los cambios del documento en el backend
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
      });
      setGuardando(false);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
    } catch (e) {
      setGuardando(false);
      alert('Error al guardar: ' + e.message);
    }
  };

  // Aprueba o solicita aprobación administrativa del documento
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

  // Prevalida, aprueba y bloquea el documento (solo admin)
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

  // Avanza el estado aduanero del documento al siguiente paso
  const handleAvanzarEstadoAduanero = async (nuevoEstado) => {
    const targetId = id || historyData?.id;
    if (!targetId || targetId === 'null') return;
    try {
      const data = await peticionPut(`/api/documentos/${targetId}/avanzar-estado-aduanero`, { estado: nuevoEstado });
      setEstadoAduanero(data.estado_aduanero);
    } catch (err) {
      alert('Error al avanzar estado aduanero: ' + err.message);
    }
  };

  // Exporta el documento a formato XML de intercambio
  const handleExportXML = async () => {
    const targetId = id || historyData?.id;
    if (!targetId || targetId === 'null') return;
    setExportandoXML(true);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/documentos/${targetId}/exportar/xml`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Error al exportar XML');
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `intercambio_${targetId}.xml`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Error al exportar XML: ' + err.message);
    } finally {
      setExportandoXML(false);
    }
  };

  // Exporta el documento a formato JSON de intercambio
  const handleExportJSON = async () => {
    const targetId = id || historyData?.id;
    if (!targetId || targetId === 'null') return;
    setExportandoJSON(true);
    try {
      const data = await peticionPut(`/api/documentos/${targetId}/exportar/json`, {});
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `intercambio_${targetId}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Error al exportar JSON: ' + err.message);
    } finally {
      setExportandoJSON(false);
    }
  };

  // Exporta los detalles de la factura a CSV
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
    <div className="fade-in" style={{ background: v('bg-color'), minHeight: '100vh', color: v('text-main') }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 28px', borderBottom: `1px solid ${v('card-border')}`,
        background: v('card-bg'),
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => navigate('/')} className="btn btn-secondary" style={{ padding: '8px 12px' }} title="Volver">
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
          {(id && id !== 'null') || historyData?.id ? (
            <>
              <button onClick={handleExportXML} disabled={exportandoXML} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
                {exportandoXML ? <Loader2 size={14} className="spin" /> : <FileCode size={14} />} XML
              </button>
              <button onClick={handleExportJSON} disabled={exportandoJSON} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
                {exportandoJSON ? <Loader2 size={14} className="spin" /> : <FileJson size={14} />} JSON
              </button>
            </>
          ) : null}
          {(id && id !== 'null') || historyData?.id ? (
            <button onClick={() => setAclaracionModal(true)} className="btn" style={{
              padding: '8px 14px', fontSize: '0.85rem', backgroundColor: 'rgba(245,158,11,0.1)', color: v('yellow'),
              border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600,
            }}>
              <MessageSquare size={14} /> Aclaración
            </button>
          ) : null}
        </div>
      </div>

      {/* Split Screen */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, height: 'calc(100vh - 65px)' }}>
        {/* LEFT: PDF */}
        <div className="glass-panel" style={{
          borderRadius: 0, borderLeft: 'none', borderTop: 'none', borderBottom: 'none',
          display: 'flex', flexDirection: 'column', padding: 0,
        }}>
          <div style={{
            padding: '12px 20px', borderBottom: `1px solid ${v('card-border')}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: v('text-muted'), margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={16} color={v('primary')} /> Documento Original (PDF)
            </h2>
            {pdfUrl && (
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem', textDecoration: 'none' }}>
                <Download size={12} /> Descargar
              </a>
            )}
          </div>
          {pdfUrl ? (
            <object data={pdfUrl} type="application/pdf" width="100%" height="100%" style={{ flex: 1, background: '#525659' }}>
              <p style={{ textAlign: 'center', padding: '40px', color: v('text-muted') }}>No se pudo cargar el PDF.</p>
            </object>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: v('text-muted'), padding: '40px', textAlign: 'center' }}>
              <FileText size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
              <p>El PDF original no está disponible.</p>
              <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Solo disponible para documentos escaneados a partir de esta actualización.</span>
            </div>
          )}
        </div>

        {/* RIGHT: Form */}
        <div ref={rightPanelRef} style={{
          overflowY: 'auto', overflowX: 'hidden', background: v('bg-color'),
          display: 'flex', flexDirection: 'column', borderLeft: `1px solid ${v('card-border')}`,
        }}>
          <div style={{ padding: '20px 24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Status */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={S.badge(stats.color, stats.bg)}>
                  <StatIcon size={14} /> {stats.label}
                </div>
                {bloqueado && (
                  <div style={{
                    ...S.badge('var(--green)', 'rgba(16,185,129,0.1)'),
                    borderColor: 'rgba(16,185,129,0.3)',
                  }}>
                    <Lock size={12} /> Aprobado
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.75rem', color: v('text-muted') }}>
                <UserCheck size={12} />
                {isAdmin ? 'Administrador' : 'Agente'} · {factura.moneda}
              </div>
            </div>

            {/* Timeline de Estado Aduanero */}
            {(id && id !== 'null' || historyData?.id) && (
              <div className="glass-panel" style={{ padding: '14px 20px', overflow: 'hidden' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: v('text-muted'), marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Flag size={12} /> Estado Aduanero
                </div>
                <EstadoAduaneroTimeline
                  estadoAduanero={estadoAduanero}
                  bloqueado={bloqueado}
                  onAvanzarEstado={handleAvanzarEstadoAduanero}
                />
                <div className="grid-2" style={{ gap: '16px', marginTop: '16px', borderTop: `1px solid ${v('card-border')}`, paddingTop: '16px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Cliente registrado
                    </label>
                    <select className="form-input"
                      style={{ width: '100%', cursor: 'pointer', ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}
                      value={clienteSelectId || ''}
                      disabled={bloqueado}
                      onChange={(e) => {
                        const val = e.target.value ? parseInt(e.target.value) : null;
                        setClienteSelectId(val);
                        if (val) {
                          const c = clientesList.find(x => x.id === val);
                          if (c) setFactura(p => ({ ...p, receptor: c.razon_social }));
                        }
                      }}
                    >
                      <option value="">— Sin cliente asignado —</option>
                      {clientesList.map(c => (
                        <option key={c.id} value={c.id}>{c.razon_social} ({c.identificacion_fiscal})</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Importador / Receptor
                    </label>
                    <input className="form-input"
                      style={{
                        ...(camposMod['receptor'] ? { borderColor: v('primary'), boxShadow: `0 0 0 1px ${v('primary')}` } : {}),
                        ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                      }}
                      type="text" value={factura.receptor} disabled={bloqueado}
                      onChange={(e) => { if (!bloqueado) { setFactura(p => ({ ...p, receptor: e.target.value })); mkMod('receptor'); }}}
                    />
                    {camposMod['receptor'] && (
                      <span style={{ fontSize: '0.65rem', color: v('primary'), marginTop: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Edit3 size={10} /> Modificado por usuario
                      </span>
                    )}
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">RUT / Tax ID Receptor</label>
                    <input className="form-input"
                      style={{ ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}
                      type="text" value={factura.receptor_tax} disabled={bloqueado}
                      onChange={(e) => { if (!bloqueado) setFactura(p => ({ ...p, receptor_tax: e.target.value })); }}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">País de Origen</label>
                    <input className="form-input"
                      style={{ ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}
                      type="text" value={factura.pais_origen} disabled={bloqueado}
                      onChange={(e) => { if (!bloqueado) setFactura(p => ({ ...p, pais_origen: e.target.value })); }}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Incoterm</label>
                    <input className="form-input"
                      style={{ ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}
                      type="text" value={factura.incoterm} disabled={true}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Pipeline de Prevalidación */}
            <PipelinePrevalidacion prevalidacion={prevalidacionData} />

            {/* Cuadratura de Ítems */}
            <CuadraturaItems />

            {/* Datos Generales */}
            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div onClick={() => setIsDatosGeneralesOpen(!isDatosGeneralesOpen)}
                style={{ padding: '16px 20px', borderBottom: `1px solid ${v('card-border')}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0, color: v('text-main'), display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Hash size={16} color={v('primary')} /> Datos Generales
                </h3>
                {isDatosGeneralesOpen ? <ChevronUp size={16} color={v('text-muted')} /> : <ChevronDown size={16} color={v('text-muted')} />}
              </div>
              {isDatosGeneralesOpen && (
              <div style={{ padding: '16px 20px' }}>
                <div className="grid-2" style={{ gap: '16px' }}>
                  {[
                    { label: 'Número de Factura', k: 'numero', val: factura.numero, dis: true },
                    { label: 'Proveedor / Emisor', k: 'emisor', val: factura.emisor, dis: true },
                  ].map((f, i) => {
                    return (
                    <div key={i} className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {f.label}
                      </label>
                      <input className="form-input"
                        style={{
                          ...(camposMod[f.k] ? { borderColor: v('primary'), boxShadow: `0 0 0 1px ${v('primary')}` } : {}),
                          ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                        }}
                        type="text" value={f.val} disabled={f.dis || bloqueado}
                        onChange={(e) => { if (!bloqueado) { setFactura(p => ({ ...p, [f.k]: e.target.value })); mkMod(f.k); }}}
                      />
                      {camposMod[f.k] && (
                        <span style={{ fontSize: '0.65rem', color: v('primary'), marginTop: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Edit3 size={10} /> Modificado por usuario
                        </span>
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>
              )}
            </div>

            {/* Despachante */}
            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div onClick={() => setIsDespachanteOpen(!isDespachanteOpen)}
                style={{ padding: '16px 20px', borderBottom: `1px solid ${v('card-border')}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0, color: v('text-main'), display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Truck size={16} color={v('primary')} /> Despachante de Aduana
                </h3>
                {isDespachanteOpen ? <ChevronUp size={16} color={v('text-muted')} /> : <ChevronDown size={16} color={v('text-muted')} />}
              </div>
              {isDespachanteOpen && (
              <div style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label className="form-label">Despachante asignado</label>
                    <select className="form-input" value={despachanteId || ''} onChange={handleDespachanteChange}
                      style={{ width: '100%', cursor: 'pointer' }}>
                      <option value="">Sin despachante</option>
                      {despachantesList.map(d => (
                        <option key={d.id} value={d.id}>{d.nombre}{d.rut ? ` (${d.rut})` : ''}</option>
                      ))}
                    </select>
                  </div>
                  {despachanteData && (
                    <div style={{ fontSize: '0.75rem', color: v('text-muted'), paddingBottom: '4px' }}>
                      {despachanteData.telefono && <span style={{ display: 'block' }}>Tel: {despachanteData.telefono}</span>}
                      {despachanteData.email && <span style={{ display: 'block' }}>Email: {despachanteData.email}</span>}
                    </div>
                  )}
                </div>
              </div>
              )}
            </div>

            {/* Montos */}
            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div onClick={() => setIsMontosOpen(!isMontosOpen)}
                style={{ padding: '16px 20px', borderBottom: `1px solid ${v('card-border')}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0, color: v('text-main'), display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <DollarSign size={16} color={v('green')} /> Montos y Valores
                </h3>
                {isMontosOpen ? <ChevronUp size={16} color={v('text-muted')} /> : <ChevronDown size={16} color={v('text-muted')} />}
              </div>
              {isMontosOpen && (
              <div style={{ padding: '16px 20px' }}>
                <div className="grid-2" style={{ gap: '16px' }}>
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
                      type="text" value={`$${Number(factura.monto_total).toFixed(2)}`}
                      disabled={bloqueado}
                      onChange={(e) => { if (!bloqueado) { const v = parseFloat(e.target.value.replace(/[^0-9.]/g, '')); if (!isNaN(v)) { setFactura(p => ({ ...p, monto_total: v })); mkMod('monto_total'); }}}}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Moneda
                    </label>
                    <input className="form-input" type="text" value={factura.moneda} disabled />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Flete (USD)
                    </label>
                    <input className="form-input" style={{
                      ...(camposMod.flete ? { borderColor: v('primary'), boxShadow: `0 0 0 1px ${v('primary')}` } : {}),
                      ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                    }}
                      type="number" value={flete} disabled={bloqueado}
                      onChange={(e) => { if (!bloqueado) { setFlete(Math.max(0, parseFloat(e.target.value) || 0)); mkMod('flete'); }}}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Seguro (USD)
                    </label>
                    <input className="form-input" style={{
                      ...(camposMod.seguro ? { borderColor: v('primary'), boxShadow: `0 0 0 1px ${v('primary')}` } : {}),
                      ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                    }}
                      type="number" value={seguro} disabled={bloqueado}
                      onChange={(e) => { if (!bloqueado) { setSeguro(Math.max(0, parseFloat(e.target.value) || 0)); mkMod('seguro'); }}}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Otros Gastos (USD)</label>
                    <input className="form-input" style={{
                      ...(camposMod.otros ? { borderColor: v('primary'), boxShadow: `0 0 0 1px ${v('primary')}` } : {}),
                      ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                    }}
                      type="number" value={otrosGastos} disabled={bloqueado}
                      onChange={(e) => { if (!bloqueado) { setOtrosGastos(Math.max(0, parseFloat(e.target.value) || 0)); mkMod('otros'); }}}
                    />
                  </div>
                </div>
                <div style={{
                  marginTop: '16px', padding: '14px', borderRadius: '10px',
                  background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: v('text-muted') }}>Valor CIF Calculado</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: v('green') }}>${valorCIF.toFixed(2)} USD</span>
                </div>
              </div>
              )}
            </div>

            {/* Simulador */}
            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div onClick={() => setIsSimulatorOpen(!isSimulatorOpen)}
                style={{ padding: '16px 20px', borderBottom: `1px solid ${v('card-border')}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0, color: v('text-main'), display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calculator size={16} color={v('accent')} /> Liquidación Tributaria
                </h3>
                {isSimulatorOpen ? <ChevronUp size={16} color={v('text-muted')} /> : <ChevronDown size={16} color={v('text-muted')} />}
              </div>
              {isSimulatorOpen && (
                <div style={{ padding: '16px 20px' }}>
                  <div className="grid-2" style={{ gap: '16px', marginBottom: '16px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label"><Globe size={12} style={{ marginRight: '4px' }} /> País Destino</label>
                      <select value={paisDestino} onChange={(e) => setPaisDestino(e.target.value)} className="form-input" style={{ cursor: 'pointer' }}>
                        <option value="CL">Chile (IVA 19%)</option>
                        <option value="MX">México (IVA 16% / DTA)</option>
                        <option value="ES">España - UE (IVA 21%)</option>
                      </select>
                    </div>
                    {paisDestino === 'MX' && (
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Tasa DTA (%)</label>
                        <input className="form-input" type="number" step="0.01" value={dtaTasa}
                          onChange={(e) => setDtaTasa(Math.max(0, parseFloat(e.target.value) || 0))}
                        />
                      </div>
                    )}
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '12px 16px', marginBottom: '16px',
                    background: aplicaTLC ? 'rgba(16,185,129,0.08)' : 'transparent',
                    border: `1px solid ${aplicaTLC ? 'rgba(16,185,129,0.3)' : v('card-border')}`,
                    borderRadius: '10px',
                  }}>
                    <input type="checkbox" id="tlc" checked={aplicaTLC}
                      onChange={(e) => setAplicaTLC(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: v('green'), cursor: 'pointer' }}
                    />
                    <label htmlFor="tlc" style={{ fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', flex: 1, color: v('text-main') }}>
                      Aplicar TLC
                      {evaluandoTLC && <Loader2 size={12} className="spin" style={{ marginLeft: '8px' }} />}
                      {tlcInfo?.tlc_aplica && <span style={{ color: v('green'), fontSize: '0.7rem', marginLeft: '8px' }}>✓ {tlcInfo.nombre_tlc}</span>}
                    </label>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.01)', border: `1px solid ${v('card-border')}`, borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
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
                  <button onClick={() => setShowPedimento(!showPedimento)}
                    className="btn btn-primary" style={{ width: '100%', marginTop: '16px', justifyContent: 'center' }}>
                    <FileText size={14} /> {showPedimento ? 'Ocultar Borrador' : 'Generar Borrador Pedimento / DUA'}
                  </button>
                  {showPedimento && (
                    <div style={{
                      marginTop: '16px', padding: '16px', borderRadius: '12px',
                      background: 'rgba(0,0,0,0.02)', border: `1px solid ${v('accent')}40`,
                      fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '12px',
                    }}>
                      <div style={{ fontWeight: 700, color: v('accent'), textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Scale size={14} />
                        {paisDestino === 'MX' ? 'Pedimento de Importación' : paisDestino === 'ES' ? 'DUA' : 'Declaración de Ingreso (DIN)'}
                      </div>
                      {duaGenerando ? (
                        <div style={{ textAlign: 'center', color: v('text-muted') }}><Loader2 size={16} className="spin" /> Generando...</div>
                      ) : duaData ? (
                        <>
                          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                            <div><strong>Importador:</strong> {duaData.importador?.nombre}</div>
                            <div><strong>Despachante:</strong> {duaData.despachante?.nombre}</div>
                            <div><strong>Régimen:</strong> {duaData.encabezado?.regimen}</div>
                          </div>
                          <div className="grid-2" style={{ gap: '8px', color: v('text-muted') }}>
                            <span>FOB: <strong style={{ color: v('text-main') }}>${Number(duaData.valores?.fob).toFixed(2)}</strong></span>
                            <span>CIF: <strong style={{ color: v('text-main') }}>${Number(duaData.valores?.cif).toFixed(2)}</strong></span>
                            <span>Arancel: <strong style={{ color: v('text-main') }}>${Number(duaData.valores?.advalorem_6).toFixed(2)}</strong></span>
                            <span>IVA: <strong style={{ color: v('text-main') }}>${Number(duaData.valores?.iva_19).toFixed(2)}</strong></span>
                            <span>Total: <strong style={{ color: v('accent') }}>${Number(duaData.valores?.total_landed).toFixed(2)}</strong></span>
                          </div>
                          {duaData.partidas?.length > 0 && (
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.7rem', color: v('accent'), marginBottom: '6px' }}>PARTIDAS</div>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
                                <thead>
                                  <tr style={{ borderBottom: `1px solid ${v('card-border')}`, color: v('text-muted') }}>
                                    <th style={{ textAlign: 'left', padding: '4px 6px' }}>#</th>
                                    <th style={{ textAlign: 'left', padding: '4px 6px' }}>Descripción</th>
                                    <th style={{ textAlign: 'right', padding: '4px 6px' }}>Cant.</th>
                                    <th style={{ textAlign: 'right', padding: '4px 6px' }}>Precio</th>
                                    <th style={{ textAlign: 'right', padding: '4px 6px' }}>Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {duaData.partidas.map((p, i) => (
                                    <tr key={i} style={{ borderBottom: `1px solid ${v('card-border')}40` }}>
                                      <td style={{ padding: '4px 6px' }}>{p.orden}</td>
                                      <td style={{ padding: '4px 6px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.descripcion}</td>
                                      <td style={{ textAlign: 'right', padding: '4px 6px' }}>{p.cantidad}</td>
                                      <td style={{ textAlign: 'right', padding: '4px 6px' }}>${Number(p.precio_unitario).toFixed(2)}</td>
                                      <td style={{ textAlign: 'right', padding: '4px 6px' }}>${Number(p.subtotal).toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                            <button onClick={handleDescargarDUA} className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.7rem' }}>
                              <Download size={12} /> Descargar JSON
                            </button>
                            <button onClick={() => { setShowPedimento(false); setDuaData(null); }} className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '0.7rem' }}>
                              <X size={12} /> Cerrar
                            </button>
                          </div>
                        </>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '12px' }}>
                          <button onClick={handleGenerarDUA} className="btn btn-primary" style={{ padding: '8px 20px', fontSize: '0.75rem' }}>
                            <FileText size={14} /> Generar DUA desde Backend
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Items */}
            <ItemsTable
              items={factura.detalles}
              bloqueado={bloqueado}
              camposMod={camposMod}
              open={isDetallesOpen}
              onToggle={() => setIsDetallesOpen(!isDetallesOpen)}
              classificationData={classificationData}
              rrnaDocuments={rrnaDocuments}
              onCorrection={handleCorrection}
              onAiClassification={handleAiClassification}
              onAplicarPartida={handleAplicarPartidaIA}
              onRrnaUpload={handleRrnaFileUpload}
              onRrnaRemove={removeRrnaDocument}
            />

            {/* V°B° + Observaciones */}
            {((id && id !== 'null') || historyData?.id) && partidasList.length > 0 && (
              <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
                <div onClick={() => setIsVbbOpen(!isVbbOpen)}
                  style={{ padding: '16px 20px', borderBottom: `1px solid ${v('card-border')}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0, color: v('text-main'), display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Flag size={16} color={v('accent')} /> Vistos Buenos Regulatorios
                  </h3>
                  {isVbbOpen ? <ChevronUp size={16} color={v('text-muted')} /> : <ChevronDown size={16} color={v('text-muted')} />}
                </div>
                {isVbbOpen && (
                <div style={{ padding: '16px 20px' }}>
                  <GestorVistosBuenos documentoId={Number(id || historyData?.id)} partidas={partidasList} refreshKey={vbbRefreshKey} />

                  <GarantiasPanel documentoId={Number(id || historyData?.id)} />

                  <ObservacionesPanel documentoId={Number(id || historyData?.id)} />
                </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Action Bar */}
          <div style={{
            padding: '16px 24px', borderTop: `1px solid ${v('card-border')}`,
            background: v('card-bg'), display: 'flex', gap: '12px',
            justifyContent: 'flex-end', flexShrink: 0, position: 'sticky', bottom: 0,
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

      {/* PdfTextSelector Modal */}
      {pdfSelectorField && pdfUrl && (
        <PdfTextSelector pdfUrl={pdfUrl} fieldLabel="Monto Total CIF"
          onClose={() => setPdfSelectorField(null)} onTextSelected={handlePdfTextExtracted}
        />
      )}

      {/* Confirmación de Partida Modal */}
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

      {/* Aclaración Modal */}
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
            <textarea value={aclaracionMensaje} onChange={(e) => setAclaracionMensaje(e.target.value)}
              placeholder="Describa qué dato falta o qué corrección necesita..."
              rows={5}
              className="form-input" style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
            {aclaracionEnviada && (
              <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: v('green'), fontWeight: 600 }}>
                <CheckCircle size={16} /> Solicitud enviada correctamente.
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setAclaracionModal(false); setAclaracionMensaje(''); }} className="btn btn-secondary">Cancelar</button>
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

// Componente que renderiza una fila de cálculo en la liquidación tributaria
const Fila = ({ calc, val, muted, accent, total }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <span style={{ color: muted ? v('text-muted') : v('text-muted'), fontWeight: total ? 700 : 400 }}>{calc}</span>
    <span style={{ fontWeight: total ? 800 : 600, color: total ? v('accent') : accent ? v('green') : v('text-main'), fontSize: total ? '1rem' : '0.85rem' }}>{val}</span>
  </div>
);

export default InvoiceDetail;

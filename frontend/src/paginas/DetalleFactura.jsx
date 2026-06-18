// Detalle de factura con visor PDF, prevalidacion y aprobacion
import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  AlertCircle, AlertTriangle, CheckCircle, Save, XCircle, ArrowLeft, Download,
  ShieldAlert, Shield, Loader2, Calculator, FileText,
  Globe, Send, MessageSquare, Scan, Mail,
  DollarSign, MapPin, Package, Truck, UserCheck, Flag, Lock, RotateCcw,
} from 'lucide-react';
import { useAuth } from '../contexto/ContextoAuth';
import ObservacionesPanel from '../componentes/ObservacionesPanel';
import PdfTextSelector from '../componentes/PdfTextSelector';
import GestorVistosBuenos from '../componentes/GestorVistosBuenos';
import { API_BASE, peticionPut, peticionPost, peticionGet, obtenerToken } from '../servicios/api';
import PipelinePrevalidacion from '../componentes/PipelinePrevalidacion';
import ModalConfirmacionPartida from '../componentes/ModalConfirmacionPartida';
import ItemsTable from '../componentes/ItemsTable';
import Toast from '../componentes/Toast';
import { cssVar as v } from '../libreria/utilidades';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import styles from '../../css/DetalleFactura.module.css';

function VisorPDF({ pdfUrl, pdfBlobUrl, pdfCargando }) {
  return (
    <div className={`glass-panel ${styles.visorPdf}`}>
      <div className={styles.visorPdfHeader}>
        <h2 className={styles.visorPdfTitle}>
          <FileText size={16} color={v('primary')} /> Documento Original (PDF)
        </h2>
        {pdfUrl && pdfBlobUrl && (
          <a href={pdfBlobUrl} download target="_blank" rel="noopener noreferrer" className={`btn btn-secondary ${styles.visorPdfDownload}`}>
            <Download size={12} /> Descargar
          </a>
        )}
      </div>
      {pdfUrl ? (
        pdfCargando ? (
          <div className={styles.visorPdfLoading}>
            <Loader2 size={24} className="spin" />
          </div>
        ) : pdfBlobUrl ? (
          <object data={pdfBlobUrl} type="application/pdf" width="100%" height="100%" className={styles.visorPdfViewer}>
            <p style={{ textAlign: 'center', padding: '40px', color: v('text-muted') }}>No se pudo cargar el PDF.</p>
          </object>
        ) : (
          <div className={styles.visorPdfError}>
            <FileText size={48} className={styles.visorPdfErrorIcon} />
            <p>No se pudo cargar el PDF.</p>
            <span className={styles.visorPdfErrorHint}>Verifica que el archivo exista en el servidor.</span>
          </div>
        )
      ) : (
        <div className={styles.visorPdfError}>
          <FileText size={48} className={styles.visorPdfErrorIcon} />
          <p>El PDF original no está disponible.</p>
          <span className={styles.visorPdfErrorHint}>Solo disponible para documentos escaneados a partir de esta actualización.</span>
        </div>
      )}
    </div>
  );
}

function BarraEstadoDocumento({ riesgos, bloqueado, isAdmin, moneda }) {
  const StatIcon = riesgos.icon;
  return (
    <div className={styles.estadoBar}>
      <div className={styles.estadoLeft}>
        <div className={styles.estadoBadge} style={{
          color: riesgos.color, background: riesgos.bg,
          border: `1px solid ${riesgos.color}30`,
        }}>
          <StatIcon size={14} /> {riesgos.label}
        </div>
        {bloqueado && (
          <div className={styles.estadoBadgeLocked}>
            <Lock size={12} /> Aprobado
          </div>
        )}
      </div>
      <div className={styles.estadoRight}>
        <UserCheck size={12} />
        {isAdmin ? 'Administrador' : 'Agente'} · {moneda || '—'}
      </div>
    </div>
  );
}

function BarraAcciones({
  bloqueado, enEspera, guardando, isAdmin, prevalidando, aprobarOk,
  tieneDocGuardado, riesgo,
  onGuardar, onPrevalidarAprobar, onAprobar,
}) {
  const bloqueadoEfectivo = bloqueado || enEspera;
  const btnDisabled = aprobarOk || bloqueadoEfectivo;
  return (
    <div className={styles.accionesBar}>
      <button onClick={onGuardar} className={`btn btn-secondary ${styles.accionesBtnIcon}`} disabled={guardando || bloqueadoEfectivo}>
        {guardando ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
        {guardando ? 'Guardando...' : 'Guardar Cambios'}
      </button>
      {!bloqueadoEfectivo && tieneDocGuardado && isAdmin && (
        <button onClick={onPrevalidarAprobar} disabled={prevalidando}
          className={`btn ${styles.accionesBtnPrevalidar}`}
          style={{ cursor: prevalidando ? 'not-allowed' : 'pointer' }}>
          {prevalidando ? <Loader2 size={16} className="spin" /> : <Lock size={16} />}
          {prevalidando ? 'Prevalidando...' : 'Prevalidar y Bloquear'}
        </button>
      )}
      {(!isAdmin && riesgo === 'alto') ? (
        <button onClick={onAprobar} disabled={bloqueadoEfectivo} className={`btn btn-danger ${styles.accionesBtnDanger}`}>
          <ShieldAlert size={16} /> Solicitar Aprobación Admin
        </button>
      ) : (
        <button onClick={onAprobar} className={`btn btn-primary ${styles.accionesBtnPrimary}`} disabled={btnDisabled}>
          {aprobarOk ? <Loader2 size={16} className="spin" /> : <CheckCircle size={16} />}
          {aprobarOk ? 'Aprobando...' : 'Aprobar Envío'}
        </button>
      )}
    </div>
  );
}

function ModalAclaracion({ abierto, onCerrar, onEnviar, email: emailInicial }) {
  const [mensaje, setMensaje] = useState('');
  const [emailLocal, setEmailLocal] = useState(emailInicial || '');
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState(false);
  const [info, setInfo] = useState('');

  if (!abierto) return null;

  const handleSubmit = async () => {
    if (!mensaje.trim() || enviando) return;
    setEnviando(true);
    try {
      const res = await onEnviar(mensaje.trim(), emailLocal);
      setEnviada(true);
      setInfo(res?.mensaje || 'Solicitud enviada correctamente.');
    } catch {
      setInfo('Error al enviar la solicitud.');
    } finally {
      setEnviando(false);
    }
  };

  const handleClose = () => {
    setMensaje('');
    setEmailLocal('');
    setEnviada(false);
    setInfo('');
    onCerrar();
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={`glass-panel ${styles.modalContent}`}>
        <div className={styles.modalHeader}>
          <div className={styles.modalIconBox}>
            <MessageSquare size={22} color={v('yellow')} />
          </div>
          <div>
            <h3 className={styles.modalTitle}>Solicitar Aclaración al Importador</h3>
            <p className={styles.modalSubtitle}>
              El documento quedará en estado <strong style={{ color: v('yellow') }}>"En Espera"</strong>.
            </p>
          </div>
        </div>

        <div className={styles.modalEmailRow}>
          <Mail size={18} color={v('text-muted')} />
          <input type="text" value={emailLocal}
            onChange={(e) => setEmailLocal(e.target.value)}
            className={`form-input ${styles.modalEmailInput}`}
            placeholder="Sin correo del importador..."
          />
        </div>

        <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)}
          placeholder="Describa qué dato falta o qué corrección necesita..."
          rows={5} className={`form-input ${styles.modalTextarea}`}
        />
        {enviada && (
          <div className={styles.modalSuccessMsg}>
            <CheckCircle size={16} /> {info}
          </div>
        )}
        <div className={styles.modalFooter}>
          <button onClick={handleClose} className="btn btn-secondary">Cancelar</button>
          <button onClick={handleSubmit} disabled={!mensaje.trim() || enviando}
            className={`btn ${styles.modalBtnSend}`}
            style={{
              cursor: mensaje.trim() ? 'pointer' : 'not-allowed',
              opacity: mensaje.trim() ? 1 : 0.5,
            }}>
            {enviando ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
            Enviar Solicitud
          </button>
        </div>
      </div>
    </div>
  );
}

function CuadraturaAduanera({ detalles, montoSubtotal, montoTotal, flete, seguro, otrosGastos }) {
  if (!detalles || detalles.length === 0) return null;
  const suma = detalles.reduce((s, d) => s + (d.cantidad || 0) * (d.precio_unitario || 0), 0);
  const subtotalDecl = Number(montoSubtotal || 0);
  const totalCif = Number(montoTotal) || 0;
  const totalFlete = Number(flete) || 0;
  const totalSeguro = Number(seguro) || 0;
  const totalOtros = Number(otrosGastos) || 0;
  const totalGastos = totalFlete + totalSeguro + totalOtros;

  const obtenerSubtotal = () => {
    if (subtotalDecl > 0) return { valor: subtotalDecl, label: 'Subtotal declarado' };
    const derivado = totalCif - totalGastos;
    if (derivado > 0) return { valor: derivado, label: 'Subtotal derivado (CIF - gastos)' };
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
  const bgColor = 'rgba(239,68,68,0.06)';
  const borderColor = v('red') + '30';

  return (
    <div className={styles.cuadraturaMain} style={{ background: bgColor, border: `1px solid ${borderColor}` }}>
      <div className={styles.cuadraturaHeader}>
        <AlertCircle size={14} color={hayErrorItems || hayErrorCif ? v('red') : v('yellow')} />
        <strong style={{ color: v('text-main') }}>Cuadratura Aduanera</strong>
      </div>
      <div className={styles.cuadraturaBody}>
        <div className={styles.cuadraturaLine}>
          <span className={styles.cuadraturaLabel}>FOB</span>
          <span className={styles.cuadraturaFlex}>
            Items <strong className={styles.cuadraturaVal}>${suma.toFixed(2)}</strong>
            {' vs '}<strong className={styles.cuadraturaVal}>${st.valor.toFixed(2)}</strong>
            {' ('}{st.label}{')'}
          </span>
          {hayErrorItems ? (
            <strong style={{ color: colorItems }}>${diffItems.toFixed(2)} ({diffItemsPct.toFixed(1)}%)</strong>
          ) : (<span className={styles.cuadraturaOk}>?</span>)}
        </div>
        {totalCif > 0 && (
          <div className={styles.cuadraturaLine}>
            <span className={styles.cuadraturaLabel}>CIF</span>
            <span className={styles.cuadraturaFlex}>
              <strong className={styles.cuadraturaVal}>${st.valor.toFixed(2)}</strong>
              {' + '}<strong style={{ color: v('yellow') }}>${totalGastos.toFixed(2)}</strong>
              {' = '}<strong className={styles.cuadraturaVal}>${cifReal.toFixed(2)}</strong>
              {' vs '}<strong className={styles.cuadraturaVal}>${totalCif.toFixed(2)}</strong>
            </span>
            {hayErrorCif ? (
              <strong style={{ color: colorCif }}>${diffCif.toFixed(2)} ({diffCifPct.toFixed(1)}%)</strong>
            ) : (<span className={styles.cuadraturaOk}>?</span>)}
          </div>
        )}
        <div className={styles.cuadraturaLineNoBorder}>
          <span className={styles.cuadraturaLabel}>Items</span>
          {detalles.map((d, i) => (
            <span key={i} className={styles.cuadraturaItem}>
              #{i + 1}: {Number(d.cantidad).toFixed(1)} × ${Number(d.precio_unitario).toFixed(2)} = <strong className={styles.cuadraturaVal}>${((d.cantidad || 0) * (d.precio_unitario || 0)).toFixed(2)}</strong>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function NavegacionPestanas({ tabActivo, onTabChange }) {
  const TABS = [
    { id: 'detalles', label: 'Detalles de Ítems', icon: Package },
    { id: 'simulador', label: 'Liquidación Tributaria', icon: Calculator },
    { id: 'prevalidacion', label: 'Prevalidación', icon: Shield },
    { id: 'vbb', label: 'V°B° Regulatorios', icon: Flag },
  ];
  return (
    <div style={{ display: 'flex', borderBottom: `1px solid ${v('card-border')}` }}>
      {TABS.map(tab => {
        const Icon = tab.icon;
        const activo = tabActivo === tab.id;
        return (
          <button key={tab.id} onClick={() => onTabChange(tab.id)}
            className={styles.tabBtn}
            style={{
              borderBottom: activo ? `2px solid ${v('primary')}` : '2px solid transparent',
              background: activo ? v('hover-bg') : 'transparent',
              color: activo ? v('primary') : v('text-muted'),
            }}>
            <Icon size={13} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function FilaCalculo({ calc, val, muted, accent, total }) {
  const cls = total ? styles.calcRowTotal : styles.calcRow;
  return (
    <div className={cls} style={{
      color: total ? undefined : muted ? v('text-muted') : v('text-main'),
      fontWeight: (accent && !total) ? 700 : undefined,
    }}>
      <span>{calc}</span>
      <span>{val}</span>
    </div>
  );
}

function SimuladorLiquidacion({
  paisDestino, onPaisDestinoChange,
  dtaTasa, onDtaTasaChange,
  aplicaTLC, onAplicaTLCChange,
  landedCost, landedCostLoading,
  items, desgloseItems, alertasAuditoria,
}) {
  return (
    <div className={styles.simuladorWrapper}>
      <div className={styles.simuladorSectionTitle}>Parámetros</div>
      <div className={styles.simuladorParamsRow}>
        <div className={`form-group ${styles.simuladorFieldCompact}`} style={{ flex: '0 0 220px' }}>
          <label className="form-label"><Globe size={12} style={{ marginRight: '4px' }} /> País Destino</label>
          <select value={paisDestino} onChange={(e) => onPaisDestinoChange(e.target.value)} className={`form-input ${styles.simuladorSelect}`}>
            <option value="CL">Chile (IVA 19%)</option>
            <option value="MX">México (IVA 16% / DTA)</option>
            <option value="ES">España - UE (IVA 21%)</option>
          </select>
        </div>
        {paisDestino === 'MX' && (
          <div className={`form-group ${styles.simuladorFieldCompact}`} style={{ flex: '0 0 120px' }}>
            <label className="form-label">Tasa DTA (%)</label>
            <input className={`form-input ${styles.simuladorInput}`} type="number" onWheel={e => e.target.blur()} step="0.01" value={dtaTasa}
              onChange={(e) => onDtaTasaChange(Math.max(0, parseFloat(e.target.value) || 0))}
            />
          </div>
        )}
        <div className={`${styles.simuladorTlcBox} ${aplicaTLC ? styles.simuladorTlcBoxActive : ''}`}
          style={{ border: `1px solid ${aplicaTLC ? 'rgba(16,185,129,0.3)' : v('card-border')}` }}>
          <input type="checkbox" id="tlc" checked={aplicaTLC}
            onChange={(e) => onAplicaTLCChange(e.target.checked)}
            className={styles.simuladorTlcCheckbox}
          />
          <label htmlFor="tlc" className={styles.simuladorTlcLabel}>
            Aplicar TLC
          </label>
        </div>
      </div>
      <div className={styles.simuladorSectionTitle} style={{ marginTop: '4px' }}>Resultados</div>
      <div className={styles.simuladorResultsBox}>
        {landedCostLoading ? (
          <div className={styles.simuladorLoading}><Loader2 size={16} className="spin" /> Calculando...</div>
        ) : (landedCost ? (
          <><FilaCalculo calc="Valor FOB" val={`$${landedCost.valor_fob.toFixed(2)}`} />
          <FilaCalculo calc="Incrementables" val={`$${(landedCost.flete + landedCost.seguro + landedCost.otros).toFixed(2)}`} muted />
          <div className={styles.simuladorDividerDashed}>
            <FilaCalculo calc="Valor Aduana (CIF)" val={`$${landedCost.valor_cif.toFixed(2)}`} accent />
          </div>
          <FilaCalculo calc={`Arancel`} val={`$${landedCost.impuesto_advalorem.toFixed(2)}`} />
          {paisDestino === 'MX' && <FilaCalculo calc={`DTA (${dtaTasa.toFixed(1)}%)`} val={`$${landedCost.dta.toFixed(2)}`} />}
          <FilaCalculo calc={`IVA (${landedCost.tasa_iva.toFixed(1)}%)`} val={`$${landedCost.impuesto_iva.toFixed(2)}`} />
          <div className={styles.simuladorDividerSolid}>
            <FilaCalculo calc="TOTAL TRIBUTOS" val={`$${landedCost.total_tributos.toFixed(2)}`} total />
            <FilaCalculo calc="TOTAL LANDED COST" val={`$${landedCost.total_landed_cost.toFixed(2)}`} total />
          </div></>
        ) : (
          <div className={styles.simuladorEmpty}>
            Guarda el documento para ver la liquidación.
          </div>
        ))}
      </div>
      {desgloseItems && desgloseItems.length > 0 && (
        <>
          <div className={styles.simuladorSectionTitle}>Desglose por Ítem</div>
          <div className={styles.desgloseTableWrapper}>
            <table className={styles.desgloseTable}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>HS Code</th>
                  <th>Descripción</th>
                  <th>FOB</th>
                  <th>Peso Prop.</th>
                  <th>Increm.</th>
                  <th>CIF</th>
                  <th>Arancel</th>
                  <th>IVA</th>
                  <th>Total Item</th>
                </tr>
              </thead>
              <tbody>
                {desgloseItems.map(d => (
                  <tr key={d.linea}>
                    <td>{d.linea}</td>
                    <td className={styles.desgloseHscode}>{d.hs_code || '—'}</td>
                    <td className={styles.desgloseDesc}>{d.descripcion || (items?.[d.linea - 1]?.descripcion || '')}</td>
                    <td className={styles.desgloseNum}>${d.fob_asignado.toFixed(2)}</td>
                    <td className={styles.desgloseNum}>{(d.peso_proporcional * 100).toFixed(1)}%</td>
                    <td className={styles.desgloseNum}>${d.incrementables_asignados.toFixed(2)}</td>
                    <td className={styles.desgloseNum}>${d.cif_asignado.toFixed(2)}</td>
                    <td className={styles.desgloseNum}>${d.arancel_monto.toFixed(2)}</td>
                    <td className={styles.desgloseNum}>${d.iva_monto.toFixed(2)}</td>
                    <td className={styles.desgloseNum}>${d.total_item.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {desgloseItems.some(d => d.sobretasas_detectadas.length > 0) && (
            <div className={styles.sobretasasBox}>
              {desgloseItems.filter(d => d.sobretasas_detectadas.length > 0).map(d => (
                <div key={d.linea} className={styles.sobretasaItem}>
                  <AlertTriangle size={12} /> Item {d.linea}: {d.sobretasas_detectadas.join(', ')}
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {alertasAuditoria && alertasAuditoria.length > 0 && (
        <div className={styles.alertasAuditoriaBox}>
          {alertasAuditoria.map((a, i) => (
            <div key={i} className={styles.alertaAuditoriaItem}><AlertCircle size={12} /> {a}</div>
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS_MAP = {
  alto: { label: 'Fallo de Regla', color: v('red'), bg: 'rgba(239,68,68,0.12)', icon: XCircle },
  medio: { label: 'Requiere Revisión', color: v('yellow'), bg: 'rgba(245,158,11,0.12)', icon: AlertCircle },
  bajo: { label: 'Aprobado Automatico', color: v('green'), bg: 'rgba(16,185,129,0.12)', icon: CheckCircle },
};

function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

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
  const [prevalidacionFetch, setPrevalidacionFetch] = useState(null);
  const prevalidacionData = prevalidacionFetch ?? location.state?.prevalidacion ?? historyData?.prevalidacion_resultado;
  const rightPanelRef = useRef(null);
  const reportRef = useRef(null);
  const [documentoFetchado, setDocumentoFetchado] = useState(false);
  const [cargandoDoc, setCargandoDoc] = useState(!rawData && !historyData && !!id && id !== 'null' && id !== 'undefined');
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [pdfCargando, setPdfCargando] = useState(false);

  const buildInitialState = () => {
    if (rawData) {
      return {
        numero: rawData.factura?.numero ?? '',
        emisor: rawData.remitente?.nombre ?? '',
        fecha: rawData.factura?.fecha ?? '',
        monto_total: rawData.economia?.total ?? 0,
        monto_subtotal: rawData.economia?.subtotal ?? 0,
        riesgo: rawData.riesgo ?? 'medio',
        observaciones: rawData.observaciones ?? '',
        moneda: rawData.factura?.moneda ?? '',
        incoterm: rawData.factura?.incoterm ?? '',
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
          peso_neto_kg: d.peso_neto_kg || 0,
        })),
      };
    }
    if (historyData) {
      
      const orig = historyData.datos_originales || {};
      return {
        numero: historyData.numero_factura ?? orig.numero_factura ?? '',
        emisor: historyData.proveedor ?? '',
        fecha: historyData.fecha_emision ?? '',
        monto_total: historyData.total_cif ?? 0,
        monto_subtotal: historyData.monto_subtotal ?? 0,
        riesgo: historyData.riesgo ?? 'medio',
        observaciones: '',
        moneda: historyData.moneda ?? '',
        incoterm: historyData.incoterm ?? orig.incoterm ?? '',
        pais_origen: historyData.pais_origen ?? orig.pais_origen ?? '',
        flete: historyData.flete ?? 0,
        seguro: historyData.seguro ?? 0,
        otros: historyData.otros ?? 0,
        receptor: historyData.cliente ?? orig.receptor?.nombre ?? '', receptor_tax: historyData.receptor_tax ?? orig.receptor?.tax_id ?? '',
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
            peso_neto_kg: p.peso_neto_kg || 0,
          }))
          : [],
      };
    }
    return {
      numero: 'Cargando...', emisor: 'Cargando...', fecha: '',
      monto_total: 0, monto_subtotal: 0,
      riesgo: 'medio', observaciones: '', moneda: '',
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

  const [datosOriginales, setDatosOriginales] = useState(() => {
    const fuente = rawData?.datos_originales || historyData?.datos_originales || null;
    return fuente;
  });

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
      <div className={styles.valorOriginal}>
        Original IA: {originalStr}
      </div>
    );
  };

  const VALID_INCOTERMS = new Set(['FOB','CIF','CFR','CPT','CIP','EXW','FCA','FAS','DAT','DAP','DDP']);
  const VALID_CURRENCIES = new Set(['USD','EUR','GBP','JPY','CNY','BRL','ARS','MXN','CLP','PEN','COP']);

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
  const fleteDebounced = useDebouncedValue(flete, 500);
  const seguroDebounced = useDebouncedValue(seguro, 500);
  const otrosGastosDebounced = useDebouncedValue(otrosGastos, 500);
  const [paisDestino, setPaisDestino] = useState('CL');
  const [aplicaTLC, setAplicaTLC] = useState(false);
  const [dtaTasa, setDtaTasa] = useState(0.8);
  const [tabActivo, setTabActivo] = useState('detalles');
  const [classificationData, setClassificationData] = useState({});
  const [aclaracionModal, setAclaracionModal] = useState(false);
  const [emailAclaracion] = useState(() => {
    const orig = rawData?.datos_originales || historyData?.datos_originales || {};
    return orig.receptor?.email || '';
  });

  const [clienteSelectId, setClienteSelectId] = useState(null);
  const [pdfSelectorField, setPdfSelectorField] = useState(null);
  const [rrnaDocuments, setRrnaDocuments] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [aprobarOk, setAprobarOk] = useState(false);
  const [vbbRefreshKey, setVbbRefreshKey] = useState(0);
  const [confirmacionPartida, setConfirmacionPartida] = useState({
    abierto: false, partida: '', descripcion: '', itemDescripcion: '',
    entidades: [], cargandoEntidades: false, metadata: null, itemId: null,
  });
  const [bloqueado, setBloqueado] = useState(false);
  const [enEspera, setEnEspera] = useState(false);
  const [prevalidando, setPrevalidando] = useState(false);
  const [toast, setToast] = useState(null);
  const mostrarToast = (mensaje, tipo = 'info') => setToast({ mensaje, tipo });
  const [landedCost, setLandedCost] = useState(null);
  const [landedCostLoading, setLandedCostLoading] = useState(false);
  const [valoracionDetail, setValoracionDetail] = useState(null);

  const MONEDAS_VALIDAS = ['USD','EUR','GBP','JPY','CNY','BRL','ARS','MXN','CLP','PEN','COP'];
  const PATRON_CONFIANZA = {
    numero_factura: /^[A-Za-z0-9][A-Za-z0-9/.#-]{1,30}$/,
    moneda: /^[A-Z]{3}$/,
    incoterm: /^(FOB|CIF|CFR|CPT|CIP|EXW|FCA|FAS|DAT|DAP|DDP)$/,
    tax_id: /^[A-Za-z0-9.-]{4,20}$/,
  };
  const calcularConfianza = (datos) => {
    if (!datos || typeof datos !== 'object') return null;
    const conf = {};
    const base = 85;
    const fl = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
    const nf = (datos.numero_factura || '').toString().trim();
    if (!nf || ['N/A','NA','n/a','S/N','0'].includes(nf)) conf.numero_factura = 15;
    else if (PATRON_CONFIANZA.numero_factura.test(nf)) conf.numero_factura = base;
    else if (nf.length >= 4) conf.numero_factura = 60;
    else conf.numero_factura = 35;
    const mt = fl(datos.monto_total || datos.monto_total_cif);
    if (mt <= 0) conf.monto_total = 10;
    else if (mt > 100_000_000) conf.monto_total = 60;
    else conf.monto_total = base;
    const st = fl(datos.monto_subtotal);
    conf.monto_subtotal = st > 0 ? base : 40;
    const flt = fl(datos.monto_flete);
    conf.monto_flete = flt < 0 ? 20 : base;
    const sg = fl(datos.monto_seguro);
    conf.monto_seguro = sg < 0 ? 20 : base;
    const inc = (datos.incoterm || '').toString().trim().toUpperCase();
    if (!inc) conf.incoterm = 70;
    else if (PATRON_CONFIANZA.incoterm.test(inc)) conf.incoterm = base;
    else conf.incoterm = 40;
    const mon = (datos.moneda || '').toString().trim().toUpperCase();
    if (!mon) conf.moneda = 20;
    else if (MONEDAS_VALIDAS.includes(mon)) conf.moneda = base;
    else conf.moneda = 50;
    const fe = datos.fecha_emision || '';
    if (!fe) conf.fecha_emision = 15;
    else {
      try {
        const s = String(fe).trim();
        const d = new Date(s.includes('T') ? s.slice(0, 19) : s);
        if (!isNaN(d.getTime())) conf.fecha_emision = base;
        else conf.fecha_emision = 40;
      } catch { conf.fecha_emision = 40; }
    }
    const po = (datos.pais_origen || '').toString().trim();
    conf.pais_origen = po.length >= 2 ? base : 30;
    const emisor = datos.emisor || {};
    const emNom = (emisor.nombre || '').toString().trim();
    if (!emNom || ['Desconocido','No detectado','N/A'].includes(emNom)) conf.emisor_nombre = 20;
    else if (emNom.length < 5) conf.emisor_nombre = 45;
    else conf.emisor_nombre = base;
    const emTax = (emisor.tax_id || '').toString().trim();
    if (!emTax) conf.emisor_tax_id = 20;
    else if (PATRON_CONFIANZA.tax_id.test(emTax)) conf.emisor_tax_id = base;
    else conf.emisor_tax_id = 50;
    const receptor = datos.receptor || {};
    const rcNom = (receptor.nombre || datos.receptor_nombre || '').toString().trim();
    conf.receptor_nombre = rcNom.length >= 5 ? base : 30;
    const rcTax = (receptor.tax_id || datos.receptor_tax_id || '').toString().trim();
    if (!rcTax) conf.receptor_tax_id = 20;
    else if (PATRON_CONFIANZA.tax_id.test(rcTax)) conf.receptor_tax_id = base;
    else conf.receptor_tax_id = 50;
    const detalles = datos.detalles || [];
    detalles.forEach((d, i) => {
      if (fl(d.cantidad) <= 0) conf[`detalle_${i}_cantidad`] = 30; else conf[`detalle_${i}_cantidad`] = base;
      if (fl(d.precio_unitario) <= 0) conf[`detalle_${i}_precio`] = 25; else conf[`detalle_${i}_precio`] = base;
      const desc = (d.descripcion_producto || '').toString().trim();
      if (!desc || desc.length < 5) conf[`detalle_${i}_descripcion`] = 25;
      else if (desc.length < 10) conf[`detalle_${i}_descripcion`] = 50;
      else conf[`detalle_${i}_descripcion`] = base;
    });
    const sumaItems = detalles.reduce((acc, d) => acc + fl(d.cantidad) * fl(d.precio_unitario), 0);
    const otros = fl(datos.monto_otros_gastos);
    const sumaConGastos = sumaItems + flt + sg + otros;
    if (mt > 0 && sumaConGastos > 0) {
      const diff = Math.abs(Math.round((sumaConGastos - mt) * 100) / 100);
      if (diff <= 0.1) {
        conf.cuadratura_items = 100;
      } else {
        const diffPct = diff / mt * 100;
        conf.cuadratura_items = Math.round(Math.max(20, 100 - diffPct * 2) * 10) / 10;
      }
    }
    if (datos.validacion_error) Object.keys(conf).forEach(k => { conf[k] = Math.min(conf[k], 70); });
    return conf;
  };
  const construirDatosConfianza = () => {
    if (rawData?.datos_originales) return rawData.datos_originales;
    if (historyData?.datos_originales) return historyData.datos_originales;
    if (!historyData) return null;
    return {
      numero_factura: historyData.numero_factura,
      fecha_emision: historyData.fecha_emision,
      moneda: historyData.moneda,
      incoterm: historyData.incoterm,
      pais_origen: historyData.pais_origen,
      monto_total_cif: historyData.total_cif,
      monto_subtotal: historyData.monto_subtotal,
      monto_flete: historyData.flete,
      monto_seguro: historyData.seguro,
      monto_otros_gastos: historyData.otros,
      emisor: { nombre: historyData.proveedor, tax_id: historyData.remitente_doc },
      receptor: { nombre: historyData.cliente, tax_id: historyData.receptor_tax },
      detalles: (historyData.partidas || []).map(p => ({
        descripcion_producto: p.descripcion,
        cantidad: p.cantidad,
        precio_unitario: p.precio_unitario,
      })),
    };
  };
  const confianzaDetalle = rawData?.confianza?.detalle ?? calcularConfianza(construirDatosConfianza());
  const confianzaGeneral = rawData?.confianza ?? (() => {
    if (!confianzaDetalle) return null;
    const pts = Object.values(confianzaDetalle).filter(v => typeof v === 'number');
    const prom = pts.length ? pts.reduce((a, b) => a + b, 0) / pts.length : 0;
    const criticos = Object.entries(confianzaDetalle)
      .filter(([, v]) => v < 60)
      .map(([k, v]) => ({ campo: k, puntaje: v }))
      .sort((a, b) => a.puntaje - b.puntaje);
    let nivel = 'ALTA';
    if (prom < 50 || criticos.length > 0) nivel = 'BAJA';
    else if (prom < 80) nivel = 'MEDIA';
    return { nivel, promedio: Math.round(prom * 10) / 10, campos_criticos: criticos, detalle: confianzaDetalle };
  })();
  const LABELS_CONFIANZA = {
    numero_factura: 'N° de Factura', monto_total: 'Monto Total',
    monto_subtotal: 'Subtotal', monto_flete: 'Flete', monto_seguro: 'Seguro',
    monto_otros_gastos: 'Otros Gastos', incoterm: 'Incoterm', moneda: 'Moneda',
    fecha_emision: 'Fecha de Emisión', pais_origen: 'País de Origen',
    emisor_nombre: 'Exportador', emisor_tax_id: 'RUT Exportador',
    receptor_nombre: 'Importador', receptor_tax_id: 'RUT Importador',
    cuadratura_items: 'Cuadratura Items vs Total',
  };
  const formatCampoConfianza = (key) => {
    const m = key.match(/^detalle_(\d+)_(cantidad|precio|descripcion)$/);
    if (m) {
      const sub = { cantidad: 'Cantidad', precio: 'Precio Unit.', descripcion: 'Descripción' }[m[2]];
      return `Item #${parseInt(m[1]) + 1} - ${sub}`;
    }
    return LABELS_CONFIANZA[key] || key.replace(/_/g, ' ');
  };
  const MAPA_CONFIANZA = {
    receptor: 'receptor_nombre', receptor_tax: 'receptor_tax_id',
    pais_origen: 'pais_origen', incoterm: 'incoterm',
    numero: 'numero_factura', fecha: 'fecha_emision', moneda: 'moneda',
    monto_total: 'monto_total', monto_subtotal: 'monto_subtotal',
    flete: 'monto_flete', seguro: 'monto_seguro', monto_otros_gastos: 'monto_otros_gastos',
  };
  const getConfianzaCampo = (campo) => {
    if (!confianzaDetalle) return null;
    const key = MAPA_CONFIANZA[campo];
    if (!key) return null;
    const val = confianzaDetalle[key];
    if (val === undefined || val === null) return null;
    return { puntaje: val, nivel: val >= 80 ? 'ALTA' : val >= 60 ? 'MEDIA' : 'BAJA', key };
  };
  const getConfianzaStyle = (campo) => {
    const c = getConfianzaCampo(campo);
    if (!c || c.nivel === 'ALTA') return {};
    return { borderColor: v('yellow'), boxShadow: `0 0 0 1px ${v('yellow')}`, position: 'relative' };
  };
  const getConfianzaTitle = (campo) => {
    const c = getConfianzaCampo(campo);
    if (!c || c.nivel === 'ALTA') return '';
    return `Confianza: ${c.nivel} (${Number(c.puntaje).toFixed(1)}%) — valor extraído con poca precisión, revisar manualmente`;
  };

  const stats = STATUS_MAP[factura.riesgo] || STATUS_MAP.medio;
  const StatIcon = stats.icon;

  const partidasList = factura.detalles
    .map(d => (d.partida_corregida || d.partida_sugerida || '').substring(0, 4))
    .filter(Boolean);
  const mkMod = (k) => setCamposMod(p => ({ ...p, [k]: true }));

  const handleCorrection = (idDetail, field, value) => {
    setFactura(prev => {
      const nd = prev.detalles.map(d => d.id === idDetail ? { ...d, [field]: value } : d);
      return { ...prev, detalles: nd };
    });
    mkMod(`item_${idDetail}_${field}`);
  };

  const handleAiClassification = async (idDetail, description) => {
    setClassificationData(prev => ({ ...prev, [idDetail]: { loading: true, error: null, result: null } }));
    try {
      const data = await peticionPost('/api/facturas/clasificar-item', { descripcion_producto: description });
      setClassificationData(prev => ({ ...prev, [idDetail]: { loading: false, error: null, result: data } }));
    } catch (err) {
      setClassificationData(prev => ({ ...prev, [idDetail]: { loading: false, error: err.message, result: null } }));
    }
  };

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

  const handleConfirmarPartidaYVBB = async (_entidadesSeleccionadas) => {
    const { partida, itemDescripcion, itemId } = confirmacionPartida;
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

  const handleSolicitarAclaracion = async (mensaje, email) => {
    const docId = id || historyData?.id;
    if (!docId || docId === 'null') return;
    const res = await peticionPost(`/api/documentos/${docId}/solicitar-aclaracion`, {
      mensaje, email,
    });
    setAclaracionModal(false);
    setEnEspera(true);
    return res;
  };

  const handleReabrir = async () => {
    const docId = id || historyData?.id;
    if (!docId || docId === 'null') return;
    try {
      await peticionPut(`/api/documentos/${docId}/reabrir`, {});
      setEnEspera(false);
      mostrarToast('Documento reabierto correctamente.', 'success');
    } catch (err) {
      mostrarToast('Error al reabrir: ' + err.message, 'error');
    }
  };

  const handlePdfTextExtracted = (text) => {
    if (pdfSelectorField === 'monto_total') {
      const numeric = parseFloat(text.replace(/[^0-9.,]/g, '').replace(/\./g, '').replace(',', '.'));
      if (!isNaN(numeric)) { setFactura(prev => ({ ...prev, monto_total: numeric })); mkMod('monto_total'); }
    }
    setPdfSelectorField(null);
  };

  const handleRrnaFileUpload = (itemId, file) => {
    if (!file) return;
    setRrnaDocuments(prev => ({ ...prev, [itemId]: { name: file.name, status: 'Validado', loading: false } }));
  };

  const removeRrnaDocument = (itemId) => {
    setRrnaDocuments(prev => { const c = { ...prev }; delete c[itemId]; return c; });
  };

  const docId = id || historyData?.id;

  useEffect(() => {
    const items = factura.detalles || [];
    if (!items.length) return;
    const controller = new AbortController();
    setLandedCostLoading(true);
    setValoracionDetail(null);
    const body = JSON.stringify({
      configuracion: { pais_destino: paisDestino, aplicar_tlc: aplicaTLC, tasa_dta_default: dtaTasa },
      cabecera_factura: { moneda: factura.moneda || 'USD', flete_global: fleteDebounced, seguro_global: seguroDebounced, otros_gastos_globales: otrosGastosDebounced },
      items: items.map((d, i) => ({
        linea: i + 1,
        descripcion: d.descripcion,
        hs_code: d.partida_corregida || d.partida_sugerida || '',
        cantidad: d.cantidad || 0,
        precio_unitario: d.precio_unitario || 0,
        peso_neto_kg: d.peso_neto_kg || (factura.peso_neto / Math.max(items.length, 1)) || 0,
      })),
    });
    const token = obtenerToken();
    fetch(`${API_BASE}/api/documentos/valorar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body,
      signal: controller.signal,
    })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(r => {
        setValoracionDetail(r);
        setLandedCost({
          valor_fob: r.resumen_cabecera.total_fob_items,
          flete: r.resumen_cabecera.total_flete,
          seguro: r.resumen_cabecera.total_seguro,
          otros: r.resumen_cabecera.total_otros,
          valor_cif: r.resumen_cabecera.total_cif,
          tasa_advalorem: 0,
          impuesto_advalorem: r.resumen_cabecera.total_arancel,
          tasa_iva: r.resumen_cabecera.total_iva > 0 && r.resumen_cabecera.total_cif > 0
            ? parseFloat(((r.resumen_cabecera.total_iva / (r.resumen_cabecera.total_cif + r.resumen_cabecera.total_arancel + r.resumen_cabecera.total_dta)) * 100).toFixed(1))
            : 19,
          dta: r.resumen_cabecera.total_dta,
          base_iva: r.resumen_cabecera.total_cif + r.resumen_cabecera.total_arancel + r.resumen_cabecera.total_dta,
          impuesto_iva: r.resumen_cabecera.total_iva,
          total_tributos: r.resumen_cabecera.total_tributos,
          total_landed_cost: r.resumen_cabecera.total_landed_cost,
        });
      })
      .catch(() => { if (!controller.signal.aborted) { setLandedCost(null); setValoracionDetail(null); } })
      .finally(() => { if (!controller.signal.aborted) setLandedCostLoading(false); });
    return () => controller.abort();
  }, [paisDestino, aplicaTLC, dtaTasa, fleteDebounced, seguroDebounced, otrosGastosDebounced, factura.detalles, factura.moneda, factura.peso_neto]);

  const lc = landedCost;
  const valorFOB = lc?.valor_fob ?? factura.detalles.reduce(
    (s, i) => s + (parseFloat(i.cantidad || 0) * parseFloat(i.precio_unitario || 0)), 0
  );
  const valorCIF = lc?.valor_cif ?? (valorFOB + parseFloat(flete || 0) + parseFloat(seguro || 0) + parseFloat(otrosGastos || 0));

  useEffect(() => {
    if (!cargandoDoc || !id || id === 'null' || id === 'undefined') return;
    const controller = new AbortController();
    setCargandoDoc(true);
    const token = obtenerToken();
    fetch(`${API_BASE}/api/documentos/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        
        const orig = data.datos_originales ?? {};
        setFactura(prev => ({
          ...prev,
          numero: data.numero_factura ?? orig.numero_factura ?? '',
          emisor: data.proveedor ?? '',
          monto_total: data.total_cif ?? 0,
          riesgo: data.riesgo ?? 'medio',
          observaciones: '',
          moneda: data.moneda ?? '',
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
        if (data.prevalidacion_resultado) setPrevalidacionFetch(data.prevalidacion_resultado);
        setFlete(data.flete ?? 0);
        setSeguro(data.seguro ?? 0);
        setOtrosGastos(data.otros ?? 0);
        if (data.bloqueado) setBloqueado(true);
        if (data.estado === 'En Espera') setEnEspera(true);
        setDocumentoFetchado(true);
      })
      .catch(() => {})
      .finally(() => { if (!controller.signal.aborted) setCargandoDoc(false); });
    return () => controller.abort();
  }, [id, cargandoDoc]);

  useEffect(() => {
    if (historyData?.bloqueado || documentoFetchado?.bloqueado) {
      setBloqueado(true);
    }
    if (historyData?.estado === 'En Espera' || documentoFetchado?.estado === 'En Espera') {
      setEnEspera(true);
    }
  }, [historyData, documentoFetchado]);

  const cargarLimiteDocumentos = useCallback(() => {
    const token = obtenerToken();
    fetch(`${API_BASE}/api/documentos/limite`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const token = obtenerToken();
    fetch(`${API_BASE}/api/documentos/limite`, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: controller.signal,
    }).catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!pdfUrl) { setPdfBlobUrl(null); return; }
    const controller = new AbortController();
    let blobUrl = null;
    setPdfCargando(true);
    const token = obtenerToken();
    fetch(pdfUrl, { headers: { 'Authorization': `Bearer ${token}` }, signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then(blob => {
        blobUrl = URL.createObjectURL(blob); setPdfBlobUrl(blobUrl);
      })
      .catch(() => { setPdfBlobUrl(null); })
      .finally(() => { setPdfCargando(false); });
    return () => { controller.abort(); if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [pdfUrl]);

  useEffect(() => {
    if (documentoFetchado?.cliente_id) {
      setClienteSelectId(documentoFetchado.cliente_id);
    }
  }, [historyData, documentoFetchado]);

  const handleGuardar = async () => {
    const targetId = id;
    if (!targetId || targetId === 'null' || targetId === 'undefined') {
      mostrarToast('El documento debe estar guardado en base de datos antes de editar.', 'error');
      return;
    }
    setGuardando(true);
    try {
      const respuesta = await peticionPut(`/api/documentos/${targetId}`, {
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
          peso_neto_kg: d.peso_neto_kg,
          orden: i,
        })),
        
        fecha_emision: factura.fecha || '',
        moneda: factura.moneda || '',
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
      if (respuesta?.prevalidacion_resultado) {
        setPrevalidacionFetch(respuesta.prevalidacion_resultado);
      }
      cargarLimiteDocumentos();
      mostrarToast('Documento guardado con exito.', 'success');
    } catch (e) {
      setGuardando(false);
      mostrarToast('Error al guardar: ' + e.message, 'error');
    }
  };

  const handlePreAprove = async () => {
    const pipelineBloqueado = (() => {
      if (!prevalidacionData?.etapas) return true;
      const etapas = prevalidacionData.etapas;
      if (etapas.length < 7) return true;
      return etapas.some(e => e.estado !== 'PASS');
    })();
    const tienePendiente = prevalidacionData?.etapas?.some(e => e.estado === 'PENDIENTE');
    if (pipelineBloqueado) {
      if (tienePendiente) {
        mostrarToast('Esperando carga o detección del Documento de Transporte.', 'warning');
      } else {
        mostrarToast('No se puede aprobar el envío: existen alertas pendientes en el pipeline de validación.', 'error');
      }
      return;
    }
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
        mostrarToast(data.mensaje || 'Operación procesada con éxito.', 'success');
        setTimeout(() => navigate(esAdmin ? '/maestro' : '/historial'), 1500);
      } catch (_err) {
        mostrarToast('Error de red al intentar contactar con el servidor.', 'error');
      }
    } else {
      mostrarToast('¡Datos validados en memoria!', 'success');
      setTimeout(() => navigate('/'), 1500);
    }
  };

  const handlePrevalidarAprobar = async () => {
    const targetId = id || historyData?.id;
    if (!targetId || targetId === 'null') {
      mostrarToast('No hay un documento en historial para prevalidar.', 'error');
      return;
    }
    setPrevalidando(true);
    try {
      await peticionPut(`/api/documentos/${targetId}/prevalidar-aprobar`, { confirmar: true });
      setBloqueado(true);
      setFactura(prev => ({ ...prev, estado: 'Aprobado' }));
      mostrarToast('Documento prevalidado, aprobado y bloqueado con éxito.', 'success');
    } catch (err) {
      mostrarToast('Error al prevalidar: ' + err.message, 'error');
    } finally {
      setPrevalidando(false);
    }
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    try {
      mostrarToast('Generando PDF...', 'info');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const PW = pdf.internal.pageSize.getWidth();
      const PH = pdf.internal.pageSize.getHeight();
      const MG = 10;
      const UW = PW - MG * 2;
      const container = reportRef.current;
      const fullCanvas = await html2canvas(container, { scale: 2, useCORS: true, logging: false });
      const scale = fullCanvas.width / Math.max(container.offsetWidth, 1);
      const secciones = Array.from(container.children)
        .filter(el => el.nodeType === 1 && (el.tagName === 'TABLE' || el.tagName === 'DIV'))
        .map(el => ({
          left: el.offsetLeft,
          top: el.offsetTop,
          width: el.offsetWidth,
          height: el.offsetHeight,
        }))
        .filter(r => r.width > 0 && r.height > 0);
      let y = MG;
      for (const r of secciones) {
        const cx = r.left * scale;
        const cy = r.top * scale;
        const cw = r.width * scale;
        const ch = r.height * scale;
        const tmp = document.createElement('canvas');
        tmp.width = cw;
        tmp.height = ch;
        tmp.getContext('2d').drawImage(fullCanvas, cx, cy, cw, ch, 0, 0, cw, ch);
        const img = tmp.toDataURL('image/png');
        const hMm = (ch * UW) / cw;
        if (y + hMm > PH - MG && y > MG) {
          pdf.addPage();
          y = MG;
        }
        if (hMm <= PH - MG * 2) {
          pdf.addImage(img, 'PNG', MG, y, UW, hMm);
          y += hMm + 5;
        } else {
          let resto = hMm;
          let yOff = 0;
          while (resto > 0) {
            const hVis = Math.min(resto, PH - MG * 2);
            const proporcion = hVis / hMm;
            const hCh = ch * proporcion;
            const yCh = ch * (yOff / hMm);
            const ptmp = document.createElement('canvas');
            ptmp.width = cw;
            ptmp.height = hCh;
            ptmp.getContext('2d').drawImage(tmp, 0, yCh, cw, hCh, 0, 0, cw, hCh);
            pdf.addImage(ptmp.toDataURL('image/png'), 'PNG', MG, y, UW, hVis);
            resto -= hVis;
            yOff += hVis;
            if (resto > 0) { pdf.addPage(); y = MG; }
          }
          y = MG + 5;
        }
      }
      pdf.save(`WebCheck_Reporte_${factura.numero || 'documento'}.pdf`);
      mostrarToast('PDF generado exitosamente', 'success');
    } catch (err) {
      console.error('Error al generar PDF:', err);
      mostrarToast('Error al generar el PDF', 'error');
    }
  };

  return (
    <div className={`fade-in ${styles.pageContainer}`}>
      
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <button onClick={() => navigate(isAdmin ? '/maestro' : '/historial')} className={`btn btn-secondary ${styles.backBtn}`} title="Volver">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className={styles.headerTitle}>
              Revisión de Factura
            </h1>
            <p className={styles.headerSubtitle}>
              <span>{factura.emisor}</span>
              <span className={styles.headerNumero}>· {factura.numero}</span>
            </p>
          </div>
        </div>
        <div className={styles.pageHeaderRight}>
          {enEspera ? (
            <div className={styles.estadoBadgeEnEspera}>
              <MessageSquare size={14} /> En Espera
            </div>
          ) : (
            <div className={styles.estadoBadge} style={{
              color: stats.color, background: stats.bg,
              border: `1px solid ${stats.color}30`,
            }}>
              <StatIcon size={14} /> {stats.label}
            </div>
          )}
          {bloqueado && (
            <div className={styles.estadoBadgeLocked}>
              <Lock size={12} /> Aprobado
            </div>
          )}
          <button onClick={handleExportPDF} className={`btn btn-secondary ${styles.exportBtn}`}>
            <FileText size={14} /> PDF
          </button>
          {!bloqueado && !enEspera && ((id && id !== 'null') || historyData?.id) && (
            <button onClick={() => setAclaracionModal(true)}
              className={`btn ${styles.aclaracionBtn}`}>
              <MessageSquare size={14} /> Aclaración
            </button>
          )}
          {!bloqueado && enEspera && (
            <button onClick={handleReabrir} className={`btn ${styles.reabrirBtn}`}>
              <RotateCcw size={14} /> Reabrir
            </button>
          )}
        </div>
      </div>

      <div className={styles.mainGrid}>
        
        <VisorPDF pdfUrl={pdfUrl} pdfBlobUrl={pdfBlobUrl} pdfCargando={pdfCargando} />

        <div ref={rightPanelRef} className={styles.rightPanel}>
          <div className={styles.rightPanelInner}>
            {confianzaGeneral && confianzaGeneral.nivel !== 'ALTA' && (() => {
              const c = confianzaGeneral;
              return (
                <div>
                  <div className={styles.confianzaWarning}>
                    <AlertTriangle size={14} color="var(--yellow)" />
                    <strong className={styles.confianzaWarningText}>Extracción con confianza {c.nivel}</strong>
                    {c.campos_criticos?.length > 0 && (
                      <div className={styles.confianzaChips}>
                        {c.campos_criticos.map(k => {
                          const key = k.campo ?? k;
                          const pts = k.puntaje ?? (confianzaDetalle?.[key] ?? 0);
                          return (
                            <span key={key} className={styles.confianzaChip}>
                              {formatCampoConfianza(key)} <span className={styles.confianzaChipPct}>({pts.toFixed(1)}%)</span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className={`glass-panel ${styles.glassPanelCompact}`}>
              <div className={styles.sectionTitle}>
                <FileText size={12} /> Datos del Documento
              </div>
              <div className={`grid-2 ${styles.grid2}`}>
                <div className={styles.fieldCompact}>
                  <label className="form-label">Receptor</label>
                  <input className="form-input" title={getConfianzaTitle('receptor')}
                    style={{ ...getConfianzaStyle('receptor'), ...(camposMod['receptor'] ? { borderColor: v('primary'), boxShadow: `0 0 0 1px ${v('primary')}` } : {}), ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}
                    type="text" value={factura.receptor} disabled={bloqueado}
                    onChange={(e) => { if (!bloqueado) { setFactura(p => ({ ...p, receptor: e.target.value })); mkMod('receptor'); }}}
                  />
                  <ValorOriginal campo="receptor" />
                </div>
                <div className={styles.fieldCompact}>
                  <label className="form-label">RUT / Tax ID</label>
                  <input className="form-input" title={getConfianzaTitle('receptor_tax')} style={{
                    ...getConfianzaStyle('receptor_tax'),
                    ...(camposMod.receptor_tax ? { borderColor: v('primary'), boxShadow: `0 0 0 1px ${v('primary')}` } : {}),
                    ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                  }}
                    type="text" value={factura.receptor_tax} disabled={bloqueado}
                    onChange={(e) => { if (!bloqueado) { setFactura(p => ({ ...p, receptor_tax: e.target.value })); mkMod('receptor_tax'); }}}
                  />
                  <ValorOriginal campo="receptor_tax" />
                </div>
                <div className={styles.fieldCompact}>
                  <label className="form-label">País Origen</label>
                  <input className="form-input" title={getConfianzaTitle('pais_origen')} style={{
                    ...getConfianzaStyle('pais_origen'),
                    ...(camposMod.pais_origen ? { borderColor: v('primary'), boxShadow: `0 0 0 1px ${v('primary')}` } : {}),
                    ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                  }}
                    type="text" value={factura.pais_origen} disabled={bloqueado}
                    onChange={(e) => { if (!bloqueado) { setFactura(p => ({ ...p, pais_origen: e.target.value })); mkMod('pais_origen'); }}}
                  />
                  <ValorOriginal campo="pais_origen" />
                </div>
                <div className={styles.fieldCompact}>
                  <label className="form-label">Incoterm</label>
                  <input className="form-input" title={getConfianzaTitle('incoterm')} style={{
                    ...getConfianzaStyle('incoterm'),
                    ...(camposMod.incoterm ? { borderColor: v('primary'), boxShadow: `0 0 0 1px ${v('primary')}` } : {}),
                    ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                  }}
                    type="text" value={factura.incoterm} disabled={bloqueado}
                    onChange={(e) => { if (!bloqueado) { setFactura(p => ({ ...p, incoterm: e.target.value })); mkMod('incoterm'); }}}
                  />
                  <ValorOriginal campo="incoterm" />
                </div>
                <div className={styles.fieldCompact}>
                  <label className="form-label">N° Factura</label>
                  <input className="form-input" title={getConfianzaTitle('numero')} type="text" value={factura.numero} disabled />
                </div>
                <div className={styles.fieldCompact}>
                  <label className="form-label">Fecha Emisión</label>
                  <input className="form-input" title={getConfianzaTitle('fecha')} type="text" value={factura.fecha} disabled={bloqueado}
                    style={{
                      ...getConfianzaStyle('fecha'),
                      ...(camposMod.fecha ? { borderColor: v('primary'), boxShadow: `0 0 0 1px ${v('primary')}` } : {}),
                      ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                    }}
                    onChange={(e) => { if (!bloqueado) { setFactura(p => ({ ...p, fecha: e.target.value })); mkMod('fecha'); }}}
                  />
                  <ValorOriginal campo="fecha" />
                </div>
                <div className={styles.fieldCompact}>
                  <label className="form-label">Moneda</label>
                  <select className="form-input" title={getConfianzaTitle('moneda')} value={factura.moneda} disabled={bloqueado}
                    style={{
                      ...getConfianzaStyle('moneda'),
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

            <div className={`glass-panel ${styles.glassPanelCompact}`}>
              <div className={styles.sectionTitle}>
                <MapPin size={12} /> Direcciones
              </div>
              <div className={styles.formRow2}>
                <div className={styles.fieldHalf}>
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
                <div className={styles.fieldHalf}>
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

            <div className={`glass-panel ${styles.glassPanelCompact}`}>
              <div className={styles.sectionTitle}>
                <DollarSign size={12} /> Valores
              </div>
              <div className={`grid-2 ${styles.grid2}`}>
                <div className={styles.fieldCompact}>
                  <label className={styles.labelRow}>
                    Monto Total (USD)
                    {pdfUrl && (
                      <button onClick={() => setPdfSelectorField('monto_total')} title="Extraer del PDF"
                        className={styles.scanBtn}>
                        <Scan size={12} />
                      </button>
                    )}
                  </label>
                  <input className={`form-input ${styles.fieldBold}`} title={getConfianzaTitle('monto_total')}
                    style={{
                      ...getConfianzaStyle('monto_total'),
                      ...(camposMod.monto_total ? { borderColor: v('primary'), boxShadow: `0 0 0 1px ${v('primary')}` } : {}),
                      ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                    }}
                    type="number" onWheel={e => e.target.blur()} value={factura.monto_total} disabled={bloqueado}
                    onChange={(e) => { if (!bloqueado) { setFactura(p => ({ ...p, monto_total: Math.max(0, parseFloat(e.target.value) || 0) })); mkMod('monto_total'); }}}
                  />
                  <ValorOriginal campo="monto_total" formato="moneda" />
                </div>
                <div className={styles.fieldCompact}>
                  <label className="form-label">Subtotal (USD)</label>
                  <input className="form-input" title={getConfianzaTitle('monto_subtotal')} type="number" onWheel={e => e.target.blur()}
                    value={factura.monto_subtotal} disabled={bloqueado}
                    style={{
                      ...getConfianzaStyle('monto_subtotal'),
                      ...(camposMod.monto_subtotal ? { borderColor: v('primary'), boxShadow: `0 0 0 1px ${v('primary')}` } : {}),
                      ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                    }}
                    onChange={(e) => { if (!bloqueado) { setFactura(p => ({ ...p, monto_subtotal: Math.max(0, parseFloat(e.target.value) || 0) })); mkMod('monto_subtotal'); }}}
                  />
                  <ValorOriginal campo="monto_subtotal" formato="moneda" />
                </div>
                <div className={styles.fieldCompact}>
                  <label className="form-label">Flete (USD)</label>
                  <input className="form-input" title={getConfianzaTitle('flete')} style={{
                    ...getConfianzaStyle('flete'),
                    ...(camposMod.flete ? { borderColor: v('primary'), boxShadow: `0 0 0 1px ${v('primary')}` } : {}),
                    ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                  }}
                    type="number" onWheel={e => e.target.blur()} value={flete} disabled={bloqueado}
                    onChange={(e) => { if (!bloqueado) { setFlete(Math.max(0, parseFloat(e.target.value) || 0)); mkMod('flete'); }}}
                  />
                  <ValorOriginal campo="flete" formato="moneda" />
                </div>
                <div className={styles.fieldCompact}>
                  <label className="form-label">Seguro (USD)</label>
                  <input className="form-input" title={getConfianzaTitle('seguro')} style={{
                    ...getConfianzaStyle('seguro'),
                    ...(camposMod.seguro ? { borderColor: v('primary'), boxShadow: `0 0 0 1px ${v('primary')}` } : {}),
                    ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                  }}
                    type="number" onWheel={e => e.target.blur()} value={seguro} disabled={bloqueado}
                    onChange={(e) => { if (!bloqueado) { setSeguro(Math.max(0, parseFloat(e.target.value) || 0)); mkMod('seguro'); }}}
                  />
                  <ValorOriginal campo="seguro" formato="moneda" />
                </div>
                <div className={styles.fieldCompact}>
                  <label className="form-label">Otros (USD)</label>
                  <input className="form-input" title={getConfianzaTitle('monto_otros_gastos')} style={{
                    ...getConfianzaStyle('monto_otros_gastos'),
                    ...(camposMod.otros ? { borderColor: v('primary'), boxShadow: `0 0 0 1px ${v('primary')}` } : {}),
                    ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                  }}
                    type="number" onWheel={e => e.target.blur()} value={otrosGastos} disabled={bloqueado}
                    onChange={(e) => { if (!bloqueado) { setOtrosGastos(Math.max(0, parseFloat(e.target.value) || 0)); mkMod('otros'); }}}
                  />
                  <ValorOriginal campo="otros" formato="moneda" />
                </div>
                <div className={styles.fieldCompact}>
                  <label className="form-label">Valor CIF (USD)</label>
                  <input className={`form-input ${styles.fieldBold} ${styles.fieldMuted}`} type="number" onWheel={e => e.target.blur()} value={valorCIF} disabled />
                </div>
              </div>
            </div>

            <div className={`glass-panel ${styles.glassPanelCompact}`}>
              <div className={styles.sectionTitle}>
                <Truck size={12} /> Logística
              </div>
              <div className={`grid-2 ${styles.grid2}`}>
                <div className={styles.fieldCompact}>
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
                <div className={styles.fieldCompact}>
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
                <div className={styles.fieldCompact}>
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
                <div className={styles.fieldCompact}>
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

            <CuadraturaAduanera
              detalles={factura.detalles}
              montoSubtotal={factura.monto_subtotal}
              montoTotal={factura.monto_total}
              flete={flete}
              seguro={seguro}
              otrosGastos={otrosGastos}
            />

            <div className={`glass-panel ${styles.glassPanelNoPadding}`}>
              <NavegacionPestanas tabActivo={tabActivo} onTabChange={setTabActivo} />

              <div className={styles.tabContent}>
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
                  <SimuladorLiquidacion
                    paisDestino={paisDestino}
                    onPaisDestinoChange={setPaisDestino}
                    dtaTasa={dtaTasa}
                    onDtaTasaChange={setDtaTasa}
                    aplicaTLC={aplicaTLC}
                    onAplicaTLCChange={setAplicaTLC}
                    landedCost={landedCost}
                    landedCostLoading={landedCostLoading}
                    items={factura.detalles}
                    alertasAuditoria={valoracionDetail?.alertas_auditoria}
                    desgloseItems={valoracionDetail?.desglose_items}
                  />
                )}
                {tabActivo === 'prevalidacion' && (
                  <PipelinePrevalidacion prevalidacion={prevalidacionData} />
                )}
                {tabActivo === 'vbb' && (
                  <>
                    <GestorVistosBuenos documentoId={Number(id || historyData?.id)} partidas={partidasList} refreshKey={vbbRefreshKey} onPermisoValidado={(data) => setPrevalidacionFetch(data)} />
                    <ObservacionesPanel documentoId={Number(id || historyData?.id)} />
                  </>
                )}
              </div>
            </div>
          </div>

          <BarraAcciones
            bloqueado={bloqueado}
            enEspera={enEspera}
            guardando={guardando}
            isAdmin={isAdmin}
            prevalidando={prevalidando}
            aprobarOk={aprobarOk}
            tieneDocGuardado={(id && id !== 'null') || !!historyData?.id}
            riesgo={factura.riesgo}
            onGuardar={handleGuardar}
            onPrevalidarAprobar={handlePrevalidarAprobar}
            onAprobar={handlePreAprove}
          />
        </div>
      </div>

      {pdfSelectorField && pdfUrl && (
        <PdfTextSelector pdfUrl={pdfUrl} fieldLabel="Monto Total CIF"
          onClose={() => setPdfSelectorField(null)} onTextSelected={handlePdfTextExtracted}
        />
      )}

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

      <ModalAclaracion
        abierto={aclaracionModal}
        onCerrar={() => setAclaracionModal(false)}
        onEnviar={handleSolicitarAclaracion}
        email={emailAclaracion}
      />
      <Toast mensaje={toast?.mensaje} tipo={toast?.tipo} onCerrar={() => setToast(null)} />

      <div ref={reportRef} style={{ position: 'absolute', left: '-9999px', top: 0, width: '800px', background: '#fff', color: '#000', fontFamily: 'Arial, sans-serif', fontSize: '11px', lineHeight: '1.4', padding: '40px', zIndex: -1 }}>
        <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #1e40af', paddingBottom: '15px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e40af', margin: '0 0 4px' }}>REPORTE DE EXTRACCIÓN ADUANERA</h1>
          <p style={{ fontSize: '10px', color: '#666', margin: 0 }}>Generado el {new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} por {user?.name || '—'}</p>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
          <thead><tr><th colSpan={2} style={{ background: '#1e40af', color: '#fff', padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold' }}>DATOS DEL DOCUMENTO</th></tr></thead>
          <tbody>
            <tr><td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold', width: '180px', background: '#f8fafc' }}>N° Factura</td><td style={{ padding: '6px 12px', border: '1px solid #ddd' }}>{factura.numero || '—'}</td></tr>
            <tr><td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold', background: '#f8fafc' }}>Emisor</td><td style={{ padding: '6px 12px', border: '1px solid #ddd' }}>{factura.emisor || '—'}</td></tr>
            <tr><td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold', background: '#f8fafc' }}>Fecha Emisión</td><td style={{ padding: '6px 12px', border: '1px solid #ddd' }}>{factura.fecha || '—'}</td></tr>
            <tr><td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold', background: '#f8fafc' }}>Moneda</td><td style={{ padding: '6px 12px', border: '1px solid #ddd' }}>{factura.moneda || '—'}</td></tr>
            <tr><td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold', background: '#f8fafc' }}>Incoterm</td><td style={{ padding: '6px 12px', border: '1px solid #ddd' }}>{factura.incoterm || '—'}</td></tr>
            <tr><td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold', background: '#f8fafc' }}>País Origen</td><td style={{ padding: '6px 12px', border: '1px solid #ddd' }}>{factura.pais_origen || '—'}</td></tr>
            <tr><td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold', background: '#f8fafc' }}>Riesgo</td><td style={{ padding: '6px 12px', border: '1px solid #ddd' }}>{(factura.riesgo || '—').toUpperCase()}</td></tr>
          </tbody>
        </table>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
          <thead><tr><th colSpan={2} style={{ background: '#1e40af', color: '#fff', padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold' }}>PARTES</th></tr></thead>
          <tbody>
            <tr><td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold', width: '180px', background: '#f8fafc' }}>Remitente</td><td style={{ padding: '6px 12px', border: '1px solid #ddd' }}>{factura.emisor || '—'}</td></tr>
            <tr><td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold', background: '#f8fafc' }}>Doc. Remitente</td><td style={{ padding: '6px 12px', border: '1px solid #ddd' }}>{factura.remitente_doc || '—'}</td></tr>
            <tr><td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold', background: '#f8fafc' }}>Dir. Remitente</td><td style={{ padding: '6px 12px', border: '1px solid #ddd' }}>{factura.remitente_dir || '—'}</td></tr>
            <tr><td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold', background: '#f8fafc' }}>Destinatario</td><td style={{ padding: '6px 12px', border: '1px solid #ddd' }}>{factura.receptor || '—'}</td></tr>
            <tr><td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold', background: '#f8fafc' }}>Tax ID</td><td style={{ padding: '6px 12px', border: '1px solid #ddd' }}>{factura.receptor_tax || '—'}</td></tr>
            <tr><td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold', background: '#f8fafc' }}>Dir. Destinatario</td><td style={{ padding: '6px 12px', border: '1px solid #ddd' }}>{factura.destinatario_dir || '—'}</td></tr>
          </tbody>
        </table>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
          <thead><tr><th colSpan={2} style={{ background: '#1e40af', color: '#fff', padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold' }}>VALORES FINANCIEROS</th></tr></thead>
          <tbody>
            <tr><td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold', width: '180px', background: '#f8fafc' }}>Monto Subtotal</td><td style={{ padding: '6px 12px', border: '1px solid #ddd' }}>${(factura.monto_subtotal || 0).toFixed(2)}</td></tr>
            <tr><td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold', background: '#f8fafc' }}>Flete</td><td style={{ padding: '6px 12px', border: '1px solid #ddd' }}>${flete.toFixed(2)}</td></tr>
            <tr><td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold', background: '#f8fafc' }}>Seguro</td><td style={{ padding: '6px 12px', border: '1px solid #ddd' }}>${seguro.toFixed(2)}</td></tr>
            <tr><td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold', background: '#f8fafc' }}>Otros Gastos</td><td style={{ padding: '6px 12px', border: '1px solid #ddd' }}>${otrosGastos.toFixed(2)}</td></tr>
            <tr><td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold', background: '#1e40af', color: '#fff' }}>Total CIF</td><td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold' }}>${(factura.monto_total || valorCIF || 0).toFixed(2)}</td></tr>
          </tbody>
        </table>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
          <thead><tr><th colSpan={2} style={{ background: '#1e40af', color: '#fff', padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold' }}>LOGÍSTICA</th></tr></thead>
          <tbody>
            <tr><td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold', width: '180px', background: '#f8fafc' }}>Transporte País</td><td style={{ padding: '6px 12px', border: '1px solid #ddd' }}>{factura.transporte_pais || '—'}</td></tr>
            <tr><td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold', background: '#f8fafc' }}>Método Transporte</td><td style={{ padding: '6px 12px', border: '1px solid #ddd' }}>{factura.transporte_metodo || '—'}</td></tr>
            <tr><td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold', background: '#f8fafc' }}>Peso Bruto</td><td style={{ padding: '6px 12px', border: '1px solid #ddd' }}>{(factura.peso_bruto || 0).toFixed(2)} kg</td></tr>
            <tr><td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold', background: '#f8fafc' }}>Peso Neto</td><td style={{ padding: '6px 12px', border: '1px solid #ddd' }}>{(factura.peso_neto || 0).toFixed(2)} kg</td></tr>
          </tbody>
        </table>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
          <thead><tr><th style={{ background: '#1e40af', color: '#fff', padding: '8px 10px', textAlign: 'left', fontSize: '11px', fontWeight: 'bold' }}>#</th><th style={{ background: '#1e40af', color: '#fff', padding: '8px 10px', textAlign: 'left', fontSize: '11px', fontWeight: 'bold' }}>Descripción</th><th style={{ background: '#1e40af', color: '#fff', padding: '8px 10px', textAlign: 'right', fontSize: '11px', fontWeight: 'bold' }}>Cant.</th><th style={{ background: '#1e40af', color: '#fff', padding: '8px 10px', textAlign: 'right', fontSize: '11px', fontWeight: 'bold' }}>P. Unit.</th><th style={{ background: '#1e40af', color: '#fff', padding: '8px 10px', textAlign: 'right', fontSize: '11px', fontWeight: 'bold' }}>Total</th><th style={{ background: '#1e40af', color: '#fff', padding: '8px 10px', textAlign: 'right', fontSize: '11px', fontWeight: 'bold' }}>Peso Neto</th><th style={{ background: '#1e40af', color: '#fff', padding: '8px 10px', textAlign: 'left', fontSize: '11px', fontWeight: 'bold' }}>Partida Arancelaria</th></tr></thead>
          <tbody>
            {(factura.detalles || []).map((item, i) => (
              <tr key={i}>
                <td style={{ padding: '5px 10px', border: '1px solid #ddd', textAlign: 'center' }}>{i + 1}</td>
                <td style={{ padding: '5px 10px', border: '1px solid #ddd' }}>{item.descripcion || '—'}</td>
                <td style={{ padding: '5px 10px', border: '1px solid #ddd', textAlign: 'right' }}>{item.cantidad || 0}</td>
                <td style={{ padding: '5px 10px', border: '1px solid #ddd', textAlign: 'right' }}>${(item.precio_unitario || 0).toFixed(2)}</td>
                <td style={{ padding: '5px 10px', border: '1px solid #ddd', textAlign: 'right' }}>${((item.cantidad || 0) * (item.precio_unitario || 0)).toFixed(2)}</td>
                <td style={{ padding: '5px 10px', border: '1px solid #ddd', textAlign: 'right' }}>{(item.peso_neto_kg || 0).toFixed(3)} kg</td>
                <td style={{ padding: '5px 10px', border: '1px solid #ddd' }}>{item.partida_corregida || item.partida_sugerida || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {(lc || valoracionDetail) && (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px' }}>
              <thead><tr><th colSpan={2} style={{ background: '#1e40af', color: '#fff', padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold' }}>LIQUIDACIÓN TRIBUTARIA — RESUMEN</th></tr></thead>
              <tbody>
                <tr><td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold', width: '180px', background: '#f8fafc' }}>Valor FOB</td><td style={{ padding: '6px 12px', border: '1px solid #ddd' }}>${(lc?.valor_fob || valorFOB || 0).toFixed(2)}</td></tr>
                <tr><td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold', background: '#f8fafc' }}>Flete</td><td style={{ padding: '6px 12px', border: '1px solid #ddd' }}>${(lc?.flete || flete || 0).toFixed(2)}</td></tr>
                <tr><td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold', background: '#f8fafc' }}>Seguro</td><td style={{ padding: '6px 12px', border: '1px solid #ddd' }}>${(lc?.seguro || seguro || 0).toFixed(2)}</td></tr>
                <tr><td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold', background: '#f8fafc' }}>Otros Gastos</td><td style={{ padding: '6px 12px', border: '1px solid #ddd' }}>${(lc?.otros || otrosGastos || 0).toFixed(2)}</td></tr>
                <tr><td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold', background: '#f8fafc' }}>Valor Aduana (CIF)</td><td style={{ padding: '6px 12px', border: '1px solid #ddd' }}>${(lc?.valor_cif || valorCIF || 0).toFixed(2)}</td></tr>
                <tr><td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold', background: '#f8fafc' }}>Arancel</td><td style={{ padding: '6px 12px', border: '1px solid #ddd' }}>${(lc?.impuesto_advalorem || 0).toFixed(2)}</td></tr>
                {lc?.dta > 0 && <tr><td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold', background: '#f8fafc' }}>DTA</td><td style={{ padding: '6px 12px', border: '1px solid #ddd' }}>${(lc?.dta || 0).toFixed(2)}</td></tr>}
                <tr><td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold', background: '#f8fafc' }}>IVA ({lc?.tasa_iva || 19}%)</td><td style={{ padding: '6px 12px', border: '1px solid #ddd' }}>${(lc?.impuesto_iva || 0).toFixed(2)}</td></tr>
                <tr><td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold', background: '#1e40af', color: '#fff' }}>TOTAL TRIBUTOS</td><td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold' }}>${(lc?.total_tributos || 0).toFixed(2)}</td></tr>
                <tr><td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold', background: '#047857', color: '#fff' }}>TOTAL LANDED COST</td><td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold' }}>${(lc?.total_landed_cost || 0).toFixed(2)}</td></tr>
              </tbody>
            </table>

            {valoracionDetail?.desglose_items && valoracionDetail.desglose_items.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
                <thead>
                  <tr>
                    <th style={{ background: '#0369a1', color: '#fff', padding: '6px 8px', textAlign: 'center', fontSize: '10px', fontWeight: 'bold' }}>#</th>
                    <th style={{ background: '#0369a1', color: '#fff', padding: '6px 8px', textAlign: 'left', fontSize: '10px', fontWeight: 'bold' }}>HS Code</th>
                    <th style={{ background: '#0369a1', color: '#fff', padding: '6px 8px', textAlign: 'left', fontSize: '10px', fontWeight: 'bold' }}>Descripción</th>
                    <th style={{ background: '#0369a1', color: '#fff', padding: '6px 8px', textAlign: 'right', fontSize: '10px', fontWeight: 'bold' }}>FOB</th>
                    <th style={{ background: '#0369a1', color: '#fff', padding: '6px 8px', textAlign: 'right', fontSize: '10px', fontWeight: 'bold' }}>Peso Prop.</th>
                    <th style={{ background: '#0369a1', color: '#fff', padding: '6px 8px', textAlign: 'right', fontSize: '10px', fontWeight: 'bold' }}>Increm.</th>
                    <th style={{ background: '#0369a1', color: '#fff', padding: '6px 8px', textAlign: 'right', fontSize: '10px', fontWeight: 'bold' }}>CIF</th>
                    <th style={{ background: '#0369a1', color: '#fff', padding: '6px 8px', textAlign: 'right', fontSize: '10px', fontWeight: 'bold' }}>Arancel</th>
                    <th style={{ background: '#0369a1', color: '#fff', padding: '6px 8px', textAlign: 'right', fontSize: '10px', fontWeight: 'bold' }}>IVA</th>
                    <th style={{ background: '#0369a1', color: '#fff', padding: '6px 8px', textAlign: 'right', fontSize: '10px', fontWeight: 'bold' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {valoracionDetail.desglose_items.map((d, i) => (
                    <tr key={i}>
                      <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'center' }}>{d.linea}</td>
                      <td style={{ padding: '4px 8px', border: '1px solid #ddd', fontSize: '10px' }}>{d.hs_code || '—'}</td>
                      <td style={{ padding: '4px 8px', border: '1px solid #ddd', fontSize: '10px' }}>{d.descripcion || '—'}</td>
                      <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'right', fontSize: '10px' }}>${(d.fob_asignado || 0).toFixed(2)}</td>
                      <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'right', fontSize: '10px' }}>{(d.peso_proporcional * 100 || 0).toFixed(1)}%</td>
                      <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'right', fontSize: '10px' }}>${(d.incrementables_asignados || 0).toFixed(2)}</td>
                      <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'right', fontSize: '10px' }}>${(d.cif_asignado || 0).toFixed(2)}</td>
                      <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'right', fontSize: '10px' }}>${(d.arancel_monto || 0).toFixed(2)}</td>
                      <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'right', fontSize: '10px' }}>${(d.iva_monto || 0).toFixed(2)}</td>
                      <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'right', fontSize: '10px' }}>${(d.total_item || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {valoracionDetail?.desglose_items?.some(d => d.sobretasas_detectadas?.length > 0) && (
              <div style={{ marginBottom: '16px', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '6px', padding: '10px 14px' }}>
                <p style={{ fontWeight: 'bold', margin: '0 0 6px', fontSize: '11px', color: '#92400e' }}>SOBRETASAS DETECTADAS</p>
                {valoracionDetail.desglose_items.filter(d => d.sobretasas_detectadas?.length > 0).map((d, i) => (
                  <p key={i} style={{ margin: '2px 0', fontSize: '10px', color: '#92400e' }}>
                    <strong>Item {d.linea}:</strong> {d.sobretasas_detectadas.join(', ')}
                  </p>
                ))}
              </div>
            )}

            {valoracionDetail?.alertas_auditoria?.length > 0 && (
              <div style={{ marginBottom: '16px', background: '#fee2e2', border: '1px solid #ef4444', borderRadius: '6px', padding: '10px 14px' }}>
                <p style={{ fontWeight: 'bold', margin: '0 0 6px', fontSize: '11px', color: '#991b1b' }}>ALERTAS DE AUDITORÍA</p>
                {valoracionDetail.alertas_auditoria.map((a, i) => (
                  <p key={i} style={{ margin: '2px 0', fontSize: '10px', color: '#991b1b' }}>{a}</p>
                ))}
              </div>
            )}
          </>
        )}

        <div style={{ marginTop: '30px', borderTop: '2px solid #1e40af', paddingTop: '10px', fontSize: '9px', color: '#999', textAlign: 'center' }}>
          Documento ID: {docIdForPdf || '—'} &nbsp;|&nbsp; WebCheck — Prevalidación Aduanera &nbsp;|&nbsp; {new Date().toISOString()}
        </div>
      </div>
    </div>
  );
};

export default InvoiceDetail;

import { useState, useEffect, useCallback } from 'react';
// Panel principal del agente con subida de facturas y metricas del dia
import { useNavigate } from 'react-router-dom';
import { UploadCloud, AlertTriangle, AlertCircle, Zap, ExternalLink, Clock, Shield, FileText, Briefcase, Calendar, Activity, CheckCircle2, Hourglass } from 'lucide-react';
import { CpuArchitecture } from '../componentes/interfaz/CpuArchitecture';
import Modal from '../componentes/interfaz/Modal';
import { API_BASE, peticionPost, obtenerToken } from '../servicios/api';
import { MAX_FILE_SIZE_BYTES } from '../constantes';

import styles from '../../css/PanelPrincipal.module.css';

function DataSection({ title, children }) {
  return (
    <div className={styles.dataSection}>
      <h4 className={styles.dataSectionTitle}>{title}</h4>
      <div className={styles.dataGrid}>
        {children}
      </div>
    </div>
  );
}

const RIESGO_CONFIG = {
  alto: { label: 'Riesgo Alto', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: 'XCircle' },
  medio: { label: 'Riesgo Medio', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: 'AlertTriangle' },
  bajo: { label: 'Riesgo Bajo', color: '#10b981', bg: 'rgba(16,185,129,0.1)', icon: 'CheckCircle' },
};

function RiesgoBanner({ riesgo, observaciones }) {
  const cfg = RIESGO_CONFIG[riesgo] || RIESGO_CONFIG.medio;
  return (
    <div className={styles.riesgoBanner} style={{ background: cfg.bg, border: `1px solid ${cfg.color}30` }}>
      <div className={styles.riesgoIcon} style={{ color: cfg.color }}>
        <AlertTriangle size={18} />
      </div>
      <div>
        <strong className={styles.riesgoLabel} style={{ color: cfg.color }}>{cfg.label}</strong>
        {observaciones && (
          <ul className={styles.riesgoList}>
            {observaciones.split('|').map((motivo, i) => (
              <li key={i}>{motivo.trim()}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function InputField({ label, value, colorClass, editable, onChange }) {
  return (
    <div className={styles.inputField}>
      <label>{label}</label>
      <input
        readOnly={!editable}
        className="form-input"
        style={{
          backgroundColor: colorClass ? 'var(--primary-light)' : (editable ? 'rgba(0,0,0,0.01)' : 'rgba(0,0,0,0.02)'),
          borderColor: colorClass ? 'var(--primary)' : 'var(--card-border)',
          boxShadow: editable ? 'inset 0 0 0 1px rgba(0,0,0,0.03)' : 'none',
          color: colorClass ? 'var(--primary)' : 'inherit',
          fontWeight: colorClass ? '600' : 'normal',
          cursor: editable ? 'text' : 'default',
        }}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [autoSave, setAutoSave] = useState(true);
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [editedData, setEditedData] = useState(null);
  const [, setCamposMod] = useState({});
  const [, setOversizeError] = useState(null);
  const [serverError, setServerError] = useState(null);

  const [metrics, setMetrics] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [pendientes, setPendientes] = useState(null);
  const [vencimientos, setVencimientos] = useState(null);
  const [activeTab, setActiveTab] = useState('terminal');
  const [docLimit, setDocLimit] = useState({ usados: 0, limite: 20, proxima_recarga: null, puede_subir: true, motivo_bloqueo: null });
  const [rateLimitError, setRateLimitError] = useState(false);
  const [reintentando, setReintentando] = useState(false);
  const [reintentosRestantes, setReintentosRestantes] = useState(0);
  const [, setPendingFile] = useState(null);
  const [countdown, setCountdown] = useState(null);

  const cargarLimite = useCallback(() => {
    const token = obtenerToken();
    fetch(`${API_BASE}/api/documentos/limite`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        setDocLimit(data);
      })
      .catch(() => {
        setDocLimit(prev => ({ ...prev }));
      });
  }, []);

  useEffect(() => {
    if (!docLimit.proxima_recarga) return;
    const calcular = () => {
      const diff = new Date(docLimit.proxima_recarga) - new Date();
      if (diff <= 0) {
        setCountdown(null);
        cargarLimite();
        return;
      }
      const min = Math.floor(diff / 60000);
      const seg = Math.floor((diff % 60000) / 1000);
      setCountdown(`${min}:${String(seg).padStart(2, '0')}`);
    };
    calcular();
    const intervalo = setInterval(calcular, 1000);
    return () => clearInterval(intervalo);
  }, [docLimit.proxima_recarga, cargarLimite]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    cargarLimite();

    const intervaloLimite = setInterval(() => {
      cargarLimite();
    }, 30000);

    const alEnfocar = () => {
      cargarLimite();
    };
    window.addEventListener('focus', alEnfocar);

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const opts = { headers: { 'Authorization': `Bearer ${token}` }, signal };

    fetch(`${API_BASE}/api/documentos/metrics`, opts)
      .then(r => r.json())
      .then(data => setMetrics(data))
      .catch(() => {});
    fetch(`${API_BASE}/api/documentos/alertas`, opts)
      .then(r => r.json())
      .then(data => setAlerts(data))
      .catch(() => {});
    fetch(`${API_BASE}/api/documentos/pendientes`, opts)
      .then(r => r.json())
      .then(data => setPendientes(data))
      .catch(() => {});
    fetch(`${API_BASE}/api/documentos/vencimientos`, opts)
      .then(r => r.json())
      .then(data => setVencimientos(data))
      .catch(() => {});

    return () => {
      controller.abort();
      clearInterval(intervaloLimite);
      window.removeEventListener('focus', alEnfocar);
    };
  }, [cargarLimite]);

  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (processing) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };
  
  const handleFileInput = (e) => {
    if (processing) return;
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleFileUpload = (uploadedFile) => {
    if (uploadedFile.type !== "application/pdf") {
      setServerError("Por favor sube un archivo PDF válido.");
      return;
    }

    if (uploadedFile.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (uploadedFile.size / (1024 * 1024)).toFixed(2);
      setOversizeError(sizeMB);
      window.dispatchEvent(new CustomEvent('addSystemNotification', {
        detail: {
          title: 'Documento Rechazado',
          message: `El archivo ${uploadedFile.name} excede el límite (4MB).`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      }));
      return;
    }

    if (!docLimit.puede_subir) {
      setPendingFile(uploadedFile);
      setRateLimitError(true);
      cargarLimite();
      return;
    }

    setFile(uploadedFile);

    const url = URL.createObjectURL(uploadedFile);
    setFileUrl(url);

    setProcessing(true);
    setExtractedData(null);
    setEditedData(null);
    setCamposMod({});

    const formData = new FormData();
    formData.append('file', uploadedFile);

    const escanearConReintento = () => {
      const MAX_INTENTOS = 3;
      peticionPost(`/api/facturas/scan?guardar=${autoSave}`, formData)
        .then((data) => {
          setExtractedData(data);
          setEditedData(JSON.parse(JSON.stringify(data)));
          setCamposMod({});
          setProcessing(false);
          setReintentando(false);
          setReintentosRestantes(0);
          if (data.id) cargarLimite();
        })
        .catch((err) => {
          const msg = err.message || '';
          const esLimiteDocumentos = msg.toLowerCase().includes('documentos procesados');

          if (esLimiteDocumentos) {
            cargarLimite();
            setPendingFile(uploadedFile);
            setRateLimitError(true);
          } else {
            setServerError(msg || 'Error al procesar el documento. Verifica que el PDF sea legible y vuelve a intentar.');
          }
          setReintentando(false);
          setReintentosRestantes(0);
          handleReset();
          setProcessing(false);
          if (!esLimiteDocumentos) cargarLimite();
        });
    };

    escanearConReintento();
  };

  const handleReset = async () => {
    if (extractedData?.id) {
      try {
        const token = obtenerToken();
        await fetch(`${API_BASE}/api/documentos/${extractedData.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (e) {
        console.error('Error al borrar documento:', e);
      }
    }
    setFile(null);
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFileUrl(null);
    setExtractedData(null);
    setEditedData(null);
    setCamposMod({});
    setPendingFile(null);
    cargarLimite();
  };

  const updateField = useCallback((path, value) => {
    setEditedData(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let cur = next;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!cur[keys[i]]) cur[keys[i]] = {};
        cur = cur[keys[i]];
      }
      cur[keys[keys.length - 1]] = value;
      return next;
    });
    setCamposMod(p => ({ ...p, [path]: true }));
  }, []);

  return (
    <div className={`fade-in ${styles.pageContainer}`}>
      <Modal
        abierto={!!serverError}
        titulo="Error de Extracción"
        mensaje={serverError}
        variante="error"
        onCerrar={() => setServerError(null)}
        textoBoton="Cerrar y Reintentar"
        icono={AlertCircle}
      />

      <Modal
        abierto={rateLimitError}
        titulo="Límite por Hora Alcanzado"
        mensaje={`Has procesado el máximo de ${docLimit.limite} documentos en la última hora. Por favor, espera antes de subir más facturas.${countdown ? ` Podrás volver a subir en ${countdown}.` : ''}`}
        variante="advertencia"
        onCerrar={() => setRateLimitError(false)}
        textoBoton="Entendido"
        colorTextoBoton="#000"
        icono={Zap}
      />

      <header className={styles.headerSection}>
        <div className={styles.headerLeft}>
          <div className={styles.tabGroup}>
            <button onClick={() => setActiveTab('terminal')}
              className={`${styles.tabBtn} ${activeTab === 'terminal' ? styles.tabBtnActive : styles.tabBtnInactive}`}>
              <UploadCloud size={16} /> Terminal OCR
            </button>
            <button onClick={() => setActiveTab('monitoreo')}
              className={`${styles.tabBtn} ${activeTab === 'monitoreo' ? styles.tabBtnActive : styles.tabBtnInactive}`}>
              <Briefcase size={16} /> Monitoreo y Alertas
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
          <div className={`${styles.rateBadge} ${docLimit.puede_subir ? styles.rateBadgeReady : styles.rateBadgeBlocked}`}>
            <div className={`${styles.rateIconBox} ${docLimit.puede_subir ? styles.rateIconReady : styles.rateIconBlocked}`}>
              <Zap size={22} color={docLimit.puede_subir ? 'var(--green)' : 'var(--red)'} />
            </div>
            <div className={styles.rateInfo}>
              <span className={styles.rateStatus} style={{ color: docLimit.puede_subir ? 'var(--green)' : 'var(--red)' }}>
                {docLimit.puede_subir ? 'Listo para escanear' : docLimit.motivo_bloqueo || 'No disponible'}
              </span>
              <span className={styles.rateCount} style={{ color: docLimit.puede_subir ? 'var(--green)' : 'var(--red)' }}>
                {docLimit.usados} <span className={styles.rateDivider}>/ {docLimit.limite} escaneados</span>
              </span>
              {countdown && (
                <span className={styles.rateCountdown}>
                  <Clock size={10} />
                  Recarga en {countdown}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {activeTab === 'monitoreo' && (
        <div className={`fade-in ${styles.monitoreoSection}`}>

          {metrics && (
            <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
              <div className={styles.panelHeader}>
                <Activity size={16} color="var(--primary)" />
                <span className={styles.panelTitle}>Resumen de actividad</span>
              </div>
              <div className={styles.panelBody}>
                <div className={styles.metricsGrid}>
                  {[
                    { label: 'Total documentos', value: metrics.total_documentos, color: 'var(--primary)', icon: FileText },
                    { label: 'Pendientes', value: metrics.pendientes, color: 'var(--yellow)', icon: Clock },
                    { label: 'Aprobados este mes', value: metrics.aprobados_este_mes, color: 'var(--green)', icon: CheckCircle2 },
                    { label: 'Riesgo alto', value: `${metrics.tasa_riesgo_alto}%`, color: 'var(--red)', icon: AlertTriangle },
                    { label: 'Pendientes Admin', value: metrics.pendientes_admin, color: 'var(--accent)', icon: Shield },
                  ].map((m, i) => {
                    const Icon = m.icon;
                    return (
                      <div key={i} className={styles.metricCard} style={{ borderTopColor: m.color }}>
                        <div className={styles.metricHeader}>
                          <span className={styles.metricLabel}>{m.label}</span>
                          <Icon size={14} color={m.color} className={styles.metricIcon} />
                        </div>
                        <span className={styles.metricValue} style={{ color: m.color }}>{m.value}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {alerts.length > 0 && (
            <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
              <div className={`${styles.panelHeader} ${alerts.some(a => a.severidad === 'alta') ? styles.panelHeaderAlert : styles.panelHeaderWarning}`}>
                <AlertCircle size={16} color={alerts.some(a => a.severidad === 'alta') ? 'var(--red)' : 'var(--yellow)'} />
                <span className={styles.panelTitle}>Alertas activas</span>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 700, padding: '2px 10px', borderRadius: '20px',
                  background: alerts.some(a => a.severidad === 'alta') ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                  color: alerts.some(a => a.severidad === 'alta') ? 'var(--red)' : 'var(--yellow)'
                }}>
                  {alerts.length}
                </span>
              </div>
              <div className={styles.alertList}>
                {alerts.map((a, i) => {
                  const cfg = a.severidad === 'alta'
                    ? { color: 'var(--red)', bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.2)', badge: 'Alta', badgeBg: 'rgba(239,68,68,0.12)' }
                    : { color: 'var(--yellow)', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.18)', badge: 'Media', badgeBg: 'rgba(245,158,11,0.12)' };
                  const Icon = a.tipo === 'estancado' ? Hourglass : AlertCircle;
                  return (
                    <div key={i} onClick={() => navigate(`/factura/${a.documento_id}/editar`)} className={styles.alertItem}
                      style={{ border: `1px solid ${cfg.border}`, background: cfg.bg }}>
                      <div className={styles.alertBadgeBox} style={{ background: cfg.badgeBg }}>
                        <Icon size={16} color={cfg.color} />
                      </div>
                      <div className={styles.alertContent}>
                        <div className={styles.alertMsg}>{a.mensaje}</div>
                        <div className={styles.alertMeta}>
                          <span className={styles.alertBadgeLabel} style={{ background: cfg.badgeBg, color: cfg.color }}>{cfg.badge}</span>
                          {a.dias_detenido > 0 && (
                            <span className={styles.alertDays} style={{ color: cfg.color }}>
                              {a.dias_detenido}d estancado
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className={styles.infoGrid}>

            {pendientes && (
              <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
                <div className={styles.panelHeader}>
                  <Briefcase size={16} color="var(--primary)" />
                  <span className={styles.panelTitle}>Pendientes por Atender</span>
                </div>
                <div className={styles.pendientesList}>
                  {[
                    { label: 'Sin clasificar', data: pendientes.sin_clasificar, icon: FileText, color: 'var(--yellow)', desc: 'Documentos sin categoría asignada' },
                    { label: 'V°B° pendientes', data: pendientes.vbb_pendientes, icon: Shield, color: 'var(--accent)', desc: 'Esperando visación regulatoria' },
                  ].map((cat) => {
                    const Icon = cat.icon;
                    const count = cat.data?.length || 0;
                    return (
                      <div key={cat.label} className={styles.pendientesCard} style={{ borderTopColor: cat.color }}>
                        <div className={styles.pendientesInner}>
                          <div className={styles.pendientesIconBox} style={{ background: `${cat.color}12` }}>
                            <Icon size={16} color={cat.color} />
                          </div>
                          <div className={styles.pendientesBody}>
                            <div className={styles.pendientesHeader}>
                              <span className={styles.pendientesTitle}>{cat.label}</span>
                              <span className={styles.pendientesCount} style={{ color: count > 0 ? cat.color : 'var(--text-muted)' }}>{count}</span>
                            </div>
                            <span className={styles.pendientesDesc}>{cat.desc}</span>
                            {count > 0 && (
                              <div className={styles.pendientesItems}>
                                {cat.data.slice(0, 4).map((d) => (
                                  <div key={d.id} onClick={() => navigate(`/factura/${d.id}/editar`)} className={styles.pendientesItem}>
                                    <span className={styles.pendientesItemName}>{d.nombre_archivo}</span>
                                    <ExternalLink size={10} className={styles.pendientesItemIcon} />
                                  </div>
                                ))}
                                {cat.data.length > 4 && (
                                  <span className={styles.pendientesMore}>+{cat.data.length - 4} m&aacute;s</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {vencimientos && (
              <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
                <div className={`${styles.panelHeader} ${styles.panelHeaderRed}`}>
                  <Calendar size={16} color="var(--red)" />
                  <span className={styles.panelTitle}>Vencimientos y Alertas de Plazo</span>
                </div>
                <div className={styles.vencimientosList}>
                  {(() => {
                    const data = vencimientos.pendientes_admin || [];
                    const count = data.length;
                    if (count === 0) {
                      return (
                        <div className={styles.vencimientosEmpty}>Sin documentos con vencimiento próximo</div>
                      );
                    }
                    return (
                      <>
                        <div className={styles.vencimientosHeader}>
                          <span className={styles.vencimientosTitle}>Pendientes Admin ({count})</span>
                        </div>
                        {data.slice(0, 5).map((item, i) => {
                          const days = item.dias_espera || 0;
                          const urgency = days >= 7 ? 'var(--red)' : days >= 3 ? 'var(--yellow)' : 'var(--text-muted)';
                          const urgencyBg = days >= 7 ? 'rgba(239,68,68,0.08)' : days >= 3 ? 'rgba(245,158,11,0.08)' : 'rgba(0,0,0,0.02)';
                          return (
                            <div key={i} onClick={() => item.documento_id && navigate(`/factura/${item.documento_id}/editar`)} className={styles.vencimientosItem}
                              style={{ background: urgencyBg }}>
                              <div className={styles.vencimientosIconBox} style={{ background: `${urgency}15` }}>
                                <Hourglass size={14} color={urgency} />
                              </div>
                              <div className={styles.vencimientosItemBody}>
                                <div className={styles.vencimientosItemName}>{item.nombre_archivo}</div>
                              </div>
                              <div className={styles.vencimientosItemDays} style={{ background: `${urgency}18`, color: urgency }}>
                                {days > 0 ? `${days}d` : 'Hoy'}
                              </div>
                            </div>
                          );
                        })}
                        {data.length > 5 && (
                          <span className={styles.vencimientosMore}>+{data.length - 5} m&aacute;s</span>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

          </div>

        </div>
      )}

      {activeTab === 'terminal' && (
        <div className={`fade-in ${styles.terminalLayout}`}>

        <div className={`glass-panel ${styles.terminalPanel}`}>
          {!fileUrl ? (
            <div className={styles.dropZoneWrapper}>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`${styles.dropZone} ${isDragging ? styles.dropZoneDragging : styles.dropZoneDisabled}`}
            >
              {!docLimit.puede_subir ? (
                <div className={styles.dropZoneContent}>
                  <UploadCloud size={56} color="var(--red)" className={styles.dropIcon} style={{ opacity: 0.6 }} />
                  <h3 className={styles.dropBlockedTitle}>
                    {docLimit.motivo_bloqueo || 'Servicio no disponible, espera un momento'}
                  </h3>
                  <p className={styles.dropDesc}>
                    {docLimit.motivo_bloqueo === 'Limite de documentos por hora alcanzado'
                      ? 'Has procesado el máximo de documentos permitidos por hora. Por favor, espera a la próxima recarga.'
                      : 'La plataforma de Inteligencia Artificial alcanzó el límite de consultas por alta demanda o no está disponible en este momento.'}
                  </p>
                </div>
              ) : (
                <>
                  <input type="file" accept=".pdf" onChange={handleFileInput} disabled={processing} className={styles.dropZoneInput} style={{ cursor: processing ? 'not-allowed' : 'pointer' }} />
                  <div className={styles.dropZoneContent}>
                    <UploadCloud size={56} color="var(--primary)" className={styles.dropIcon} style={{ opacity: 0.9 }} />
                    <h3 className={styles.dropTitle}>Arrastra tu Factura Comercial PDF</h3>
                    <p className={styles.dropDesc}>
                      Suelta el documento aqu&iacute; para montarlo en el visor e iniciar la lectura OCR autom&aacute;tica.
                    </p>

                    <div className={styles.toggleRow}>
                      <label className={styles.toggleSwitch}>
                        <input type="checkbox" checked={autoSave} onChange={() => setAutoSave(!autoSave)} className={styles.toggleInput} />
                        <span className={styles.toggleSlider} style={{ backgroundColor: autoSave ? 'var(--primary)' : '#ccc' }}>
                          <span className={styles.toggleKnob} style={{ left: autoSave ? '22px' : '4px' }} />
                        </span>
                      </label>
                      <span className={styles.toggleLabel} style={{ color: autoSave ? 'var(--primary)' : 'var(--text-muted)' }}>
                        {autoSave ? 'Guardar en historial' : 'No guardar (Solo previsualización)'}
                      </span>
                    </div>

                    <button className="btn btn-primary" style={{ marginTop: '24px' }}>Explorar Archivos</button>
                  </div>
                </>
              )}
            </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div className={styles.pdfHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className={styles.pdfTitle}>Vista Previa Estricta (PDF Original)</span>
                </div>
                <button onClick={handleReset} className="btn btn-secondary">Cambiar Archivo</button>
              </div>
              <object data={fileUrl} type="application/pdf" width="100%" height="100%" style={{ flex: 1, backgroundColor: '#525659' }}>
                <p style={{ textAlign: 'center', padding: '40px' }}>Tu navegador no soporta visualización interna de PDFs. <a href={fileUrl} target="_blank" rel="noopener noreferrer">Descargar para ver.</a></p>
              </object>
            </div>
          )}
        </div>

        <div className={`glass-panel ${styles.resultsPanel}`}>
          <div className={styles.resultsHeader}>
            <h2 className={styles.resultsTitle}>Resultados de Inspecci&oacute;n</h2>
          </div>

          <div className={`${styles.resultsBody} ${processing ? styles.resultsCentered : ''}`}>
            {!file && !processing && !extractedData && (
              <div className={styles.resultsEmpty}>
                <AlertTriangle size={40} style={{ opacity: 0.3, marginBottom: '16px' }} />
                <p>Esperando documento para procesar las reglas de inteligencia aduanera.</p>
              </div>
            )}

            {processing && (
              <div className={styles.processingContainer}>
                <div className={styles.cpuContainer}>
                  <CpuArchitecture text="ADVA" />
                </div>
                <h3 className={styles.processingTitle}>
                  {reintentando ? `Reintentando... (${reintentosRestantes} restantes)` : 'Escaneando y Validando...'}
                </h3>
                {reintentando && (
                  <p className={styles.processingSub}>
                    La API de inteligencia artificial esta temporalmente congestionada. Reintentando automaticamente...
                  </p>
                )}
              </div>
            )}

            {extractedData && (
              <div className={styles.resultsContent}>
                <RiesgoBanner riesgo={extractedData.riesgo} observaciones={extractedData.observaciones} />

                {extractedData.validacion_error && (
                  <div className={styles.validationError}>
                    <AlertCircle size={20} />
                    <strong>Inconsistencia detectada:</strong> {extractedData.mensaje_error}
                  </div>
                )}

                {extractedData.confianza && extractedData.confianza.nivel !== 'ALTA' && (() => {
                  const c = extractedData.confianza;
                  const esBaja = c.nivel === 'BAJA';
                  return (
                    <div className={styles.confidenceBox} style={{
                      background: esBaja ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
                      border: `1px solid ${esBaja ? 'var(--red)' : 'var(--yellow)'}30`,
                    }}>
                      <div className={styles.confidenceHeader}>
                        {esBaja ? <AlertCircle size={14} color="var(--red)" /> : <AlertTriangle size={14} color="var(--yellow)" />}
                        <strong className={styles.confidenceLabel}>Extracción con confianza {c.nivel}</strong>
                        <span className={styles.confidenceAvg}>(promedio: {c.promedio}%)</span>
                      </div>
                      {c.campos_criticos?.length > 0 && (
                        <div className={styles.confidenceFields}>
                          <strong>Campos con baja precisión:</strong>
                          <ul className={styles.confidenceFieldList}>
                            {c.campos_criticos
                              .map(k => ({ campo: k.campo ?? k, puntaje: k.puntaje ?? (c.detalle?.[k.campo ?? k] ?? 0) }))
                              .sort((a, b) => a.puntaje - b.puntaje)
                              .map(({ campo, puntaje }) => {
                                const LABELS = {
                                  numero_factura: 'N° de Factura', monto_total: 'Monto Total',
                                  monto_subtotal: 'Subtotal', monto_flete: 'Flete', monto_seguro: 'Seguro',
                                  monto_otros_gastos: 'Otros Gastos', incoterm: 'Incoterm', moneda: 'Moneda',
                                  fecha_emision: 'Fecha de Emisión', pais_origen: 'País de Origen',
                                  emisor_nombre: 'Exportador', emisor_tax_id: 'RUT Exportador',
                                  receptor_nombre: 'Importador', receptor_tax_id: 'RUT Importador',
                                  cuadratura_items: 'Cuadratura Items vs Total',
                                };
                                const m = campo.match(/^detalle_(\d+)_(cantidad|precio|descripcion)$/);
                                const label = m
                                  ? `Item #${parseInt(m[1]) + 1} - ${{ cantidad: 'Cantidad', precio: 'Precio Unit.', descripcion: 'Descripción' }[m[2]]}`
                                  : (LABELS[campo] || campo.replace(/_/g, ' '));
                                return <li key={campo} style={{ color: esBaja ? 'var(--red)' : 'var(--yellow)', fontWeight: 500 }}>{label} <span style={{ opacity: 0.6 }}>({puntaje}%)</span></li>;
                              })}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {(() => {
                  const c = extractedData.cuadratura_items;
                  if (!c || !c.ejecutado || c.coincide) return null;
                  return (
                    <div className={styles.cuadraturaBox} style={{
                      background: c.estado === 'FAIL' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
                      border: `1px solid ${c.estado === 'FAIL' ? 'var(--red)' : 'var(--yellow)'}30`,
                    }}>
                      <div className={styles.cuadraturaHeader}>
                        <AlertCircle size={14} color={c.estado === 'FAIL' ? 'var(--red)' : 'var(--yellow)'} />
                        <strong style={{ color: 'var(--text-main)' }}>Cuadratura de &Iacute;tems</strong>
                      </div>
                      <div className={styles.cuadraturaDetail}>
                        Items (<strong style={{ color: 'var(--text-main)' }}>${c.suma_items.toFixed(2)}</strong>)
                        {' '}+ Flete (<strong>${c.flete.toFixed(2)}</strong>)
                        {' '}+ Seguro (<strong>${c.seguro.toFixed(2)}</strong>)
                        {' '}+ Otros (<strong>${c.otros.toFixed(2)}</strong>)
                        {' '}= <strong style={{ color: 'var(--text-main)' }}>${c.suma_con_gastos.toFixed(2)}</strong>
                        {' '}vs Total CIF <strong style={{ color: 'var(--text-main)' }}>${(c.total_cif_declarado || 0).toFixed(2)}</strong>.
                        {' '}Diferencia: <strong style={{ color: c.estado === 'FAIL' ? 'var(--red)' : 'var(--yellow)' }}>${c.diferencia.toFixed(2)} ({c.diferencia_porcentaje.toFixed(1)}%)</strong>.
                      </div>
                      <div className={styles.cuadraturaItems}>
                        {c.items.map((it, i) => (
                          <span key={i}>
                            #{it.indice + 1}: {it.cantidad} × ${it.precio_unitario} = <strong>${it.subtotal_calculado.toFixed(2)}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <DataSection title="Relaci&oacute;n Comercial (Origen/Destino)">
                  <InputField label="Remitente (Emisor)" value={`${(editedData?.remitente?.nombre ?? extractedData.remitente.nombre ?? '')} | ${(editedData?.remitente?.documento ?? extractedData.remitente.documento ?? '')}`}  />
                  <InputField label="Dir. Remitente" value={editedData?.remitente?.direccion ?? extractedData.remitente.direccion ?? ''} editable onChange={e => updateField('remitente.direccion', e.target.value)} />
                  <InputField label="Destinatario (Receptor)" value={`${(editedData?.destinatario?.nombre ?? extractedData.destinatario.nombre ?? '')} | ${(editedData?.destinatario?.documento ?? extractedData.destinatario.documento ?? '')}`}  />
                  <InputField label="Dir. Destinatario" value={editedData?.destinatario?.direccion ?? extractedData.destinatario.direccion ?? ''} editable onChange={e => updateField('destinatario.direccion', e.target.value)} />
                </DataSection>

                <DataSection title="Trazabilidad y Documento">
                  <InputField label="N&ordm; de Factura" value={editedData?.factura?.numero ?? extractedData.factura.numero ?? ''}  editable onChange={e => updateField('factura.numero', e.target.value)} />
                  <InputField label="Fecha Emisi&oacute;n" value={editedData?.factura?.fecha ?? extractedData.factura.fecha ?? ''}  editable onChange={e => updateField('factura.fecha', e.target.value)} />
                  <InputField label="Incoterm Pactado" value={editedData?.factura?.incoterm ?? extractedData.factura.incoterm ?? ''}  editable onChange={e => updateField('factura.incoterm', e.target.value)} />
                  <InputField label="Pa&iacute;s de Origen" value={editedData?.factura?.pais_origen ?? extractedData.factura.pais_origen ?? ''}  editable onChange={e => updateField('factura.pais_origen', e.target.value)} />
                  <InputField label="Pa&iacute;s Manifiesto" value={editedData?.transporte?.paisOrigen ?? extractedData.transporte.paisOrigen ?? ''} editable onChange={e => updateField('transporte.paisOrigen', e.target.value)} />
                  <InputField label="Tipo de Transporte" value={editedData?.transporte?.metodo ?? extractedData.transporte.metodo ?? ''} editable onChange={e => updateField('transporte.metodo', e.target.value)} />
                </DataSection>

                <DataSection title="Desglose Financiero">
                  <InputField label={`Subtotal (${extractedData.factura.moneda ?? ''})`} value={editedData?.economia?.subtotal ?? extractedData.economia.subtotal}  editable onChange={e => updateField('economia.subtotal', e.target.value)} />
                  <InputField label={`Flete / Env&iacute;o (${extractedData.factura.moneda ?? ''})`} value={editedData?.economia?.envio ?? extractedData.economia.envio}  editable onChange={e => updateField('economia.envio', e.target.value)} />
                  <InputField label={`Seguro (${extractedData.factura.moneda ?? ''})`} value={editedData?.economia?.seguro ?? extractedData.economia.seguro}  editable onChange={e => updateField('economia.seguro', e.target.value)} />
                  <InputField label={`Otros Gastos (${extractedData.factura.moneda ?? ''})`} value={editedData?.economia?.otros ?? extractedData.economia.otros} editable onChange={e => updateField('economia.otros', e.target.value)} />
                  <InputField label={`Gran Total CIF (${extractedData.factura.moneda ?? ''})`} value={editedData?.economia?.total ?? extractedData.economia.total} colorClass  editable onChange={e => updateField('economia.total', e.target.value)} />
                </DataSection>

                <DataSection title="Consistencia Log&iacute;stica">
                  <InputField label={`Peso Bruto (${extractedData.logistica.unidad_peso ?? ''})`} value={editedData?.logistica?.peso_bruto ?? extractedData.logistica.peso_bruto} editable onChange={e => updateField('logistica.peso_bruto', e.target.value)} />
                  <InputField label={`Peso Neto (${extractedData.logistica.unidad_peso ?? ''})`} value={editedData?.logistica?.peso_neto ?? extractedData.logistica.peso_neto} editable onChange={e => updateField('logistica.peso_neto', e.target.value)} />
                </DataSection>

                <DataSection title="Resoluci&oacute;n Aduanera (Sugerida)">
                  <InputField label="Clasificaci&oacute;n Arancelaria Predominante (HS Code)" value={editedData?.partidaPrincipal ?? extractedData.partidaPrincipal ?? ''} colorClass editable onChange={e => updateField('partidaPrincipal', e.target.value)} />
                </DataSection>

                <button
                  onClick={() => navigate(`/factura/${extractedData.id}/editar`, { state: { fullData: extractedData, fileUrl, prevalidacion: extractedData.prevalidacion } })}
                  className={`btn btn-primary ${styles.navigateBtn}`}
                >
                  <ExternalLink size={16} /> Abrir en Vista Detallada
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

export default Dashboard;
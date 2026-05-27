import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, CheckCircle, AlertTriangle, AlertCircle, Zap, ExternalLink, Clock, Shield, X, ChevronDown, ChevronUp, FileText, DollarSign, Package, Globe, Truck, Briefcase, Calendar } from 'lucide-react';
import { CpuArchitecture } from '../components/ui/CpuArchitecture';
import Modal from '../components/ui/Modal';
import { API_BASE, peticionPost, obtenerToken } from '../services/api';
import { MAX_RPM, MAX_FILE_SIZE_BYTES } from '../constants';


// Componente que renderiza una sección de datos con grid de dos columnas
function DataSection({ title, children }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '10px', color: 'var(--text-main)', letterSpacing: '-0.01em' }}>{title}</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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

// Componente que muestra un banner con el nivel de riesgo del documento
function RiesgoBanner({ riesgo, observaciones }) {
  const cfg = RIESGO_CONFIG[riesgo] || RIESGO_CONFIG.medio;
  return (
    <div style={{ padding: '12px 16px', borderRadius: '12px', marginBottom: '20px', background: cfg.bg, border: `1px solid ${cfg.color}30`, display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
      <div style={{ color: cfg.color, flexShrink: 0, marginTop: '2px' }}>
        <AlertTriangle size={18} />
      </div>
      <div>
        <strong style={{ color: cfg.color, fontSize: '0.85rem' }}>{cfg.label}</strong>
        {observaciones && <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{observaciones}</p>}
      </div>
    </div>
  );
}

// Componente de campo de entrada reutilizable con estilo condicional
function InputField({ label, value, colorClass, editable, onChange }) {
  return (
    <div>
      <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
        {label}
      </label>
      <input
        readOnly={!editable}
        className="form-input"
        style={{
          padding: '8px 12px', fontSize: '0.9rem',
          backgroundColor: colorClass ? 'var(--primary-light)' : (editable ? 'rgba(0,0,0,0.01)' : 'rgba(0,0,0,0.02)'),
          borderColor: colorClass ? 'var(--primary)' : (editable ? 'var(--card-border)' : 'var(--card-border)'),
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

// Componente principal: panel de inicio con carga de PDF, métricas y monitoreo
const Dashboard = () => {
  const navigate = useNavigate();
  const [autoSave, setAutoSave] = useState(true);
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [editedData, setEditedData] = useState(null);
  const [camposMod, setCamposMod] = useState({});
  const [oversizeError, setOversizeError] = useState(null);
  const [serverError, setServerError] = useState(null);

  const [metrics, setMetrics] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [monitoreo, setMonitoreo] = useState(null);
  const [pendientes, setPendientes] = useState(null);
  const [vencimientos, setVencimientos] = useState(null);
  const [kanbanOpen, setKanbanOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('terminal');
  const [aiQuota, setAiQuota] = useState(() => {
    const saved = sessionStorage.getItem('aiQuota');
    return saved !== null ? parseInt(saved, 10) : MAX_RPM;
  });
  const [rateLimitError, setRateLimitError] = useState(false);

  // Persiste la cuota de IA en sessionStorage
  useEffect(() => {
    sessionStorage.setItem('aiQuota', aiQuota);
  }, [aiQuota]);

  // Recarga la cuota de IA cada minuto
  useEffect(() => {
    const timer = setInterval(() => {
      setAiQuota(MAX_RPM);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Fetch inicial de métricas, alertas, monitoreo, pendientes y vencimientos
  useEffect(() => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    fetch(`${API_BASE}/api/documentos/metrics`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => setMetrics(data))
      .catch(() => {});
    fetch(`${API_BASE}/api/documentos/alertas`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => setAlerts(data))
      .catch(() => {});
    fetch(`${API_BASE}/api/documentos/monitoreo`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => setMonitoreo(data))
      .catch(() => {});
    fetch(`${API_BASE}/api/documentos/pendientes`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => setPendientes(data))
      .catch(() => {});
    fetch(`${API_BASE}/api/documentos/vencimientos`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => setVencimientos(data))
      .catch(() => {});
  }, []);

  // Limpia la URL del objeto PDF al desmontar
  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  // Maneja el evento drag over en la zona de carga
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  // Maneja el evento drag leave en la zona de carga
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  // Maneja el evento drop para procesar el archivo soltado
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };
  // Maneja la selección de archivo desde el input
  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  // Valida, sube el archivo PDF y envía a scanning OCR
  const handleFileUpload = (uploadedFile) => {
    if (uploadedFile.type !== "application/pdf") {
      alert("Por favor sube un archivo PDF válido.");
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

    if (aiQuota <= 0) {
      setRateLimitError(true);
      return;
    }

    setFile(uploadedFile);
    setAiQuota(prev => prev - 1);

    const url = URL.createObjectURL(uploadedFile);
    setFileUrl(url);

    setProcessing(true);
    setExtractedData(null);
    setEditedData(null);
    setCamposMod({});

    const formData = new FormData();
    formData.append('file', uploadedFile);

    peticionPost(`/api/facturas/scan?guardar=${autoSave}`, formData)
      .then((data) => {
        setExtractedData(data);
        setEditedData(JSON.parse(JSON.stringify(data)));
        setCamposMod({});
      })
      .catch((err) => {
        if (err.message && err.message.includes('429')) {
          setAiQuota(0);
          setRateLimitError(true);
        } else {
          setServerError(err.message || 'Error desconocido al contactar con la API.');
        }
        handleReset();
      })
      .finally(() => {
        setProcessing(false);
      });
  };

  // Reinicia el estado eliminando el documento temporal en backend
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
  };

  // Actualiza un campo anidado en editedData por ruta de puntos
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
    <div className="fade-in" style={{ maxWidth: '1200px', margin: '0 auto' }}>
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
        abierto={!!oversizeError}
        titulo="Documento Demasiado Pesado"
        mensaje={`El archivo pesa ${oversizeError} MB. Para mantener los tiempos de respuesta, el sistema requiere PDFs de máximo 4 MB. Por favor, comprímelo y vuelve a intentarlo.`}
        variante="advertencia"
        onCerrar={() => setOversizeError(null)}
        textoBoton="Entendido"
        colorTextoBoton="#000"
        icono={AlertTriangle}
      />

      <Modal
        abierto={rateLimitError}
        titulo="Límite Operativo Alcanzado"
        mensaje="Has alcanzado el límite de protección del sistema (15 peticiones por minuto). Por favor, espera unos segundos a que el contador se recargue."
        variante="advertencia"
        onCerrar={() => setRateLimitError(false)}
        textoBoton="Cerrar y Esperar"
        colorTextoBoton="#000"
        icono={Zap}
      />

      <header className="dashboard-header" style={{
        marginBottom: '32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '24px',
        flexWrap: 'wrap'
      }}>
        <div style={{ flex: '1', minWidth: '300px' }}>
          
          {/* Tabs */}
          <div style={{ display: 'inline-flex', gap: '4px', marginTop: '20px', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--card-border)', padding: '4px' }}>
            <button onClick={() => setActiveTab('terminal')}
              style={{
                padding: '10px 20px', borderRadius: '10px', fontWeight: 700, fontSize: '0.85rem',
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                background: activeTab === 'terminal' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'terminal' ? 'white' : 'var(--text-muted)',
                transition: 'all 0.2s',
              }}>
              <UploadCloud size={16} /> Terminal OCR
            </button>
            <button onClick={() => setActiveTab('monitoreo')}
              style={{
                padding: '10px 20px', borderRadius: '10px', fontWeight: 700, fontSize: '0.85rem',
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                background: activeTab === 'monitoreo' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'monitoreo' ? 'white' : 'var(--text-muted)',
                transition: 'all 0.2s',
              }}>
              <Briefcase size={16} /> Monitoreo y Alertas
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
          <div style={{
            padding: '12px 20px',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            border: `1px solid ${aiQuota <= 3 ? 'var(--red)' : 'var(--card-border)'}`,
            background: aiQuota <= 3 ? 'rgba(239, 68, 68, 0.05)' : 'var(--card-bg)',
            whiteSpace: 'nowrap',
            boxShadow: 'var(--card-shadow)',
            height: 'fit-content',
            transition: 'all 0.3s'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              backgroundColor: aiQuota <= 3 ? 'rgba(239, 68, 68, 0.1)' : 'var(--primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Zap size={22} color={aiQuota <= 3 ? 'var(--red)' : 'var(--primary)'} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: '1.2' }}>
                Límite IA / Minuto
              </span>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: aiQuota <= 3 ? 'var(--red)' : 'var(--primary)', display: 'flex', alignItems: 'baseline', gap: '4px', lineHeight: '1.2' }}>
                {aiQuota} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>/ {MAX_RPM}</span>
              </span>
            </div>
          </div>
        </div>
      </header>

      {activeTab === 'monitoreo' && (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Tarjetas de métricas del agente */}
      {metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px', marginBottom: '20px' }}>
          {[
            { label: 'Total documentos', value: metrics.total_documentos, color: 'var(--primary)', bg: 'rgba(99,102,241,0.08)' },
            { label: 'Pendientes', value: metrics.pendientes, color: 'var(--yellow)', bg: 'rgba(245,158,11,0.08)' },
            { label: 'Aprobados este mes', value: metrics.aprobados_este_mes, color: 'var(--green)', bg: 'rgba(16,185,129,0.08)' },
            { label: 'Riesgo alto', value: `${metrics.tasa_riesgo_alto}%`, color: 'var(--red)', bg: 'rgba(239,68,68,0.08)' },
            { label: 'Pendientes Admin', value: metrics.pendientes_admin, color: 'var(--accent)', bg: 'rgba(139,92,246,0.08)' },
          ].map((m, i) => (
            <div key={i} style={{ padding: '18px 20px', borderRadius: '14px', border: '1px solid var(--card-border)', background: 'var(--card-bg)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>{m.label}</span>
              <span style={{ fontSize: '1.8rem', fontWeight: 800, color: m.color, lineHeight: 1 }}>{m.value}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '24px' }}>
        {/* Alertas */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <AlertCircle size={16} color={alerts.some(a => a.severidad === 'alta') ? 'var(--red)' : 'var(--yellow)'} />
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Alertas {'('}{alerts.length}{')'}
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {alerts.map((a, i) => {
              const cfg = a.severidad === 'alta'
                ? { color: 'var(--red)', bg: 'rgba(239,68,68,0.07)', border: 'rgba(239,68,68,0.25)' }
                : { color: 'var(--yellow)', bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.2)' };
              const Icon = a.tipo === 'garantia_vencida' || a.tipo === 'garantia_proxima_vencer' ? Shield
                : a.tipo === 'estancado' ? Clock : AlertCircle;
              return (
                <div key={i} style={{
                  padding: '10px 14px', borderRadius: '10px',
                  border: `1px solid ${cfg.border}`, background: cfg.bg,
                  display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
                }} onClick={() => navigate(`/documentos/${a.documento_id}`)}>
                  <Icon size={16} color={cfg.color} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-main)', fontWeight: 500, flex: 1 }}>{a.mensaje}</span>
                  <span style={{ fontSize: '0.65rem', color: cfg.color, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {a.dias_detenido > 0 ? `${a.dias_detenido}d` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pendientes accionables */}
      {pendientes && (
        <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Briefcase size={16} color="var(--primary)" /> Pendientes por Atender
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            {[
              { label: 'Sin clasificar', data: pendientes.sin_clasificar, icon: FileText, color: 'var(--yellow)' },
              { label: 'Sin despachante', data: pendientes.sin_despachante, icon: Truck, color: 'var(--orange)' },
              { label: 'V°B° pendientes', data: pendientes.vbb_pendientes, icon: Shield, color: 'var(--accent)' },
              { label: 'Sin DUA', data: pendientes.sin_dua, icon: FileText, color: 'var(--primary)' },
            ].map((cat) => {
              const Icon = cat.icon;
              const count = cat.data?.length || 0;
              return (
                <div key={cat.label} style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--card-border)', background: 'var(--card-bg)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.3px' }}>{cat.label}</span>
                    <Icon size={14} color={cat.color} />
                  </div>
                  <span style={{ fontSize: '1.4rem', fontWeight: 800, color: count > 0 ? cat.color : 'var(--text-muted)', lineHeight: 1 }}>{count}</span>
                  {count > 0 && (
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {cat.data.slice(0, 4).map((d) => (
                        <div key={d.id} onClick={() => navigate(`/factura/${d.id}/editar`)}
                          style={{ fontSize: '0.7rem', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px 6px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nombre_archivo}</span>
                        </div>
                      ))}
                      {cat.data.length > 4 && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', opacity: 0.7 }}>+{cat.data.length - 4} más</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Vencimientos / Timeline crítico */}
      {vencimientos && (
        <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={16} color="var(--red)" /> Vencimientos y Alertas de Plazo
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            {[
              {
                label: 'Garantías por vencer', data: vencimientos.garantias_proximas,
                icon: Shield, color: 'var(--red)',
                render: (g) => `${g.tipo} #${g.numero} — ${g.dias_restantes > 0 ? `${g.dias_restantes} días` : 'VENCIDA'}`,
              },
              {
                label: 'Docs estancados', data: vencimientos.docs_estancados,
                icon: Clock, color: 'var(--yellow)',
                render: (d) => `${d.nombre_archivo} — ${d.estado_aduanero} (${d.dias_estancado}d)`,
              },
              {
                label: 'Pendientes Admin', data: vencimientos.pendientes_admin,
                icon: AlertCircle, color: 'var(--accent)',
                render: (d) => `${d.nombre_archivo} — ${d.dias_espera > 0 ? `${d.dias_espera}d esperando` : 'Hoy'}`,
              },
            ].map((cat) => {
              const Icon = cat.icon;
              const count = cat.data?.length || 0;
              return (
                <div key={cat.label} style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--card-border)', background: 'var(--card-bg)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.3px' }}>{cat.label}</span>
                    <Icon size={14} color={cat.color} />
                  </div>
                  <span style={{ fontSize: '1.4rem', fontWeight: 800, color: count > 0 ? cat.color : 'var(--text-muted)', lineHeight: 1 }}>{count}</span>
                  {count > 0 && (
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {cat.data.slice(0, 3).map((item, i) => (
                        <div key={i} onClick={() => item.documento_id && navigate(`/factura/${item.documento_id}/editar`)}
                          style={{ fontSize: '0.7rem', color: 'var(--text-muted)', cursor: item.documento_id ? 'pointer' : 'default', padding: '4px 6px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.render(item)}</span>
                        </div>
                      ))}
                      {cat.data.length > 3 && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', opacity: 0.7 }}>+{cat.data.length - 3} más</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      </div>

      {/* Kanban de monitoreo */}
      {monitoreo?.columnas && (
        <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', marginBottom: '20px' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={16} color="var(--primary)" /> Monitoreo de Operaciones
            </h3>
          </div>
          <div style={{ padding: '16px 20px', overflowX: 'auto' }}>
            <div style={{ display: 'flex', gap: '12px', minWidth: '900px' }}>
              {monitoreo.columnas.map(col => (
                <div key={col.estado} style={{ flex: 1, minWidth: '130px' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: '10px', padding: '0 4px',
                  }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                      color: col.color, letterSpacing: '0.3px',
                    }}>{col.estado}</span>
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 700, color: 'white',
                      background: col.color, borderRadius: '8px', padding: '1px 7px',
                    }}>{col.documentos.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {col.documentos.map(doc => (
                      <div key={doc.id} onClick={() => navigate(`/documentos/${doc.id}`)}
                        style={{
                          padding: '8px 10px', borderRadius: '8px',
                          border: '1px solid var(--card-border)', background: 'var(--card-bg)',
                          cursor: 'pointer', transition: 'all 0.15s',
                        }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px', lineHeight: 1.3 }}>
                          {doc.nombre_archivo?.length > 25 ? doc.nombre_archivo.slice(0, 22) + '...' : doc.nombre_archivo}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                          {doc.proveedor && <span>{doc.proveedor}</span>}
                          {doc.total_cif && <span> | ${doc.total_cif?.toLocaleString()}</span>}
                        </div>
                      </div>
                    ))}
                    {col.documentos.length === 0 && (
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', padding: '8px', textAlign: 'center', opacity: 0.5 }}>
                        Vacío
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
        </div>
      )}

      {activeTab === 'terminal' && (
        <div className="fade-in dashboard-layout" style={{ height: 'calc(100vh - 220px)' }}>

        <div className="glass-panel" style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          padding: fileUrl ? '0' : '32px',
          overflow: 'hidden'
        }}>
          {!fileUrl ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                flex: 1,
                margin: '12px',
                border: `2px dashed ${isDragging ? 'var(--primary)' : 'var(--card-border)'}`,
                borderRadius: 'var(--radius-md)',
                backgroundColor: isDragging ? 'var(--primary-light)' : 'rgba(255,255,255,0.03)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                cursor: 'pointer',
                position: 'relative',
                minHeight: '400px'
              }}
            >
              <input type="file" accept=".pdf" onChange={handleFileInput} style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 10 }} />

              <div style={{ textAlign: 'center', padding: '0 40px' }}>
                <UploadCloud size={56} color="var(--primary)" style={{ marginBottom: '16px', opacity: 0.9 }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 12px 0' }}>Arrastra tu Factura Comercial PDF</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5, maxWidth: '300px', margin: '0 auto' }}>
                  Suelta el documento aquí para montarlo en el visor e iniciar la lectura OCR automática.
                </p>

                <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', position: 'relative', zIndex: 20 }}>
                  <label style={{ position: 'relative', display: 'inline-block', width: '40px', height: '20px' }}>
                    <input type="checkbox" checked={autoSave} onChange={() => setAutoSave(!autoSave)} style={{ opacity: 0, width: 0, height: 0 }} />
                    <span style={{
                      position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: autoSave ? 'var(--primary)' : '#ccc', transition: '0.4s', borderRadius: '20px'
                    }}>
                      <span style={{
                        position: 'absolute', content: '""', height: '14px', width: '14px', left: autoSave ? '22px' : '4px', bottom: '3px',
                        backgroundColor: 'white', transition: '0.4s', borderRadius: '50%'
                      }} />
                    </span>
                  </label>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: autoSave ? 'var(--primary)' : 'var(--text-muted)' }}>
                    {autoSave ? 'Guardar en historial' : 'No guardar (Solo previsualización)'}
                  </span>
                </div>

                <button className="btn btn-primary" style={{ marginTop: '24px' }}>Explorar Archivos</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ padding: '16px 24px', backgroundColor: 'rgba(0,0,0,0.03)', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Vista Previa Estricta (PDF Original)</span>
                </div>
                <button onClick={handleReset} className="btn btn-secondary">Cambiar Archivo</button>
              </div>
              <object data={fileUrl} type="application/pdf" width="100%" height="100%" style={{ flex: 1, backgroundColor: '#525659' }}>
                <p style={{ textAlign: 'center', padding: '40px' }}>Tu navegador no soporta visualización interna de PDFs. <a href={fileUrl} target="_blank" rel="noopener noreferrer">Descargar para ver.</a></p>
              </object>
            </div>
          )}
        </div>

        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: '0' }}>
          <div style={{ padding: '24px', borderBottom: '1px solid var(--card-border)', position: 'sticky', top: 0, backgroundColor: 'var(--card-bg)', backdropFilter: 'blur(10px)', zIndex: 5 }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Resultados de Inspección</h2>
          </div>

          <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: processing ? 'center' : 'flex-start' }}>
            {!file && !processing && !extractedData && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-muted)', textAlign: 'center' }}>
                <AlertTriangle size={40} style={{ opacity: 0.3, marginBottom: '16px' }} />
                <p>Esperando documento para procesar las reglas de inteligencia aduanera.</p>
              </div>
            )}

            {processing && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '400px', height: '200px', marginBottom: '24px' }}>
                  <CpuArchitecture text="ADVA" />
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>Escaneando y Validando...</h3>
              </div>
            )}

            {extractedData && (
              <div className="fade-in">
                <RiesgoBanner riesgo={extractedData.riesgo} observaciones={extractedData.observaciones} />

                {extractedData.validacion_error && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--red)', padding: '16px', borderRadius: 'var(--radius-sm)', marginBottom: '24px', border: '1px solid var(--red)40', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <AlertCircle size={20} />
                    <strong>Inconsistencia detectada:</strong> {extractedData.mensaje_error}
                  </div>
                )}

                {/* Cuadratura de Ítems */}
                {(() => {
                  const c = extractedData.cuadratura_items;
                  if (!c || !c.ejecutado || c.coincide) return null;
                  const totalRef = c.tipo_comparacion === 'subtotal' ? c.subtotal_declarado : c.total_cif_declarado;
                  const labelRef = c.tipo_comparacion === 'subtotal' ? 'subtotal' : 'total CIF';
                  const fleteSeguro = c.total_cif_declarado && c.subtotal_declarado
                    ? ` (flete/seguro/otros suman $${(c.total_cif_declarado - c.subtotal_declarado).toFixed(2)})`
                    : '';
                  return (
                    <div style={{
                      padding: '14px 18px', borderRadius: '12px', marginBottom: '16px',
                      background: c.estado === 'FAIL' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
                      border: `1px solid ${c.estado === 'FAIL' ? 'var(--red)' : 'var(--yellow)'}30`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '0.8rem' }}>
                        <AlertCircle size={14} color={c.estado === 'FAIL' ? 'var(--red)' : 'var(--yellow)'} />
                        <strong style={{ color: 'var(--text-main)' }}>Cuadratura de Ítems</strong>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        La suma de los {c.items.length} ítem(s) da <strong style={{ color: 'var(--text-main)' }}>${c.total_calculado.toFixed(2)}</strong>,
                        pero el {labelRef} declarado es <strong style={{ color: 'var(--text-main)' }}>${(totalRef || 0).toFixed(2)}</strong>.
                        {' '}Diferencia: <strong style={{ color: c.estado === 'FAIL' ? 'var(--red)' : 'var(--yellow)' }}>${c.diferencia.toFixed(2)} ({c.diferencia_porcentaje.toFixed(1)}%)</strong>.
                        {fleteSeguro}
                        {' '}Revisa y corrige los valores antes de numerar.
                      </div>
                      <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {c.items.map((it, i) => (
                          <span key={i}>
                            #{it.indice + 1}: {it.cantidad} × ${it.precio_unitario} = <strong>${it.subtotal_calculado.toFixed(2)}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <DataSection title="Relación Comercial (Origen/Destino)">
                  <InputField label="Remitente (Emisor)" value={`${(editedData?.remitente?.nombre ?? extractedData.remitente.nombre)} | ${(editedData?.remitente?.documento ?? extractedData.remitente.documento)}`}  />
                  <InputField label="Dir. Remitente" value={editedData?.remitente?.direccion ?? extractedData.remitente.direccion} editable onChange={e => updateField('remitente.direccion', e.target.value)} />
                  <InputField label="Destinatario (Receptor)" value={`${(editedData?.destinatario?.nombre ?? extractedData.destinatario.nombre)} | ${(editedData?.destinatario?.documento ?? extractedData.destinatario.documento)}`}  />
                  <InputField label="Dir. Destinatario" value={editedData?.destinatario?.direccion ?? extractedData.destinatario.direccion} editable onChange={e => updateField('destinatario.direccion', e.target.value)} />
                </DataSection>

                <DataSection title="Trazabilidad y Documento">
                  <InputField label="Nº de Factura" value={editedData?.factura?.numero ?? extractedData.factura.numero}  editable onChange={e => updateField('factura.numero', e.target.value)} />
                  <InputField label="Fecha Emisión" value={editedData?.factura?.fecha ?? extractedData.factura.fecha}  editable onChange={e => updateField('factura.fecha', e.target.value)} />
                  <InputField label="Incoterm Pactado" value={editedData?.factura?.incoterm ?? (extractedData.factura.incoterm || 'No detectado')}  editable onChange={e => updateField('factura.incoterm', e.target.value)} />
                  <InputField label="País de Origen" value={editedData?.factura?.pais_origen ?? (extractedData.factura.pais_origen || 'No especificado')}  editable onChange={e => updateField('factura.pais_origen', e.target.value)} />
                  <InputField label="País Manifiesto" value={editedData?.transporte?.paisOrigen ?? extractedData.transporte.paisOrigen} editable onChange={e => updateField('transporte.paisOrigen', e.target.value)} />
                  <InputField label="Tipo de Transporte" value={editedData?.transporte?.metodo ?? extractedData.transporte.metodo} editable onChange={e => updateField('transporte.metodo', e.target.value)} />
                </DataSection>

                <DataSection title="Desglose Financiero">
                  <InputField label={`Subtotal (${extractedData.factura.moneda})`} value={editedData?.economia?.subtotal ?? extractedData.economia.subtotal}  editable onChange={e => updateField('economia.subtotal', e.target.value)} />
                  <InputField label={`Flete / Envío (${extractedData.factura.moneda})`} value={editedData?.economia?.envio ?? extractedData.economia.envio}  editable onChange={e => updateField('economia.envio', e.target.value)} />
                  <InputField label={`Seguro (${extractedData.factura.moneda})`} value={editedData?.economia?.seguro ?? extractedData.economia.seguro}  editable onChange={e => updateField('economia.seguro', e.target.value)} />
                  <InputField label={`Otros Gastos (${extractedData.factura.moneda})`} value={editedData?.economia?.otros ?? extractedData.economia.otros} editable onChange={e => updateField('economia.otros', e.target.value)} />
                  <InputField label={`Gran Total CIF (${extractedData.factura.moneda})`} value={editedData?.economia?.total ?? extractedData.economia.total} colorClass  editable onChange={e => updateField('economia.total', e.target.value)} />
                </DataSection>

                <DataSection title="Consistencia Logística">
                  <InputField label={`Peso Bruto (${extractedData.logistica.unidad_peso})`} value={editedData?.logistica?.peso_bruto ?? extractedData.logistica.peso_bruto} editable onChange={e => updateField('logistica.peso_bruto', e.target.value)} />
                  <InputField label={`Peso Neto (${extractedData.logistica.unidad_peso})`} value={editedData?.logistica?.peso_neto ?? extractedData.logistica.peso_neto} editable onChange={e => updateField('logistica.peso_neto', e.target.value)} />
                </DataSection>

                <DataSection title="Resolución Aduanera (Sugerida)">
                  <InputField label="Clasificación Arancelaria Predominante (HS Code)" value={editedData?.partidaPrincipal ?? extractedData.partidaPrincipal} colorClass editable onChange={e => updateField('partidaPrincipal', e.target.value)} />
                </DataSection>

                <button
                  onClick={() => navigate(`/factura/${extractedData.id}/editar`, { state: { fullData: extractedData, fileUrl } })}
                  className="btn btn-primary"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', marginTop: '8px' }}
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

// Panel de administracion con pestanas de dashboard, reglas y salud del sistema
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, AlertCircle,
  RefreshCw, ToggleLeft, Settings, Shield,
  ChevronDown, ChevronUp, Loader2,
  Cpu,
  Wifi, Clock, Zap, HardDrive, FileText,
  XCircle, ChevronRight,
} from 'lucide-react';
import { API_BASE, peticionGet, peticionPut } from '../servicios/api';

import { cssVar as v } from '../libreria/utilidades';

import styles from '../../css/PanelAdmin.module.css';

const SEVERIDAD_OPTS = [
  { value: 'IGNORAR', label: 'Ignorar', color: '#6b7280' },
  { value: 'ADVERTENCIA', label: 'Advertencia', color: '#f59e0b' },
  { value: 'BLOQUEANTE', label: 'Bloqueante / Requiere Admin', color: '#ef4444' },
];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState('dashboard');
  const userName = useMemo(() => {
    try {
      const raw = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (!raw) return '';
      return JSON.parse(raw).name || '';
    } catch { return ''; }
  }, []);
  const [metrics, setMetrics] = useState(null);
  const [health, setHealth] = useState(null);
  const [recentDocs, setRecentDocs] = useState([]);
  const [commonErrors, setCommonErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [savingRule, setSavingRule] = useState(null);
  const [expandedRule, setExpandedRule] = useState(null);

  const [showFilter, setShowFilter] = useState('TODOS');

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    const fetchMetrics = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/admin/metrics`, { headers, signal });
        if (response.ok) {
          setMetrics(await response.json());
        }
      } catch (error) {
        if (error.name !== 'AbortError') console.error('Error al cargar métricas admin:', error);
      }
    };

    const fetchHealth = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/admin/health`, { headers, signal });
        if (response.ok) {
          setHealth(await response.json());
        }
      } catch (error) {
        if (error.name !== 'AbortError') console.error('Error al cargar health check:', error);
      }
    };

    const fetchRecentDocs = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/admin/documents?limit=6&skip=0`, { headers, signal });
        if (response.ok) {
          setRecentDocs(await response.json());
        }
      } catch (error) {
        if (error.name !== 'AbortError') console.error('Error al cargar documentos recientes:', error);
      }
    };

    const fetchCommonErrors = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/admin/common-errors`, { headers, signal });
        if (response.ok) {
          setCommonErrors(await response.json());
        }
      } catch (error) {
        if (error.name !== 'AbortError') console.error('Error al cargar errores comunes:', error);
      }
    };

    Promise.all([fetchMetrics(), fetchHealth(), fetchRecentDocs(), fetchCommonErrors()])
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  const loadRules = async () => {
    setRulesLoading(true);
    try {
      const data = await peticionGet('/api/admin/rules');
      setRules(data);
    } catch (err) {
      console.error('Error al cargar reglas:', err);
    } finally {
      setRulesLoading(false);
    }
  };

  useEffect(() => {
    if (tab !== 'rules') return;
    const controller = new AbortController();
    const fetchRules = async () => {
      setRulesLoading(true);
      try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const response = await fetch(`${API_BASE}/api/admin/rules`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (response.ok) {
          setRules(await response.json());
        }
      } catch (err) {
        if (err.name !== 'AbortError') console.error('Error al cargar reglas:', err);
      } finally {
        setRulesLoading(false);
      }
    };
    fetchRules();
    return () => controller.abort();
  }, [tab]);

  const handleToggle = async (ruleId, activa) => {
    setSavingRule(`toggle-${ruleId}`);
    try {
      await peticionPut(`/api/admin/rules/${ruleId}/toggle`, { activa });
      setRules(prev => prev.map(r => r.id === ruleId ? { ...r, activa } : r));
    } catch (err) {
      console.error('Error al toggle regla:', err);
    } finally {
      setSavingRule(null);
    }
  };

  const handleSeverity = async (ruleId, severidad) => {
    setSavingRule(`sev-${ruleId}`);
    try {
      await peticionPut(`/api/admin/rules/${ruleId}/severity`, { severidad });
      setRules(prev => prev.map(r => r.id === ruleId ? { ...r, severidad } : r));
    } catch (err) {
      console.error('Error al cambiar severidad:', err);
    } finally {
      setSavingRule(null);
    }
  };

  const handleThreshold = async (ruleId, key, value) => {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;
    const nuevosParams = { ...rule.parametros, [key]: value };
    setSavingRule(`th-${ruleId}`);
    try {
      await peticionPut(`/api/admin/rules/${ruleId}/threshold`, { parametros: nuevosParams });
      setRules(prev => prev.map(r => r.id === ruleId ? { ...r, parametros: nuevosParams } : r));
    } catch (err) {
      console.error('Error al cambiar umbral:', err);
    } finally {
      setSavingRule(null);
    }
  };

  const filteredRules = showFilter === 'TODOS'
    ? rules
    : rules.filter(r => showFilter === 'ACTIVAS' ? r.activa : !r.activa);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <RefreshCw size={40} color={v('primary')} className="spin" />
      </div>
    );
  }

  const KPICard = (props) => {
    const { title, value, icon: IconCmp, color, subtext } = props;
    return (
      <div className={`glass-panel ${styles.kpiCard}`}>
        <div className={styles.kpiCardAccent} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', borderRadius: '0 2px 2px 0', background: color }} />
        <div className={styles.kpiInner}>
          <div className={styles.kpiLeftGroup}>
            <div className={styles.kpiIconBg} style={{ background: `${color}1a` }}>
              {IconCmp && <IconCmp size={20} color={color} />}
            </div>
            <h3 className={styles.kpiTitle}>{title}</h3>
          </div>
          <div>
            <div className={styles.kpiValue}>{value}</div>
            {subtext && <div className={styles.kpiSubtext}>{subtext}</div>}
          </div>
        </div>
      </div>
    );
  };

  const ocrPercent = health?.ocr?.salud_porcentaje ?? metrics?.salud_ocr ?? 0;
  const geminiOnline = health?.gemini?.online ?? false;
  const geminiRateLimited = health?.gemini?.rate_limited ?? false;
  const geminiRetryAfter = health?.gemini?.retry_after ?? null;
  const colaPendientes = health?.cola?.pendientes ?? 0;
  const docsTotales = health?.db?.documentos_totales ?? metrics?.total_operaciones ?? 0;

  return (
    <div className={`fade-in ${styles.pageContainer}`}>

      <header className={styles.headerSection}>
        <div>
          <h1 className={styles.pageTitle}>
            {tab === 'dashboard' ? `Bienvenido ${userName}` : 'Configuración del Motor de Riesgo'}
          </h1>
          {tab !== 'dashboard' && (
            <p className={styles.pageSubtitle}>
              Activa, desactiva o ajusta la severidad de cada regla aduanera.
            </p>
          )}
        </div>

        <div className={styles.tabGroup}>
          <button onClick={() => setTab('dashboard')}
            className={`${styles.tabBtn} ${tab === 'dashboard' ? styles.tabBtnActive : styles.tabBtnInactive}`}>
            <LayoutDashboard size={14} /> Dashboard
          </button>
          <button onClick={() => setTab('rules')}
            className={`${styles.tabBtn} ${tab === 'rules' ? styles.tabBtnActive : styles.tabBtnInactive}`}>
            <Settings size={14} /> Motor de Riesgo
          </button>
        </div>
      </header>

      <div className={styles.scrollContent}>
        {tab === 'dashboard' && (
          <div className={styles.dashboardGrid}>



            {/* ── Row 2: Donut + Recent Docs ── */}
            <div className={styles.row2Grid}>
              {(() => {
                const riesgos = metrics?.riesgos || {};
                const alto = riesgos.alto || 0;
                const medio = riesgos.medio || 0;
                const bajo = riesgos.bajo || 0;
                const totalAlerts = alto + medio + bajo;
                const R = 58;
                const C = 2 * Math.PI * R;
                const SW = 16;
                const GAP = 2;
                const items = [
                  { value: alto, color: '#ef4444', label: 'Alto', desc: 'Requiere atención inmediata.' },
                  { value: medio, color: '#f59e0b', label: 'Medio', desc: 'Requiere revisión.' },
                  { value: bajo, color: '#10b981', label: 'Bajo', desc: 'Monitoreo rutinario.' },
                ];
                const totalVal = items.reduce((s, d) => s + d.value, 0) || 1;
                let cumulative = 0;
                const segments = items.filter(d => d.value > 0).map(d => {
                  const ratio = d.value / totalVal;
                  const segLen = (ratio * C) - GAP;
                  const offset = cumulative;
                  cumulative += ratio * C;
                  return {
                    ...d,
                    percent: Math.round(ratio * 100),
                    dashArray: `${Math.max(segLen, 0)} ${C - Math.max(segLen, 0)}`,
                    dashOffset: -offset,
                  };
                });
                return (
                  <div className={`glass-panel ${styles.panelCard}`}>
                    <div className={styles.panelHeader}>
                      <div className={styles.panelTitle}>
                        <div className={styles.panelIconCircle} style={{ background: '#ef4444' }}>
                          <AlertCircle size={14} color="#fff" />
                        </div>
                        <span>Distribución de Riesgo Documental</span>
                      </div>
                      <button onClick={() => navigate('/maestro')} className={styles.iconBtn}>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                    {totalAlerts > 0 ? (
                      <div className={styles.panelBody}>
                        <div className={styles.donutLayout}>
                          <div className={styles.donutContainer}>
                            <svg viewBox="0 0 160 160" className={styles.donutSvg}>
                              <circle cx="80" cy="80" r={R} fill="none" stroke="#f1f5f9" strokeWidth={SW} />
                              {segments.map((seg, i) => (
                                <g key={i} transform="rotate(-90, 80, 80)">
                                  <circle cx="80" cy="80" r={R} fill="none"
                                    stroke={seg.color} strokeWidth={SW}
                                    strokeDasharray={seg.dashArray}
                                    strokeDashoffset={seg.dashOffset}
                                    strokeLinecap="round"
                                  />
                                </g>
                              ))}
                            </svg>
                            <div className={styles.donutCenter}>
                              <span className={styles.donutCenterLabel}>Total</span>
                              <span className={styles.donutTotal}>{totalAlerts}</span>
                              <span className={styles.donutCenterLabel}>documentos</span>
                            </div>
                          </div>
                          <div className={styles.legendContainer}>
                            {items.map((d, i) => (
                              <React.Fragment key={d.label}>
                                {i > 0 && <div className={styles.legendDivider} />}
                                <div className={styles.legendItem}>
                                  <div className={styles.legendDot} style={{ backgroundColor: d.color }} />
                                  <div className={styles.legendContent}>
                                    <div className={styles.legendRow}>
                                      <span className={styles.legendLabel}>Riesgo {d.label}</span>
                                      <span className={styles.legendStats} style={{ color: d.color }}>
                                        {d.value} ({d.value > 0 ? Math.round(d.value / totalVal * 100) : 0}%)
                                      </span>
                                    </div>
                                    <div className={styles.legendBarTrack}>
                                      <div className={styles.legendBarFill} style={{ width: `${d.value > 0 ? Math.round(d.value / totalVal * 100) : 0}%`, background: d.color }} />
                                    </div>
                                  </div>
                                </div>
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className={styles.noDataText}>Sin datos disponibles</p>
                    )}
                  </div>
                );
              })()}

              <div className={`glass-panel ${styles.panelCard}`}>
                <div className={styles.panelHeader}>
                  <div className={styles.panelTitle}>
                    <div className={styles.panelIconCircle} style={{ background: '#3b82f6' }}>
                      <FileText size={14} color="#fff" />
                    </div>
                    <span>Últimos Documentos Procesados</span>
                  </div>
                  <button onClick={() => navigate('/maestro')} className={styles.iconBtn}>
                    <ChevronRight size={14} />
                  </button>
                </div>
                <div className={styles.panelBody}>
                  <table className={styles.docsTable}>
                    <thead>
                      <tr>
                        <th>Documento</th>
                        <th>Riesgo</th>
                        <th>Estado</th>
                        <th>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentDocs.length === 0 ? (
                        <tr><td colSpan={4} className={styles.noDataText}>Sin documentos</td></tr>
                      ) : (
                        recentDocs.map(doc => {
                          const r = (doc.riesgo || '').toLowerCase();
                          const riskClass = r === 'alto' ? styles.riskBadgeAlto : r === 'medio' ? styles.riskBadgeMedio : styles.riskBadgeBajo;
                          return (
                            <tr key={doc.id}>
                              <td className={styles.docName}>{doc.nombre_archivo?.split('/').pop()?.split('\\').pop() ?? doc.nombre_archivo}</td>
                              <td>
                                <span className={`${styles.riskBadge} ${riskClass}`}>{(doc.riesgo || '—').toUpperCase()}</span>
                              </td>
                              <td>
                                <span className={styles.statusBadge} style={{
                                  background: doc.estado === 'En Revisión' || doc.estado === 'En Revision' ? 'rgba(59, 130, 246, 0.1)' : doc.estado === 'Archivado' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(99, 102, 241, 0.08)',
                                  color: doc.estado === 'En Revisión' || doc.estado === 'En Revision' ? '#3b82f6' : doc.estado === 'Archivado' ? '#10b981' : '#6366f1',
                                }}>{doc.estado || '—'}</span>
                              </td>
                              <td className={styles.dateCell}>{doc.fecha_analisis ? new Date(doc.fecha_analisis).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }) : '—'}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ── Row 3: Errors + System Health ── */}
            <div className={styles.row3Grid}>
              <div className={`glass-panel ${styles.panelCard}`}>
                <div className={styles.panelHeader}>
                  <div className={styles.panelTitle}>
                    <div className={styles.panelIconCircle} style={{ background: '#8b5cf6' }}>
                      <XCircle size={14} color="#fff" />
                    </div>
                    <span>Errores Más Frecuentes</span>
                  </div>
                </div>
                <div className={styles.panelBody}>
                  <div className={styles.errorsList}>
                    {commonErrors.length === 0 ? (
                      <p className={styles.noDataText}>Sin errores registrados</p>
                    ) : (
                      commonErrors.map((err, i) => {
                        const maxVal = Math.max(...commonErrors.map(e => e.cantidad), 1);
                        const pct = (err.cantidad / maxVal) * 100;
                        return (
                          <div key={i} className={styles.errorRow}>
                            <div className={styles.errorDot} style={{ background: err.color }} />
                            <div className={styles.errorContent}>
                              <div className={styles.errorLabelRow}>
                                <span className={styles.errorLabel}>{err.tipo}</span>
                                <span className={styles.errorValue} style={{ color: err.color }}>{err.cantidad}</span>
                              </div>
                              <div className={styles.errorBarTrack}>
                                <div className={styles.errorBarFill} style={{ width: `${pct}%`, background: err.color }} />
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className={`glass-panel ${styles.panelCard}`}>
                <div className={styles.panelHeader}>
                  <div className={styles.panelTitle}>
                    <div className={styles.panelIconCircle} style={{ background: '#10b981' }}>
                      <Cpu size={14} color="#fff" />
                    </div>
                    <span>Estado del Sistema</span>
                  </div>
                  <button onClick={() => window.location.reload()} className={styles.iconBtn}>
                    <RefreshCw size={12} />
                  </button>
                </div>
                <div className={styles.panelBody}>
                  <div className={styles.healthMetrics}>
                    <div className={styles.healthRow}>
                      <div className={styles.healthRowIcon} style={{ background: 'rgba(99, 102, 241, 0.08)' }}>
                        <Cpu size={14} color="#6366f1" />
                      </div>
                      <div className={styles.healthRowContent}>
                        <span className={styles.healthRowLabel}>Motor OCR</span>
                        <div className={styles.healthRowBar}>
                          <div className={styles.healthRowBarFill} style={{
                            width: `${ocrPercent}%`,
                            background: ocrPercent > 90 ? '#10b981' : ocrPercent > 70 ? '#f59e0b' : '#ef4444',
                          }} />
                        </div>
                      </div>
                      <span className={styles.healthRowValue} style={{ color: ocrPercent > 90 ? '#10b981' : ocrPercent > 70 ? '#f59e0b' : '#ef4444' }}>{ocrPercent}%</span>
                    </div>
                    <div className={styles.healthRow}>
                      {(() => {
                        if (geminiOnline) {
                          return <>
                            <div className={styles.healthRowIcon} style={{ background: 'rgba(16, 185, 129, 0.08)' }}>
                              <Wifi size={14} color="#10b981" />
                            </div>
                            <div className={styles.healthRowContent}>
                              <span className={styles.healthRowLabel}>IA Gemini</span>
                              <span className={styles.healthRowSub}>Online</span>
                            </div>
                            <span className={styles.healthRowValue} style={{ color: '#10b981' }}>
                              <span className={styles.healthPulse} style={{ background: '#10b981' }} />
                              Online
                            </span>
                          </>;
                        }
                        if (geminiRateLimited) {
                          return <>
                            <div className={styles.healthRowIcon} style={{ background: 'rgba(245, 158, 11, 0.08)' }}>
                              <Clock size={14} color="#f59e0b" />
                            </div>
                            <div className={styles.healthRowContent}>
                              <span className={styles.healthRowLabel}>IA Gemini</span>
                              <span className={styles.healthRowSub}>{geminiRetryAfter ? `Cuota agotada — esperá ${Math.round(geminiRetryAfter)}s` : 'Cuota agotada'}</span>
                            </div>
                            <span className={styles.healthRowValue} style={{ color: '#f59e0b' }}>
                              <span className={styles.healthPulse} style={{ background: '#f59e0b' }} />
                              Limitado
                            </span>
                          </>;
                        }
                        return <>
                          <div className={styles.healthRowIcon} style={{ background: 'rgba(239, 68, 68, 0.08)' }}>
                            <Wifi size={14} color="#ef4444" />
                          </div>
                          <div className={styles.healthRowContent}>
                            <span className={styles.healthRowLabel}>IA Gemini</span>
                            <span className={styles.healthRowSub}>Offline</span>
                          </div>
                          <span className={styles.healthRowValue} style={{ color: '#ef4444' }}>
                            <span className={styles.healthPulse} style={{ background: '#ef4444' }} />
                            Offline
                          </span>
                        </>;
                      })()}
                    </div>
                    <div className={styles.healthRow}>
                      <div className={styles.healthRowIcon} style={{ background: colaPendientes > 0 ? 'rgba(245, 158, 11, 0.08)' : 'rgba(16, 185, 129, 0.08)' }}>
                        <Zap size={14} color={colaPendientes > 0 ? '#f59e0b' : '#10b981'} />
                      </div>
                      <div className={styles.healthRowContent}>
                        <span className={styles.healthRowLabel}>En cola</span>
                        <span className={styles.healthRowSub}>{colaPendientes > 0 ? `${colaPendientes} pendientes` : 'Sin pendientes'}</span>
                      </div>
                      <span className={styles.healthRowValue} style={{ color: colaPendientes > 0 ? '#f59e0b' : '#10b981' }}>{colaPendientes}</span>
                    </div>
                    <div className={styles.healthRow}>
                      <div className={styles.healthRowIcon} style={{ background: 'rgba(99, 102, 241, 0.08)' }}>
                        <HardDrive size={14} color="#6366f1" />
                      </div>
                      <div className={styles.healthRowContent}>
                        <span className={styles.healthRowLabel}>Almacenamiento</span>
                        <span className={styles.healthRowSub}>Documentos procesados</span>
                      </div>
                      <span className={styles.healthRowValue} style={{ color: '#6366f1' }}>{docsTotales}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {tab === 'rules' && (
          <>

            <div className={styles.rulesFilterBar}>
              <span className={styles.rulesFilterLabel}>Mostrar:</span>
              {['TODOS', 'ACTIVAS', 'INACTIVAS'].map(f => (
                <button key={f} onClick={() => setShowFilter(f)}
                  className={`${styles.rulesFilterBtn} ${showFilter === f ? styles.rulesFilterBtnActive : styles.rulesFilterBtnInactive}`}>
                  {f === 'TODOS' ? 'Todas' : f === 'ACTIVAS' ? 'Activas' : 'Inactivas'}
                </button>
              ))}
              <div className={styles.rulesFilterSpacer} />
              <button onClick={loadRules} className={`btn btn-secondary ${styles.rulesReloadBtn}`}>
                <RefreshCw size={12} className={rulesLoading ? 'spin' : ''} /> Recargar
              </button>
            </div>

            {rulesLoading ? (
              <div className={styles.rulesLoadingState}>
                <Loader2 size={32} className="spin" color={v('primary')} />
                <p className={styles.rulesLoadingText}>Cargando reglas...</p>
              </div>
            ) : (
              <div className={styles.rulesList}>
                {filteredRules.map(rule => {
                  const sevCfg = SEVERIDAD_OPTS.find(s => s.value === rule.severidad) || SEVERIDAD_OPTS[2];
                  const isExpanded = expandedRule === rule.id;
                  const saving = savingRule?.startsWith(`toggle-${rule.id}`);
                  const savingSev = savingRule === `sev-${rule.id}`;
                  return (
                    <div key={rule.id} className={`glass-panel ${styles.ruleCard}`} style={{
                      opacity: rule.activa ? 1 : 0.5,
                      border: `1px solid ${rule.activa ? v('card-border') : 'rgba(107,114,128,0.2)'}`,
                    }}>
                      <div className={styles.ruleCardBody}>

                        <div style={{ flexShrink: 0 }}>
                          <button onClick={() => handleToggle(rule.id, !rule.activa)}
                            disabled={!!saving}
                            className={styles.ruleToggle}
                            style={{ background: rule.activa ? v('green') : '#d1d5db' }}>
                            <div className={styles.ruleToggleKnob} style={{ left: rule.activa ? '23px' : '3px' }} />
                          </button>
                        </div>

                        <div className={styles.ruleInfo}>
                          <div className={styles.ruleName}>
                            <Shield size={14} color={sevCfg.color} />
                            {rule.nombre_mostrar}
                            {!rule.activa && <span className={styles.ruleInactiveLabel}>(Inactiva)</span>}
                          </div>
                          <p className={styles.ruleDesc}>{rule.descripcion}</p>
                        </div>

                        <div>
                          <select value={rule.severidad}
                            onChange={(e) => handleSeverity(rule.id, e.target.value)}
                            disabled={!!savingSev}
                            className={styles.ruleSeveritySelect}
                            style={{ border: `1px solid ${sevCfg.color}40`, background: `${sevCfg.color}10`, color: sevCfg.color }}>
                            {SEVERIDAD_OPTS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>

                        <button onClick={() => setExpandedRule(isExpanded ? null : rule.id)} className={styles.ruleExpandBtn}>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className={styles.ruleExpandedSection}>

                          {rule.parametros && Object.keys(rule.parametros).length > 0 && (
                            <div className={styles.paramsSection}>
                              <div className={styles.paramsHeader}>
                                <Settings size={12} /> Parámetros de umbral
                              </div>
                              <div className={styles.paramsList}>
                                {Object.entries(rule.parametros).map(([key, val]) => {
                                  const savingTh = savingRule === `th-${rule.id}`;
                                  return (
                                    <div key={key} className={styles.paramField}>
                                      <label className={styles.paramLabel}>
                                        {key.replace(/_/g, ' ')}:
                                      </label>
                                      <input type={typeof val === 'number' ? 'number' : 'text'}
                                        step={typeof val === 'number' ? 'any' : undefined}
                                        defaultValue={val}
                                        onBlur={(e) => {
                                          const newVal = typeof val === 'number' ? parseFloat(e.target.value) : e.target.value;
                                          if (newVal !== val) handleThreshold(rule.id, key, newVal);
                                        }}
                                        className={styles.paramInput}
                                      />
                                      {savingTh && <Loader2 size={12} className="spin" />}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {filteredRules.length === 0 && (
                  <div className={styles.emptyRulesState}>
                    <ToggleLeft size={40} className={styles.emptyRulesIcon} />
                    <p>No hay reglas que mostrar con el filtro seleccionado.</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;

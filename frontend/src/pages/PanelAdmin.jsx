import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, AlertCircle, CheckCircle, TrendingUp, Users,
  RefreshCw, Layers, ToggleLeft, Settings, Shield, History,
  ChevronDown, ChevronUp, Save, Loader2,
} from 'lucide-react';
import { API_BASE, peticionGet, peticionPut } from '../services/api';

// Helper: retorna variable CSS con el name dado
const v = (name) => `var(--${name})`;

const SEVERIDAD_OPTS = [
  { value: 'IGNORAR', label: 'Ignorar', color: '#6b7280' },
  { value: 'ADVERTENCIA', label: 'Advertencia', color: '#f59e0b' },
  { value: 'BLOQUEANTE', label: 'Bloqueante / Requiere Admin', color: '#ef4444' },
];

// Componente principal: panel de administración con dashboard y configuración del motor de riesgo
const AdminDashboard = () => {
  const [tab, setTab] = useState('dashboard');
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [savingRule, setSavingRule] = useState(null);
  const [expandedRule, setExpandedRule] = useState(null);

  const [showFilter, setShowFilter] = useState('TODOS');

  // Carga las métricas del dashboard desde el servidor al montar el componente
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const response = await fetch(`${API_BASE}/api/admin/metrics`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setMetrics(data);
        }
      } catch (error) {
        console.error('Error al cargar métricas admin:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  // Obtiene la lista de reglas del motor de riesgo desde el servidor
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
    if (tab === 'rules') {
      loadRules();
    }
  }, [tab]);

  // Activa o desactiva una regla del motor de riesgo
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

  // Cambia el nivel de severidad de una regla
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

  // Actualiza un parámetro de umbral de una regla
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <RefreshCw size={40} color={v('primary')} className="spin" />
      </div>
    );
  }

  // Renderiza una tarjeta de indicador KPI con título, valor, ícono y color
  const KPICard = (props) => {
    const { title, value, icon: IconCmp, color, subtitle } = props;
    return (
    <div className="glass-panel" style={{ padding: '24px', flex: 1, minWidth: '240px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div style={{ backgroundColor: `${color}15`, padding: '10px', borderRadius: '12px' }}>
          {IconCmp && <IconCmp size={24} color={color} />}
        </div>
      </div>
      <h3 style={{ fontSize: '0.9rem', color: v('text-muted'), fontWeight: 500, margin: '0 0 8px 0' }}>{title}</h3>
      <div style={{ fontSize: '2rem', fontWeight: 800, color: v('text-main'), letterSpacing: '-1px' }}>{value}</div>
      {subtitle && <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', color: v('text-muted') }}>{subtitle}</p>}
    </div>
  );
  };
  return (
    <div className="fade-in" style={{
      height: 'calc(100vh - 64px)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Cabecera unificada con Pestañas inline */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px',
        flexShrink: 0
      }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-1px', margin: 0 }}>
            {tab === 'dashboard' ? 'Portal de Gerencia Aduanera' : 'Configuración del Motor de Riesgo'}
          </h1>
          <p style={{ color: v('text-muted'), marginTop: '4px', fontSize: '0.95rem', margin: '4px 0 0 0' }}>
            {tab === 'dashboard'
              ? 'Supervisión estratégica y control de operaciones globales.'
              : 'Activa, desactiva o ajusta la severidad de cada regla aduanera.'}
          </p>
        </div>

        {/* Selector de Pestañas */}
        <div style={{ display: 'inline-flex', gap: '4px', background: v('card-bg'), borderRadius: '12px', border: `1px solid ${v('card-border')}`, padding: '4px' }}>
          <button onClick={() => setTab('dashboard')}
            style={{
              padding: '8px 16px', borderRadius: '10px', fontWeight: 700, fontSize: '0.8rem',
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              background: tab === 'dashboard' ? v('primary') : 'transparent',
              color: tab === 'dashboard' ? 'white' : v('text-muted'),
              transition: 'all 0.2s',
            }}>
            <LayoutDashboard size={14} /> Dashboard
          </button>
          <button onClick={() => setTab('rules')}
            style={{
              padding: '8px 16px', borderRadius: '10px', fontWeight: 700, fontSize: '0.8rem',
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              background: tab === 'rules' ? v('primary') : 'transparent',
              color: tab === 'rules' ? 'white' : v('text-muted'),
              transition: 'all 0.2s',
            }}>
            <Settings size={14} /> Motor de Riesgo
          </button>
        </div>
      </header>

      {/* Contenedor con Scroll Interno */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        paddingRight: '8px',
        paddingBottom: '24px'
      }}>
        {tab === 'dashboard' && (
          <>
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '32px' }}>
              <KPICard title="Operaciones Totales" value={metrics?.total_operaciones} icon={Layers} color={v('primary')} subtitle="Documentos procesados por el equipo" />
              <KPICard title="Riesgo Crítico" value={`${metrics?.riesgos.alto_porcentaje}%`} icon={AlertCircle} color={v('red')} subtitle="Tasa de alertas de alto riesgo" />
              <KPICard title="Eficiencia OCR" value={`${metrics?.salud_ocr}%`} icon={TrendingUp} color={v('green')} subtitle="Precisión del motor de extracción" />
              <KPICard title="Analistas en Turno" value={metrics?.analistas_activos} icon={Users} color="#8b5cf6" subtitle="Sesiones activas en este momento" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
              <div className="glass-panel" style={{ padding: '24px' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <AlertCircle size={20} color={v('red')} /> Distribución de Alertas Automáticas
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {['alto', 'medio', 'bajo'].map(nivel => {
                    const cfg = { alto: { color: v('red'), bg: 'rgba(239,68,68,0.05)' }, medio: { color: v('yellow'), bg: 'rgba(245,158,11,0.05)' }, bajo: { color: v('green'), bg: 'rgba(16,185,129,0.05)' } }[nivel];
                    return (
                      <div key={nivel} style={{ padding: '16px', backgroundColor: cfg.bg, borderRadius: '12px', borderLeft: `4px solid ${cfg.color}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Riesgo {nivel.charAt(0).toUpperCase() + nivel.slice(1)}</span>
                          <span style={{ fontWeight: 700 }}>{metrics?.riesgos[nivel]}</span>
                        </div>
                        <div style={{ height: '8px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${metrics?.riesgos[`${nivel}_porcentaje`] || 0}%`, backgroundColor: cfg.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                  <CheckCircle size={40} color={v('green')} />
                </div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Sistema Saludable</h2>
                <p style={{ color: v('text-muted'), fontSize: '0.9rem', maxWidth: '300px', margin: '12px 0 24px 0' }}>
                  El motor de auditoría y validación documental está operando de manera estable y sincrónica.
                </p>
                <button className="btn btn-primary" onClick={() => setTab('rules')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Settings size={16} /> Configurar Reglas
                </button>
              </div>
            </div>
          </>
        )}

        {tab === 'rules' && (
          <>
            {/* Filtros */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: v('text-muted') }}>Mostrar:</span>
              {['TODOS', 'ACTIVAS', 'INACTIVAS'].map(f => (
                <button key={f} onClick={() => setShowFilter(f)}
                  style={{
                    padding: '6px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '0.75rem',
                    border: `1px solid ${showFilter === f ? v('primary') : v('card-border')}`,
                    cursor: 'pointer', background: showFilter === f ? v('primary-light') : 'transparent',
                    color: showFilter === f ? v('primary') : v('text-muted'),
                    transition: 'all 0.2s',
                  }}>
                  {f === 'TODOS' ? 'Todas' : f === 'ACTIVAS' ? 'Activas' : 'Inactivas'}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              <button onClick={loadRules} className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '0.75rem' }}>
                <RefreshCw size={12} className={rulesLoading ? 'spin' : ''} /> Recargar
              </button>
            </div>

            {rulesLoading ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <Loader2 size={32} className="spin" color={v('primary')} />
                <p style={{ color: v('text-muted'), marginTop: '12px' }}>Cargando reglas...</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredRules.map(rule => {
                  const sevCfg = SEVERIDAD_OPTS.find(s => s.value === rule.severidad) || SEVERIDAD_OPTS[2];
                  const isExpanded = expandedRule === rule.id;
                  const saving = savingRule?.startsWith(`toggle-${rule.id}`);
                  const savingSev = savingRule === `sev-${rule.id}`;
                  return (
                    <div key={rule.id} className="glass-panel" style={{
                      padding: 0, overflow: 'hidden',
                      opacity: rule.activa ? 1 : 0.5,
                      border: `1px solid ${rule.activa ? v('card-border') : 'rgba(107,114,128,0.2)'}`,
                    }}>
                      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {/* Toggle */}
                        <div style={{ flexShrink: 0 }}>
                          <button onClick={() => handleToggle(rule.id, !rule.activa)}
                            disabled={!!saving}
                            style={{
                              width: '44px', height: '24px', borderRadius: '12px', border: 'none',
                              cursor: 'pointer', position: 'relative', transition: 'all 0.3s',
                              background: rule.activa ? v('green') : '#d1d5db',
                            }}>
                            <div style={{
                              width: '18px', height: '18px', borderRadius: '50%', background: 'white',
                              position: 'absolute', top: '3px', transition: 'all 0.3s',
                              left: rule.activa ? '23px' : '3px', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                            }} />
                          </button>
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: v('text-main'), display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Shield size={14} color={sevCfg.color} />
                            {rule.nombre_mostrar}
                            {!rule.activa && <span style={{ fontSize: '0.65rem', color: v('text-muted'), fontWeight: 400 }}>(Inactiva)</span>}
                          </div>
                          <p style={{ margin: '3px 0 0', fontSize: '0.75rem', color: v('text-muted'), lineHeight: 1.4 }}>{rule.descripcion}</p>
                        </div>

                        {/* Severity */}
                        <div>
                          <select value={rule.severidad}
                            onChange={(e) => handleSeverity(rule.id, e.target.value)}
                            disabled={!!savingSev}
                            style={{
                              padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700,
                              border: `1px solid ${sevCfg.color}40`, cursor: 'pointer',
                              background: `${sevCfg.color}10`, color: sevCfg.color,
                              outline: 'none',
                            }}>
                            {SEVERIDAD_OPTS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>

                        {/* Expand */}
                        <button onClick={() => setExpandedRule(isExpanded ? null : rule.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: v('text-muted'), padding: '4px' }}>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>

                      {/* Expanded: Thresholds + Audit */}
                      {isExpanded && (
                        <div style={{ borderTop: `1px solid ${v('card-border')}`, padding: '16px 20px', background: 'rgba(0,0,0,0.01)' }}>
                          {/* Parámetros editables */}
                          {rule.parametros && Object.keys(rule.parametros).length > 0 && (
                            <div style={{ marginBottom: '16px' }}>
                              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: v('text-muted'), textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Settings size={12} /> Parámetros de umbral
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                {Object.entries(rule.parametros).map(([key, val]) => {
                                  const savingTh = savingRule === `th-${rule.id}`;
                                  return (
                                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <label style={{ fontSize: '0.7rem', fontWeight: 600, color: v('text-muted'), textTransform: 'capitalize' }}>
                                        {key.replace(/_/g, ' ')}:
                                      </label>
                                      <input type={typeof val === 'number' ? 'number' : 'text'}
                                        step={typeof val === 'number' ? 'any' : undefined}
                                        defaultValue={val}
                                        onBlur={(e) => {
                                          const newVal = typeof val === 'number' ? parseFloat(e.target.value) : e.target.value;
                                          if (newVal !== val) handleThreshold(rule.id, key, newVal);
                                        }}
                                        style={{
                                          padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem',
                                          border: `1px solid ${v('card-border')}`, width: '100px',
                                          background: v('card-bg'), color: v('text-main'), outline: 'none',
                                        }}
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
                  <div style={{ textAlign: 'center', padding: '60px 0', color: v('text-muted') }}>
                    <ToggleLeft size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
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

import React, { useState } from 'react';
import {
  AlertCircle, CheckCircle, XCircle, HelpCircle, ChevronDown, ChevronUp,
  Shield, FileText, Calculator, Scale, Package, Globe, Clock, Flag,
} from 'lucide-react';

const v = (name) => `var(--${name})`;

const STATUS_CFG = {
  PASS: { color: v('green'), bg: 'rgba(16,185,129,0.08)', icon: CheckCircle, label: 'Aprobado' },
  WARNING: { color: v('yellow'), bg: 'rgba(245,158,11,0.08)', icon: AlertCircle, label: 'Advertencia' },
  FAIL: { color: v('red'), bg: 'rgba(239,68,68,0.08)', icon: XCircle, label: 'Fallo' },
  NO_EJECUTADA: { color: '#6b7280', bg: 'rgba(107,114,128,0.05)', icon: HelpCircle, label: 'No ejecutada' },
};

const STAGE_ICONS = {
  1: FileText,
  2: Calculator,
  3: Shield,
  4: Package,
  5: Globe,
  6: Clock,
  7: Flag,
};

const STAGE_COLORS = {
  1: '#3b82f6',
  2: '#8b5cf6',
  3: '#ef4444',
  4: '#f59e0b',
  5: '#10b981',
  6: '#6366f1',
  7: '#ec4899',
};

const NIVEL_CFG = {
  BAJO: { color: v('green'), bg: 'rgba(16,185,129,0.1)', icon: CheckCircle, label: 'Bajo' },
  MEDIO: { color: v('yellow'), bg: 'rgba(245,158,11,0.1)', icon: AlertCircle, label: 'Medio' },
  ALTO: { color: v('red'), bg: 'rgba(239,68,68,0.1)', icon: XCircle, label: 'Alto' },
  CRITICO: { color: '#dc2626', bg: 'rgba(220,38,38,0.12)', icon: XCircle, label: 'Crítico' },
};

// Muestra el resultado individual de un control dentro de una etapa
const ControlItem = ({ control }) => {
  const cfg = STATUS_CFG[control.estado] || STATUS_CFG.NO_EJECUTADA;
  const Icon = cfg.icon;
  return (
    <div style={{
      display: 'flex', gap: '10px', padding: '8px 12px', borderRadius: '8px',
      background: cfg.bg, alignItems: 'flex-start',
      borderLeft: `3px solid ${cfg.color}`,
    }}>
      <Icon size={14} color={cfg.color} style={{ flexShrink: 0, marginTop: '2px' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.72rem', fontWeight: 700, color: v('text-muted'),
          textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '2px',
        }}>
          {control.nombre.replace(/_/g, ' ')}
        </div>
        <div style={{ fontSize: '0.8rem', color: v('text-main'), lineHeight: 1.4 }}>{control.mensaje}</div>
        {control.detalle && (
          <div style={{
            fontSize: '0.7rem', color: v('text-muted'), marginTop: '4px',
            fontFamily: 'monospace', background: 'rgba(0,0,0,0.03)', padding: '4px 8px',
            borderRadius: '4px', maxWidth: '100%', overflowX: 'auto',
          }}>
            {control.detalle}
          </div>
        )}
      </div>
    </div>
  );
};

// Pipeline de prevalidación con etapas y controles de riesgo
const PipelinePrevalidacion = ({ prevalidacion }) => {
  const [expandedStages, setExpandedStages] = useState(new Set([1, 2, 3, 4, 5, 6, 7]));
  const [showAll, setShowAll] = useState(false);

  if (!prevalidacion) return null;

  const { riesgo_global, puntaje_riesgo, etapas } = prevalidacion;
  const nivelCfg = NIVEL_CFG[riesgo_global] || NIVEL_CFG.MEDIO;
  const NivelIcon = nivelCfg.icon;

  // Expande o colapsa una etapa del pipeline
  const toggleStage = (num) => {
    setExpandedStages(prev => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  };

  // Expande o colapsa todas las etapas
  const toggleAll = () => {
    if (expandedStages.size === etapas.length) {
      setExpandedStages(new Set());
    } else {
      setExpandedStages(new Set(etapas.map(e => e.numero)));
    }
  };

  const filteredEtapas = showAll ? etapas : etapas.slice(0, 6);
  const totalControles = etapas.reduce((s, e) => s + e.controles.length, 0);
  const passedControles = etapas.reduce((s, e) => s + e.controles.filter(c => c.estado === 'PASS').length, 0);

  return (
    <div style={{ marginTop: '20px' }}>
      {/* Header - Global Risk Score */}
      <div style={{
        background: nivelCfg.bg, borderRadius: '16px', padding: '20px 24px',
        border: `1px solid ${nivelCfg.color}30`, marginBottom: '20px',
        display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
      }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '50%',
          background: `${nivelCfg.color}15`, display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <NivelIcon size={28} color={nivelCfg.color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: v('text-muted'), textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Resultado de Prevalidación
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: nivelCfg.color, lineHeight: 1.2 }}>
            Riesgo {nivelCfg.label}
          </div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: v('text-muted') }}>
              Puntaje: <strong>{puntaje_riesgo}%</strong>
            </span>
            <span style={{ fontSize: '0.8rem', color: v('text-muted') }}>
              Etapas: <strong>{etapas.length}</strong>
            </span>
            <span style={{ fontSize: '0.8rem', color: v('text-muted') }}>
              Controles: <strong>{passedControles}/{totalControles}</strong> OK
            </span>
          </div>
        </div>
      </div>

      {/* Toggle controls */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: v('text-muted') }}>
          Pipeline de Validación ({etapas.length} etapas)
        </span>
        <div style={{ flex: 1 }} />
        {etapas.length > 6 && (
          <button onClick={() => setShowAll(!showAll)}
            style={{
              padding: '4px 12px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600,
              border: `1px solid ${v('card-border')}`, cursor: 'pointer',
              background: 'transparent', color: v('text-muted'),
            }}>
            {showAll ? 'Mostrar solo activas' : 'Mostrar todas'}
          </button>
        )}
        <button onClick={toggleAll}
          style={{
            padding: '4px 12px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600,
            border: `1px solid ${v('card-border')}`, cursor: 'pointer',
            background: 'transparent', color: v('text-muted'),
          }}>
          {expandedStages.size === etapas.length ? 'Colapsar todo' : 'Expandir todo'}
        </button>
      </div>

      {/* Stages */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredEtapas.map(etapa => {
          const StageIcon = STAGE_ICONS[etapa.numero] || Shield;
          const stageColor = STAGE_COLORS[etapa.numero] || '#6b7280';
          const cfg = STATUS_CFG[etapa.estado] || STATUS_CFG.NO_EJECUTADA;
          const Icon = cfg.icon;
          const expanded = expandedStages.has(etapa.numero);

          return (
            <div key={etapa.numero} className="glass-panel" style={{
              padding: 0, overflow: 'hidden',
              border: `1px solid ${etapa.estado === 'FAIL' ? v('red') + '40' : etapa.estado === 'WARNING' ? v('yellow') + '40' : v('card-border')}`,
              opacity: etapa.controles.length === 0 ? 0.5 : 1,
            }}>
              <button onClick={() => toggleStage(etapa.numero)}
                style={{
                  width: '100%', padding: '14px 16px', border: 'none', background: 'transparent',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
                  textAlign: 'left', color: v('text-main'),
                }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  background: `${stageColor}12`, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <StageIcon size={16} color={stageColor} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                    Etapa {etapa.numero}: {etapa.titulo}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: v('text-muted'), marginTop: '2px' }}>
                    {etapa.descripcion}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  {etapa.resumen && (
                    <span style={{
                      fontSize: '0.65rem', color: cfg.color, fontWeight: 600,
                      background: cfg.bg, padding: '2px 8px', borderRadius: '4px',
                      whiteSpace: 'nowrap',
                    }}>
                      {etapa.resumen}
                    </span>
                  )}
                  <Icon size={16} color={cfg.color} />
                  {expanded ? <ChevronUp size={14} color={v('text-muted')} /> : <ChevronDown size={14} color={v('text-muted')} />}
                </div>
              </button>

              {expanded && etapa.controles.length > 0 && (
                <div style={{
                  padding: '0 16px 14px 16px',
                  borderTop: `1px solid ${v('card-border')}`,
                  paddingTop: '12px', marginTop: '0',
                  display: 'flex', flexDirection: 'column', gap: '6px',
                }}>
                  {etapa.controles.map((ctrl, i) => (
                    <ControlItem key={i} control={ctrl} />
                  ))}
                </div>
              )}

              {expanded && etapa.controles.length === 0 && (
                <div style={{
                  padding: '0 16px 14px 16px',
                  borderTop: `1px solid ${v('card-border')}`,
                  paddingTop: '12px',
                }}>
                  <div style={{ fontSize: '0.75rem', color: v('text-muted'), fontStyle: 'italic' }}>
                    Sin controles ejecutados para esta etapa.
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PipelinePrevalidacion;

import React, { useState } from 'react';
import {
  AlertCircle, CheckCircle, XCircle, HelpCircle, ChevronDown, ChevronUp,
  Shield, FileText, Calculator, Scale, Package, Globe, Clock, Flag,
} from 'lucide-react';

import { cssVar as v } from '../libreria/utilidades';

const FIELD_SHORT = {
  'numero_factura': 'N° factura',
  'fecha_emision': 'Fecha emisión',
  'moneda': 'Moneda',
  'incoterm': 'Incoterm',
  'monto_total': 'Monto total',
  'emisor_nombre': 'Nombre exportador',
  'receptor_rut_chile': 'RUT importador',
  'cuadre_aritmetico': 'Cuadre CIF',
  'asignacion_partida': 'Partidas',
  'cif_flete_seguro': 'Flete/Seguro',
  'fob_cargos_extra': 'Cargos FOB',
  'detalles_disponibles': 'Detalles',
  'partidas_disponibles': 'Partidas',
  'entidades_requeridas': 'Entidades',
  'permisos_cubiertos': 'Permisos',
  'permisos_faltantes': 'V°B°',
  'peso_factura_vs_bl': 'Peso Fact/BL',
  'peso_pl_vs_bl': 'Peso PL/BL',
  'bultos_factura_vs_bl': 'Bultos Fact/BL',
  'bultos_pl_vs_bl': 'Bultos PL/BL',
  'cantidad_total': 'Cantidad total',
  'identidad_proveedor': 'Proveedor',
  'incoterm_valido': 'Incoterm',
  'seguro_obligatorio': 'Seguro',
  'flete_obligatorio': 'Flete',
  'exw_cargos': 'Cargos EXW',
  'fob_cargos': 'Cargos FOB',
  'coherencia_precios': 'Precios',
  'descuentos_documentados': 'Descuentos',
  'regalias': 'Regalías',
  'vinculacion': 'Vinculación',
  'vigencia_factura': 'Vigencia factura',
  'vigencia_bl': 'Vigencia BL',
  'cobertura_seguro': 'Cobertura seguro',
  'scoring_final': 'Score',
};
const shortLabel = (c) => FIELD_SHORT[c.nombre] || c.nombre.replace(/_/g, ' ');

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
  /* Etapas inician colapsadas; el agente las expande al hacer click */
  const [expandedStages, setExpandedStages] = useState(new Set());
  const [showAll, setShowAll] = useState(false);

  if (!prevalidacion) return null;

  /* Normaliza riesgo_global a mayusculas porque el backend lo devuelve en minuscula (ej: "medio") */
  const { riesgo_global: rg, puntaje_riesgo, etapas } = prevalidacion;
  const riesgo_global = rg?.toUpperCase?.() ?? 'MEDIO';
  const nivelCfg = NIVEL_CFG[riesgo_global] || NIVEL_CFG.MEDIO;

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
  const hallazgos = etapas.flatMap(e =>
    e.controles
      .filter(c => c.estado !== 'PASS' && c.mensaje)
      .map(c => ({ ...c, etapa: e.numero, etapaTitulo: e.titulo }))
  );

  return (
    <div style={{ marginTop: '20px' }}>
      {/* Header - Global Risk Score */}
      <div style={{
        background: nivelCfg.bg, borderRadius: '16px', padding: '20px 24px',
        border: `1px solid ${nivelCfg.color}30`, marginBottom: '20px',
        display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
      }}>
        {/* Semáforo vertical: 3 luces apiladas, solo se ilumina la del nivel actual */}
        <div style={{
          width: '38px', flexShrink: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px',
          padding: '10px 8px', borderRadius: '10px',
          background: `${nivelCfg.color}15`,
          border: `1px solid ${nivelCfg.color}25`,
        }}>
          {['BAJO', 'MEDIO', 'ALTO'].map(nivel => {
            const activo = riesgo_global === nivel || (nivel === 'ALTO' && riesgo_global === 'CRITICO');
            const color = nivel === 'BAJO' ? '#22c55e' : nivel === 'MEDIO' ? '#eab308' : '#ef4444';
            return (
              <span key={nivel} style={{
                width: '16px', height: '16px', borderRadius: '50%',
                background: activo ? color : '#d1d5db',
                opacity: activo ? 1 : 0.15,
                transition: 'all 0.25s',
                boxShadow: activo ? `0 0 14px ${color}B0` : 'none',
                border: '2px solid rgba(0,0,0,0.45)',
              }} />
            );
          })}
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
          </div>
          {(() => {
            const fails = hallazgos.filter(h => h.estado === 'FAIL' && h.nombre !== 'scoring_final');
            return fails.length > 0 ? (
              <div style={{ marginTop: '10px', fontSize: '0.8rem', color: v('red'), display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                <span style={{ fontWeight: 700, flexShrink: 0 }}>Falta:</span>
                <span>{fails.map(shortLabel).join(', ')}</span>
              </div>
            ) : null;
          })()}
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
                  {(() => {
                    const f = etapa.controles.filter(c => c.estado === 'FAIL' && c.nombre !== 'scoring_final');
                    const w = etapa.controles.filter(c => c.estado === 'WARNING');
                    if (f.length > 0) {
                      return <span style={{ fontSize: '0.65rem', color: v('red'), fontWeight: 600, background: 'rgba(239,68,68,0.08)', padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                        ✗ {f.map(shortLabel).join(', ')}
                      </span>;
                    }
                    if (w.length > 0) {
                      return <span style={{ fontSize: '0.65rem', color: v('yellow'), fontWeight: 600, background: 'rgba(245,158,11,0.08)', padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                        ⚠ {w.map(shortLabel).join(', ')}
                      </span>;
                    }
                    if (etapa.controles.length > 0) {
                      return <span style={{ fontSize: '0.65rem', color: v('green'), fontWeight: 600, background: 'rgba(16,185,129,0.08)', padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap' }}>✓ OK</span>;
                    }
                    return null;
                  })()}
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

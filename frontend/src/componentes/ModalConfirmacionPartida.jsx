// Modal de confirmacion para partida arancelaria seleccionada
import { useState, useEffect } from 'react';
import {
  Check, X, Loader2, Shield, Scale, FileText, AlertTriangle,
  ChevronDown, ChevronRight, BookOpen,
} from 'lucide-react';

const ENTIDAD_COLORS = {
  SENASA: '#059669', SAG: '#65a30d', SERNAPESCA: '#0284c7',
  ISP: '#7c3aed', COFEPRIS: '#dc2626', SEC: '#d97706',
  SUBTEL: '#0891b2', MINTRANS: '#4f46e5', INN: '#6b7280',
}; 

import { cssVar as v } from '../libreria/utilidades';

export default function ModalConfirmacionPartida({
  abierto, partida, descripcion, itemDescripcion,
  entidades, cargandoEntidades, onConfirmar, onCerrar,
}) {
  const [seleccionadas, setSeleccionadas] = useState({});
  const [entidadesExpandidas, setEntidadesExpandidas] = useState(true);

  useEffect(() => {
    if (abierto && entidades?.length) {
      const inicial = {};
      entidades.forEach((e, i) => { inicial[i] = true; });
      setSeleccionadas(inicial);
      setEntidadesExpandidas(true);
    }
  }, [abierto, entidades]);

  if (!abierto) return null;

  const toggle = (idx) => {
    setSeleccionadas(p => ({ ...p, [idx]: !p[idx] }));
  };

  const seleccionadasArray = entidades
    ? entidades.filter((_, i) => seleccionadas[i])
    : [];

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
    }}>
      <div className="glass-panel" style={{
        width: '600px', maxWidth: '90vw', maxHeight: '90vh',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        
        <div style={{
          padding: '20px 24px', borderBottom: `1px solid ${v('card-border')}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              padding: '10px', borderRadius: '10px',
              background: 'rgba(124,58,237,0.1)',
            }}>
              <Scale size={22} color="#a78bfa" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: v('text-main') }}>
                Confirmar Partida Arancelaria
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: v('text-muted') }}>
                Asignación y marcado regulatorio
              </p>
            </div>
          </div>
          <button onClick={onCerrar}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: v('text-muted') }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', overflow: 'auto', flex: 1 }}>
          
          <div style={{
            padding: '14px', borderRadius: '10px',
            background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.2)',
            marginBottom: '16px',
          }}>
            <div style={{ fontSize: '0.7rem', color: v('text-muted'), fontWeight: 600, marginBottom: '4px' }}>
              PARTIDA CONFIRMADA
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#a78bfa', letterSpacing: '0.5px' }}>
              {partida}
            </div>
            {descripcion && (
              <div style={{ fontSize: '0.85rem', color: v('text-main'), marginTop: '4px', fontStyle: 'italic' }}>
                {descripcion}
              </div>
            )}
            {itemDescripcion && (
              <div style={{ fontSize: '0.75rem', color: v('text-muted'), marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <FileText size={12} /> Producto: {itemDescripcion}
              </div>
            )}
          </div>

          <div>
            <div
              onClick={() => setEntidadesExpandidas(!entidadesExpandidas)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                color: v('text-main'), marginBottom: '12px',
              }}
            >
              {entidadesExpandidas ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Shield size={14} />
              Entidades Regulatorias Detectadas
              {!cargandoEntidades && (
                <span style={{
                  fontSize: '0.7rem', fontWeight: 700,
                  color: entidades?.length > 0 ? 'var(--yellow)' : v('green'),
                  marginLeft: '6px',
                }}>
                  ({entidades?.length || 0} {entidades?.length === 1 ? 'entidad' : 'entidades'})
                </span>
              )}
            </div>

            {cargandoEntidades ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', color: v('text-muted'), fontSize: '0.8rem' }}>
                <Loader2 size={14} className="spin" /> Detectando entidades regulatorias...
              </div>
            ) : entidades?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                {entidades.map((ent, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: '10px',
                    padding: '10px 12px', borderRadius: '8px',
                    border: `1px solid ${seleccionadas[i] ? `${ENTIDAD_COLORS[ent.entidad] || '#6b7280'}40` : v('card-border')}`,
                    background: seleccionadas[i]
                      ? `${ENTIDAD_COLORS[ent.entidad] || '#6b7280'}08`
                      : 'transparent',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                    onClick={() => toggle(i)}
                  >
                    <div style={{
                      width: '18px', height: '18px', borderRadius: '4px',
                      border: `2px solid ${seleccionadas[i] ? (ENTIDAD_COLORS[ent.entidad] || '#6b7280') : v('card-border')}`,
                      background: seleccionadas[i] ? (ENTIDAD_COLORS[ent.entidad] || '#6b7280') : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, marginTop: '1px', transition: 'all 0.15s',
                    }}>
                      {seleccionadas[i] && <Check size={12} color="white" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: 700, fontSize: '0.8rem',
                        color: seleccionadas[i] ? (ENTIDAD_COLORS[ent.entidad] || v('text-main')) : v('text-muted'),
                      }}>
                        {ent.entidad}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: v('text-muted'), marginTop: '2px' }}>
                        {ent.tipo_permiso}
                      </div>
                      {ent.ley && (
                        <div style={{
                          fontSize: '0.65rem', color: v('text-muted'), marginTop: '2px',
                          opacity: 0.7, display: 'flex', alignItems: 'center', gap: '3px',
                        }}>
                          <BookOpen size={10} /> {ent.ley}
                        </div>
                      )}
                    </div>
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 600, padding: '2px 8px',
                      borderRadius: '12px',
                      background: seleccionadas[i] ? 'rgba(250,204,21,0.15)' : 'rgba(107,114,128,0.08)',
                      color: seleccionadas[i] ? 'var(--yellow)' : v('text-muted'),
                      whiteSpace: 'nowrap',
                    }}>
                      {seleccionadas[i] ? 'Aplica' : 'No aplica'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                padding: '14px', borderRadius: '8px',
                background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)',
                display: 'flex', alignItems: 'center', gap: '8px',
                fontSize: '0.8rem', color: v('green'), marginBottom: '12px',
              }}>
                <Check size={16} />
                No se detectaron entidades regulatorias para esta partida. No requiere V°B° adicionales.
              </div>
            )}
          </div>
        </div>

        <div style={{
          padding: '16px 24px', borderTop: `1px solid ${v('card-border')}`,
          display: 'flex', gap: '10px', justifyContent: 'flex-end',
        }}>
          <button onClick={onCerrar} className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <X size={14} /> Cancelar
          </button>
          <button onClick={() => onConfirmar(seleccionadasArray)}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Check size={14} /> Confirmar y Sincronizar V°B°
          </button>
        </div>
      </div>
    </div>
  );
}

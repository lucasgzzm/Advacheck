import React from 'react';
import { Edit3, Send, FileSearch, Package, Receipt, CheckCircle, Flag } from 'lucide-react';

// Helper para acceder a variables CSS
const v = (name) => `var(--${name})`;

// Índice numérico de cada estado aduanero para calcular progreso
const ORDEN_ESTADOS = {
  'En Revision': 0,
  'Presentado': 1,
  'En Aforo Documental': 2,
  'En Aforo Fisico': 3,
  'Liquidado': 4,
  'Liberado': 5,
};

// Transiciones permitidas desde cada estado aduanero
const TRANSICIONES_ESTADOS = {
  'En Revision': ['Presentado'],
  'Presentado': ['En Aforo Documental'],
  'En Aforo Documental': ['En Aforo Fisico', 'Liquidado'],
  'En Aforo Fisico': ['Liquidado'],
  'Liquidado': ['Liberado'],
  'Liberado': [],
};

// Definición visual de cada paso en la timeline aduanera
const PASOS_ESTADO_ADUANERO = [
  { key: 'En Revision', label: 'En Revisión', icon: Edit3, color: v('primary') },
  { key: 'Presentado', label: 'Presentado', icon: Send, color: '#f59e0b' },
  { key: 'En Aforo Documental', label: 'Aforo Documental', icon: FileSearch, color: '#8b5cf6' },
  { key: 'En Aforo Fisico', label: 'Aforo Físico', icon: Package, color: '#f97316' },
  { key: 'Liquidado', label: 'Liquidado', icon: Receipt, color: '#06b6d4' },
  { key: 'Liberado', label: 'Liberado', icon: CheckCircle, color: v('green') },
];

export default function EstadoAduaneroTimeline({ estadoAduanero, bloqueado, onAvanzarEstado }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0', justifyContent: 'space-between', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '16px', left: '16px', right: '16px', height: '2px', background: v('card-border'), zIndex: 0, borderRadius: '2px' }} />
      <div style={{ position: 'absolute', top: '16px', left: '16px', height: '2px', background: v('green'), zIndex: 0, borderRadius: '2px', transition: 'width 0.3s', width: ORDEN_ESTADOS[estadoAduanero] ? `${(ORDEN_ESTADOS[estadoAduanero] / (ORDEN_ESTADOS.length - 1)) * 100}%` : '0%' }} />
      {PASOS_ESTADO_ADUANERO.map((paso, idx) => {
        const esActual = estadoAduanero === paso.key;
        const esAlcanzado = ORDEN_ESTADOS[estadoAduanero] >= idx;
        const sePuedeAvanzar = TRANSICIONES_ESTADOS[estadoAduanero]?.includes(paso.key) && !bloqueado && !['En Revision', 'Liberado'].includes(estadoAduanero);
        return (
          <div key={paso.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', position: 'relative', zIndex: 1, cursor: sePuedeAvanzar ? 'pointer' : 'default', opacity: esAlcanzado || esActual ? 1 : 0.4 }}
            onClick={() => sePuedeAvanzar && onAvanzarEstado(paso.key)}>
            <div style={{
              width: '34px', height: '34px', borderRadius: '50%',
              background: esActual ? paso.color : (esAlcanzado ? `${paso.color}18` : v('card-bg')),
              border: `2px solid ${esActual ? paso.color : (esAlcanzado ? `${paso.color}50` : v('card-border'))}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
              boxShadow: esActual ? `0 0 0 4px ${paso.color}25` : 'none',
            }}>
              {<paso.icon size={14} color={esActual || esAlcanzado ? paso.color : v('text-muted')} />}
            </div>
            <span style={{ fontSize: '0.65rem', fontWeight: esActual ? 700 : 500, color: esActual ? paso.color : v('text-muted'), textAlign: 'center', lineHeight: 1.2, maxWidth: '70px' }}>
              {paso.label}
            </span>
            {sePuedeAvanzar && (
              <span style={{ fontSize: '0.6rem', color: v('primary'), fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}>
                Avanzar →
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

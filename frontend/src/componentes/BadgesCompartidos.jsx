import React from 'react'
import { Lock, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react'
import { cssVar as v } from '../libreria/utilidades'

const badgeBase = (overrides) => ({
  display: 'inline-flex', alignItems: 'center', gap: '5px',
  padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem',
  fontWeight: 600, whiteSpace: 'nowrap',
  ...overrides,
})

export const StatusBadge = ({ item, record }) => {
  const data = item || record
  if (data.bloqueado) {
    return (
      <span style={badgeBase({ background: 'rgba(16,185,129,0.1)', color: v('green'), border: '1px solid rgba(16,185,129,0.2)' })}>
        <Lock size={12} /> Aprobado
      </span>
    )
  }
  if (data.estado === 'Aprobado' || data.estado === 'Aprobado (Validado)') {
    return (
      <span style={badgeBase({ background: 'rgba(16,185,129,0.08)', color: v('green'), border: '1px solid rgba(16,185,129,0.15)' })}>
        <CheckCircle size={12} /> Aprobado
      </span>
    )
  }
  return (
    <span style={badgeBase({ fontWeight: 500, background: 'rgba(100,116,139,0.08)', color: v('text-muted'), border: '1px solid rgba(100,116,139,0.15)' })}>
      {data.estado || 'En Revisión'}
    </span>
  )
}

const riskBadgeBase = (overrides) => ({
  display: 'inline-flex', alignItems: 'center', gap: '5px',
  padding: '3px 10px', borderRadius: '6px', fontSize: '0.75rem',
  fontWeight: 600, whiteSpace: 'nowrap',
  ...overrides,
})

export const RiskBadge = ({ riesgo }) => {
  switch (riesgo?.toLowerCase()) {
    case 'bajo':
      return <span style={riskBadgeBase({ background: 'rgba(16,185,129,0.08)', color: v('green'), border: '1px solid rgba(16,185,129,0.15)' })}><CheckCircle size={12} /> Bajo</span>
    case 'alto':
      return <span style={riskBadgeBase({ background: 'rgba(239,68,68,0.08)', color: v('red'), border: '1px solid rgba(239,68,68,0.15)' })}><AlertCircle size={12} /> Alto</span>
    default:
      return <span style={riskBadgeBase({ background: 'rgba(245,158,11,0.08)', color: v('yellow'), border: '1px solid rgba(245,158,11,0.15)' })}><AlertTriangle size={12} /> Medio</span>
  }
}

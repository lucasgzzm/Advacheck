// Tabla de items con clasificacion arancelaria y RRNA
import React from 'react';
import { Package, ChevronUp, ChevronDown, XCircle, ShieldAlert, CheckCircle, Upload } from 'lucide-react';
import AsistenteClasificacionArancelaria from './AsistenteClasificacionArancelaria';

import { cssVar as v } from '../libreria/utilidades';

function ItemCard({ item, idx, bloqueado, camposMod, classificationData, rrnaDocuments, onCorrection, onAiClassification, onAplicarPartida, onRrnaUpload, onRrnaRemove, sinAcordeon }) {
  const rrnaRequerida = classificationData[item.id]?.result?.rrna_requerida === true;

  return (
    
    <div key={item.id} style={sinAcordeon ? {
      padding: '10px 0',
      borderTop: `1px solid ${v('card-border')}`,
      ...(item.inconsistente ? { borderTopColor: `${v('red')}40` } : {}),
    } : {
      padding: '16px', borderRadius: '12px',
      border: item.inconsistente ? `1px solid ${v('red')}40` : `1px solid ${v('card-border')}`,
      background: item.inconsistente ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.5)',
    }}>
      
      <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '12px', color: v('text-main'), display: 'flex', alignItems: 'center', gap: '8px' }}>
        #{idx + 1}
        {item.inconsistente && <XCircle size={12} color={v('red')} />}
        <span style={{ fontWeight: 400, color: v('text-muted') }}>{item.descripcion}</span>
      </div>
      
      <div className="grid-2" style={{ gap: '12px', marginBottom: '12px' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            Cantidad
          </label>
          <input className="form-input"
            style={{
              ...(camposMod[`item_${item.id}_cantidad`] ? { borderColor: v('primary'), boxShadow: `0 0 0 1px ${v('primary')}` } : {}),
              ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
            }}
            type="number" value={item.cantidad} disabled={bloqueado}
            onChange={(e) => { if (!bloqueado) onCorrection(item.id, 'cantidad', parseFloat(e.target.value) || 0); }}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            Precio Unit. (USD)
          </label>
          <input className="form-input"
            style={{
              ...(camposMod[`item_${item.id}_precio_unitario`] ? { borderColor: v('primary'), boxShadow: `0 0 0 1px ${v('primary')}` } : {}),
              ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
            }}
            type="number" value={item.precio_unitario} disabled={bloqueado}
            onChange={(e) => { if (!bloqueado) onCorrection(item.id, 'precio_unitario', parseFloat(e.target.value) || 0); }}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            Peso Neto (kg)
          </label>
          <input className="form-input"
            style={{
              ...(camposMod[`item_${item.id}_peso_neto_kg`] ? { borderColor: v('primary'), boxShadow: `0 0 0 1px ${v('primary')}` } : {}),
              ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
            }}
            type="number" step="0.01" value={item.peso_neto_kg || ''} disabled={bloqueado}
            onChange={(e) => { if (!bloqueado) onCorrection(item.id, 'peso_neto_kg', parseFloat(e.target.value) || 0); }}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ color: v('primary') }}>Partida Sugerida</label>
          <input className="form-input" type="text" value={item.partida_sugerida} disabled
            style={{ opacity: 0.6, borderColor: `${v('primary')}40`, color: v('primary') }}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ color: v('yellow') }}>Corrección Manual</label>
          <input className="form-input"
            style={{
              ...(camposMod[`item_${item.id}_partida`] ? { borderColor: v('primary'), boxShadow: `0 0 0 1px ${v('primary')}`, color: v('yellow') } : { color: v('yellow') }),
              ...(bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
            }}
            type="text" placeholder="Ej: 8471.30.00.00" value={item.partida_corregida}
            disabled={bloqueado}
            onChange={(e) => { if (!bloqueado) onCorrection(item.id, 'partida_corregida', e.target.value); }}
          />
        </div>
      </div>
      
      <AsistenteClasificacionArancelaria
        item={item} clasificacionIA={classificationData[item.id]}
        clasificando={classificationData[item.id]?.loading}
        errorIA={classificationData[item.id]?.error}
        onSolicitarClasificacion={onAiClassification}
        onAplicarPartida={onAplicarPartida}
        onAplicarCorreccion={onAplicarPartida}
      />
      
      {rrnaRequerida && (
        <div style={{ marginTop: '12px', padding: '14px', borderRadius: '10px', background: 'rgba(239,68,68,0.06)', border: '1px dashed rgba(239,68,68,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: v('red'), fontWeight: 700, fontSize: '0.75rem', marginBottom: '8px' }}>
            <ShieldAlert size={14} /> RRNA DETECTADA
          </div>
          <p style={{ fontSize: '0.75rem', color: v('text-main'), marginBottom: '10px' }}>
            {classificationData[item.id]?.result?.rrna_detalles || 'Requiere Registro Sanitario / Certificado de Importación.'}
          </p>
          {rrnaDocuments[item.id] ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(16,185,129,0.08)', borderRadius: '8px', fontSize: '0.75rem' }}>
              <span style={{ color: v('green'), display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={12} /> {rrnaDocuments[item.id].name}
              </span>
              <button onClick={() => onRrnaRemove(item.id)}
                className="btn" style={{ padding: '4px 10px', fontSize: '0.65rem', background: 'rgba(239,68,68,0.1)', color: v('red'), border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700 }}>
                Eliminar
              </button>
            </div>
          ) : (
            <div>
              <input type="file" id={`rrna-${item.id}`} style={{ display: 'none' }}
                onChange={(e) => onRrnaUpload(item.id, e.target.files[0])}
              />
              <button onClick={() => document.getElementById(`rrna-${item.id}`).click()}
                className="btn" style={{ padding: '6px 12px', fontSize: '0.7rem', color: v('red'), borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', cursor: 'pointer', borderRadius: '8px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Upload size={12} /> Cargar Permiso Regulatorio
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ItemsTable({
  items, bloqueado, camposMod, open,
  onToggle, classificationData, rrnaDocuments,
  onCorrection, onAiClassification, onAplicarPartida,
  onRrnaUpload, onRrnaRemove,
  sinAcordeon,
}) {
  
  const content = items.length === 0 ? (
    <p style={{ color: v('text-muted'), fontSize: '0.85rem' }}>No hay ítems para mostrar.</p>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: sinAcordeon ? 0 : '16px' }}>
      {items.map((item, idx) => (
        <ItemCard key={item.id} item={item} idx={idx} bloqueado={bloqueado} camposMod={camposMod}
          classificationData={classificationData} rrnaDocuments={rrnaDocuments}
          onCorrection={onCorrection} onAiClassification={onAiClassification}
          onAplicarPartida={onAplicarPartida} onRrnaUpload={onRrnaUpload} onRrnaRemove={onRrnaRemove}
          sinAcordeon={sinAcordeon}
        />
      ))}
    </div>
  );

  if (sinAcordeon) return content;

  return (
    <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
      <div onClick={onToggle}
        style={{ padding: '16px 20px', borderBottom: `1px solid ${v('card-border')}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0, color: v('text-main'), display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Package size={16} color={v('yellow')} /> Líneas de Detalle
          <span style={{ fontSize: '0.7rem', color: v('text-muted'), fontWeight: 400 }}>({items.length} ítems)</span>
        </h3>
        {open ? <ChevronUp size={16} color={v('text-muted')} /> : <ChevronDown size={16} color={v('text-muted')} />}
      </div>
      {open && (
        <div style={{ padding: '16px 20px' }}>
          {content}
        </div>
      )}
    </div>
  );
}

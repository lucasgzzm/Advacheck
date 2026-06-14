import React, { useState, useEffect } from 'react';
import {
  Shield, ShieldCheck, ShieldAlert, FileText, CheckCircle, XCircle,
  Clock, Loader2, Upload, AlertTriangle, Building2, Scale, ExternalLink
} from 'lucide-react';
import { peticionGet, peticionPost, peticionPatch } from '../servicios/api';

import { ENTIDAD_CONFIG } from './configuraciones/entidades';

const ESTADO_CONFIG = {
  pendiente: { label: 'Pendiente', color: '#f59e0b', icon: Clock },
  aprobado: { label: 'Aprobado', color: '#22c55e', icon: CheckCircle },
  rechazado: { label: 'Rechazado', color: '#ef4444', icon: XCircle },
  no_requerido: { label: 'No Requerido', color: '#6b7280', icon: Shield },
};

// Componente que gestiona los Vistos Buenos (V°B°) regulatorios de un documento
export default function GestorVistosBuenos({ documentoId, partidas, refreshKey }) {
  const [vistosBuenos, setVistosBuenos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [fileUploading, setFileUploading] = useState(null);

  // Carga los V°B° del documento desde la API
  const fetchVistosBuenos = async () => {
    if (!documentoId) return;
    try {
      const data = await peticionGet(`/api/regulatorio/documentos/${documentoId}/vistos-buenos`);
      setVistosBuenos(data || []);
    } catch (err) {
      console.error('Error cargando V°B°:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (documentoId) fetchVistosBuenos();
  }, [documentoId, refreshKey]);

  // Sincroniza los V°B° con las partidas del documento
  const handleSincronizar = async () => {
    if (!documentoId || !partidas?.length) return;
    setSincronizando(true);
    try {
      const result = await peticionPost(`/api/regulatorio/documentos/${documentoId}/vistos-buenos/sincronizar`, {
        partidas
      });
      setVistosBuenos(result.vistos_buenos || []);
    } catch (err) {
      console.error('Error sincronizando V°B°:', err);
    } finally {
      setSincronizando(false);
    }
  };

  // Cambia el estado de un V°B° (aprobar/rechazar/reabrir)
  const handleCambiarEstado = async (vbId, nuevoEstado) => {
    try {
      await peticionPatch(`/api/regulatorio/vistos-buenos/${vbId}`, { estado: nuevoEstado });
      fetchVistosBuenos();
    } catch (err) {
      console.error('Error actualizando V°B°:', err);
    }
  };

  // Sube un archivo adjunto para un V°B°
  const handleFileUpload = async (vbId, file) => {
    if (!file) return;
    setFileUploading(vbId);
    try {
      await peticionPatch(`/api/regulatorio/vistos-buenos/${vbId}`, {
        archivo_nombre: file.name,
        estado: 'pendiente',
      });
      fetchVistosBuenos();
    } catch (err) {
      console.error('Error subiendo archivo:', err);
    } finally {
      setFileUploading(null);
    }
  };

  const total = vistosBuenos.length;
  const aprobados = vistosBuenos.filter(v => v.estado === 'aprobado' || v.estado === 'no_requerido').length;
  const pendientes = vistosBuenos.filter(v => v.estado === 'pendiente').length;
  const rechazados = vistosBuenos.filter(v => v.estado === 'rechazado').length;

  return (
    <div className="glass-panel" style={{ overflow: 'hidden' }}>
      <div style={{
        padding: '18px 24px', borderBottom: '1px solid var(--card-border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(124,58,237,0.1)' }}>
            <Shield size={20} color="#a78bfa" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
              Vistos Buenos (V°B°) Regulatorios
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {total > 0
                ? `${aprobados}/${total} aprobados · ${pendientes} pendientes ${rechazados > 0 ? `· ${rechazados} rechazados` : ''}`
                : 'Sincronice las partidas para detectar entidades regulatorias'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {total > 0 && (
            <div style={{ display: 'flex', gap: '4px' }}>
              {pendientes > 0 && (
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#f59e0b' }} title={`${pendientes} pendientes`} />
              )}
              {aprobados > 0 && (
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#22c55e' }} title={`${aprobados} aprobados`} />
              )}
              {rechazados > 0 && (
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ef4444' }} title={`${rechazados} rechazados`} />
              )}
            </div>
          )}
          {partidas?.length > 0 && (
            <button
              onClick={handleSincronizar}
              disabled={sincronizando}
              className="btn"
              style={{
                padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600,
                backgroundColor: 'rgba(124,58,237,0.08)', color: '#a78bfa',
                border: '1px solid rgba(124,58,237,0.2)', borderRadius: '8px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
              }}
            >
              {sincronizando ? <Loader2 size={12} className="spin" /> : <Scale size={12} />}
              Sincronizar con Partidas
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '30px', textAlign: 'center' }}>
          <Loader2 size={24} className="spin" color="#a78bfa" />
        </div>
      ) : vistosBuenos.length === 0 ? (
        <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          <Shield size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
          <p>No hay V°B° registrados para este documento.</p>
          <p style={{ fontSize: '0.75rem' }}>Use "Sincronizar con Partidas" para detectar automáticamente las entidades regulatorias según los códigos arancelarios.</p>
        </div>
      ) : (
        <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {vistosBuenos.map((vb) => {
            const entCfg = ENTIDAD_CONFIG[vb.entidad] || { color: '#6b7280', bg: 'rgba(107,114,128,0.08)', icono: '📄' };
            const EstCfg = ESTADO_CONFIG[vb.estado] || ESTADO_CONFIG.pendiente;
            const EstIcon = EstCfg.icon;
            return (
              <div key={vb.id} style={{
                padding: '12px 16px', borderRadius: '10px',
                border: `1px solid ${entCfg.color}30`,
                backgroundColor: entCfg.bg,
                display: 'flex', alignItems: 'center', gap: '14px',
              }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  backgroundColor: `${entCfg.color}20`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.1rem', flexShrink: 0,
                }}>
                  {entCfg.icono}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '0.85rem', color: entCfg.color }}>{vb.entidad}</strong>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: '12px',
                      backgroundColor: `${EstCfg.color}20`, color: EstCfg.color,
                      display: 'flex', alignItems: 'center', gap: '4px',
                    }}>
                      <EstIcon size={10} /> {EstCfg.label}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {vb.tipo_permiso}
                  </div>
                  {vb.archivo_nombre && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FileText size={10} /> {vb.archivo_nombre}
                    </div>
                  )}
                  {vb.observaciones && (
                    <div style={{
                      fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px',
                      padding: '4px 8px', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: '4px',
                    }}>
                      {vb.observaciones}
                    </div>
                  )}
                  {vb.estado === 'rechazado' && vb.observaciones && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--red)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertTriangle size={10} /> Observación: {vb.observaciones}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                  <input
                    type="file"
                    id={`vb-file-${vb.id}`}
                    style={{ display: 'none' }}
                    onChange={(e) => handleFileUpload(vb.id, e.target.files[0])}
                  />
                  <button
                    onClick={() => document.getElementById(`vb-file-${vb.id}`).click()}
                    className="btn"
                    style={{
                      padding: '4px 8px', fontSize: '0.7rem', fontWeight: 600,
                      backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--card-border)',
                      borderRadius: '6px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '4px',
                    }}
                    title="Adjutar documento"
                  >
                    {fileUploading === vb.id ? (
                      <Loader2 size={12} className="spin" />
                    ) : (
                      <Upload size={12} />
                    )}
                    {vb.archivo_nombre ? 'Reemplazar' : 'Adjuntar'}
                  </button>

                  {vb.estado !== 'aprobado' && (
                    <button
                      onClick={() => handleCambiarEstado(vb.id, 'aprobado')}
                      className="btn"
                      style={{
                        padding: '4px 8px', fontSize: '0.7rem', fontWeight: 700,
                        backgroundColor: 'rgba(34,197,94,0.1)', color: '#22c55e',
                        border: '1px solid rgba(34,197,94,0.3)', borderRadius: '6px', cursor: 'pointer',
                      }}
                    >
                      Aprobar
                    </button>
                  )}
                  {vb.estado !== 'rechazado' && vb.estado !== 'no_requerido' && (
                    <button
                      onClick={() => handleCambiarEstado(vb.id, 'rechazado')}
                      className="btn"
                      style={{
                        padding: '4px 8px', fontSize: '0.7rem', fontWeight: 700,
                        backgroundColor: 'rgba(239,68,68,0.08)', color: '#ef4444',
                        border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', cursor: 'pointer',
                      }}
                    >
                      Rechazar
                    </button>
                  )}
                  {(vb.estado === 'rechazado' || vb.estado === 'no_requerido') && (
                    <button
                      onClick={() => handleCambiarEstado(vb.id, 'pendiente')}
                      className="btn"
                      style={{
                        padding: '4px 8px', fontSize: '0.7rem', fontWeight: 700,
                        backgroundColor: 'rgba(245,158,11,0.08)', color: '#f59e0b',
                        border: '1px solid rgba(245,158,11,0.2)', borderRadius: '6px', cursor: 'pointer',
                      }}
                    >
                      Reabrir
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .vb-fade-in { animation: vbFadeIn 0.3s ease-out; }
        @keyframes vbFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

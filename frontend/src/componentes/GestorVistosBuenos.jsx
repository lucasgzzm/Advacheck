// Gestor de vistos buenos regulatorios con carga de documentos
import React, { useState, useEffect } from 'react';
import {
  Shield, ShieldCheck, ShieldAlert, FileText, CheckCircle, XCircle,
  Clock, Loader2, Upload, AlertTriangle, Building2, Scale, ExternalLink
} from 'lucide-react';
import { peticionGet, peticionPost, peticionPatch } from '../servicios/api';

import { ENTIDAD_CONFIG } from './configuraciones/entidades';
import styles from '../../css/GestorVistosBuenos.module.css';

const ESTADO_CONFIG = {
  pendiente: { label: 'Pendiente', color: '#f59e0b', icon: Clock },
  aprobado: { label: 'Aprobado', color: '#22c55e', icon: CheckCircle },
  rechazado: { label: 'Rechazado', color: '#ef4444', icon: XCircle },
  no_requerido: { label: 'No Requerido', color: '#6b7280', icon: Shield },
};

export default function GestorVistosBuenos({ documentoId, partidas, refreshKey, onPermisoValidado }) {
  const [vistosBuenos, setVistosBuenos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [fileUploading, setFileUploading] = useState(null);

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

  const handleCambiarEstado = async (vbId, nuevoEstado) => {
    try {
      await peticionPatch(`/api/regulatorio/vistos-buenos/${vbId}`, { estado: nuevoEstado });
      fetchVistosBuenos();
    } catch (err) {
      console.error('Error actualizando V°B°:', err);
    }
  };

  const handleUploadPermiso = async (vbId, file) => {
    if (!file) return;
    setFileUploading(vbId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('vb_id', vbId);
      const result = await peticionPost(`/api/documentos/${documentoId}/validar-permiso`, formData);
      if (onPermisoValidado && result.prevalidacion) {
        onPermisoValidado(result.prevalidacion);
      }
      fetchVistosBuenos();
    } catch (err) {
      console.error('Error subiendo permiso:', err);
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
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>
            <Shield size={20} color="#a78bfa" />
          </div>
          <div>
            <h3 className={styles.headerTitle}>
              Vistos Buenos (V°B°) Regulatorios
            </h3>
            <p className={styles.headerSubtitle}>
              {total > 0
                ? `${aprobados}/${total} aprobados · ${pendientes} pendientes ${rechazados > 0 ? `· ${rechazados} rechazados` : ''}`
                : 'Sincronice las partidas para detectar entidades regulatorias'}
            </p>
          </div>
        </div>
        <div className={styles.headerActions}>
          {total > 0 && (
            <div style={{ display: 'flex', gap: '4px' }}>
              {pendientes > 0 && <div className={styles.statusDot} style={{ backgroundColor: '#f59e0b' }} title={`${pendientes} pendientes`} />}
              {aprobados > 0 && <div className={styles.statusDot} style={{ backgroundColor: '#22c55e' }} title={`${aprobados} aprobados`} />}
              {rechazados > 0 && <div className={styles.statusDot} style={{ backgroundColor: '#ef4444' }} title={`${rechazados} rechazados`} />}
            </div>
          )}
          {partidas?.length > 0 && (
            <button onClick={handleSincronizar} disabled={sincronizando} className={`btn ${styles.syncBtn}`}>
              {sincronizando ? <Loader2 size={12} className="spin" /> : <Scale size={12} />}
              Sincronizar con Partidas
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className={styles.loadingState}>
          <Loader2 size={24} className="spin" color="#a78bfa" />
        </div>
      ) : vistosBuenos.length === 0 ? (
        <div className={styles.emptyState}>
          <Shield size={32} className={styles.emptyIcon} />
          <p>No hay V°B° registrados para este documento.</p>
          <p className={styles.emptySubtext}>Use &quot;Sincronizar con Partidas&quot; para detectar automáticamente las entidades regulatorias según los códigos arancelarios.</p>
        </div>
      ) : (
        <div className={styles.list}>
          {vistosBuenos.map((vb) => {
            const entCfg = ENTIDAD_CONFIG[vb.entidad] || { color: '#6b7280', bg: 'rgba(107,114,128,0.08)', icono: '📄' };
            const EstCfg = ESTADO_CONFIG[vb.estado] || ESTADO_CONFIG.pendiente;
            const EstIcon = EstCfg.icon;
            return (
              <div key={vb.id} className={styles.card} style={{
                border: `1px solid ${entCfg.color}30`,
                backgroundColor: entCfg.bg,
              }}>
                <div className={styles.cardIcon} style={{ backgroundColor: `${entCfg.color}20` }}>
                  {entCfg.icono}
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.cardHeader}>
                    <strong className={styles.entityName} style={{ color: entCfg.color }}>{vb.entidad}</strong>
                    <span className={styles.statusBadge} style={{ backgroundColor: `${EstCfg.color}20`, color: EstCfg.color }}>
                      <EstIcon size={10} /> {EstCfg.label}
                    </span>
                  </div>
                  <div className={styles.permisoType}>{vb.tipo_permiso}</div>
                  {vb.archivo_nombre && (
                    <div className={styles.archivoRow}>
                      <FileText size={10} /> {vb.archivo_nombre}
                    </div>
                  )}
                  {vb.observaciones && (
                    <div className={styles.observacionesBubble}>
                      {vb.observaciones}
                    </div>
                  )}
                  {vb.estado === 'rechazado' && vb.observaciones && (
                    <div className={styles.rechazoWarning}>
                      <AlertTriangle size={10} /> Observación: {vb.observaciones}
                    </div>
                  )}
                </div>

                <div className={styles.cardActions}>
                  <input type="file" id={`vb-file-${vb.id}`} className={styles.hiddenInput} onChange={(e) => handleUploadPermiso(vb.id, e.target.files[0])} />
                  <button onClick={() => document.getElementById(`vb-file-${vb.id}`).click()} className={`btn ${styles.actionBtn} ${styles.uploadBtn}`} title="Adjutar documento">
                    {fileUploading === vb.id ? <Loader2 size={12} className="spin" /> : <Upload size={12} />}
                    {vb.archivo_nombre ? 'Reemplazar' : 'Adjuntar'}
                  </button>

                  {vb.estado !== 'aprobado' && (
                    <button onClick={() => handleCambiarEstado(vb.id, 'aprobado')} className={`btn ${styles.actionBtn} ${styles.approveBtn}`}>
                      Aprobar
                    </button>
                  )}
                  {vb.estado !== 'rechazado' && vb.estado !== 'no_requerido' && (
                    <button onClick={() => handleCambiarEstado(vb.id, 'rechazado')} className={`btn ${styles.actionBtn} ${styles.rejectBtn}`}>
                      Rechazar
                    </button>
                  )}
                  {(vb.estado === 'rechazado' || vb.estado === 'no_requerido') && (
                    <button onClick={() => handleCambiarEstado(vb.id, 'pendiente')} className={`btn ${styles.actionBtn} ${styles.reopenBtn}`}>
                      Reabrir
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

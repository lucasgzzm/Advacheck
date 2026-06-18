// Historial global de facturas para administradores con filtros avanzados
import React, { useState, useEffect } from 'react';
import { API_BASE, peticionGet, peticionDelete } from '../servicios/api';
import { Layers, Search, FileText, RefreshCw, User as UserIcon, Eye, Trash2, X, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import Toast from '../componentes/Toast';
import { cssVar as v } from '../libreria/utilidades';
import { StatusBadge, RiskBadge } from '../componentes/BadgesCompartidos';
import styles from '../../css/Historial.module.css';

const GlobalHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [docToDelete, setDocToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  const fetchGlobalHistory = async () => {
    try {
      setLoading(true);
      const data = await peticionGet('/api/admin/documents');
      setHistory(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!docToDelete) return;
    setIsDeleting(true);
    try {
      await peticionDelete(`/api/documentos/${docToDelete.id}`);
      setHistory(prev => prev.filter(item => item.id !== docToDelete.id));
    } catch (error) {
      setToast({ mensaje: error.message || 'Error de conexión al servidor.', tipo: 'error' });
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setDocToDelete(null);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    fetch(`${API_BASE}/api/admin/documents`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(r => { if (!r.ok) throw new Error('Error al cargar historial global'); return r.json(); })
      .then(data => { setHistory(data); })
      .catch(err => { if (err.name !== 'AbortError') setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const filtered = history.filter(h =>
    h.nombre_archivo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    h.proveedor?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={`fade-in ${styles.pageContainer}`}>
      
      <div className={styles.headerSection}>
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.pageTitle}>
              <div className={styles.headerTitleGroup}>
                <div className={styles.headerIconBox}>
                  <Layers size={20} color={v('primary')} />
                </div>
                Historial Maestro
              </div>
            </h1>
            <p className={styles.pageSubtitle}>{history.length} documento{history.length !== 1 ? 's' : ''} procesado{history.length !== 1 ? 's' : ''} por todos los operadores</p>
          </div>
          <button onClick={fetchGlobalHistory} className={styles.refreshBtn}>
            <RefreshCw size={14} /> Actualizar
          </button>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        
        <div className={styles.filterBar}>
          <div className={styles.searchRow}>
            <div className={styles.searchWrapper}>
              <Search size={16} color={v('text-muted')} className={styles.searchIcon} />
              <input type="text" placeholder="Buscar por documento o proveedor..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className={`form-input ${styles.searchInput}`} />
            </div>
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className={styles.clearBtn}>
                <X size={16} />
              </button>
            )}
            <span className={styles.resultCount}>
              {filtered.length} de {history.length}
            </span>
          </div>
        </div>

        {loading ? (
          <div className={styles.loadingState}><RefreshCw size={24} className="spin" style={{ marginBottom: '12px' }} /><br />Cargando...</div>
        ) : error ? (
          <div className={styles.errorState}>
            <AlertCircle size={32} className={styles.emptyIcon} />
            <p style={{ fontSize: '0.85rem' }}>{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <FileText size={40} className={styles.emptyIcon} />
            <h3 className={styles.emptyTitle}>Sin documentos</h3>
            <p className={styles.emptyText}>Aún no se han procesado documentos.</p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead className={styles.tableHead}>
                <tr>
                  {['Fecha', 'Analista', 'Documento', 'Proveedor', 'Total CIF', 'Estado', 'Riesgo', ''].map(h => (
                    <th key={h} className={styles.tableCell} style={{ textAlign: h === '' ? 'center' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, i) => (
                  <tr key={item.id} style={{
                    borderBottom: `1px solid ${v('card-border')}`,
                    background: i % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent',
                    transition: 'background 0.15s',
                  }}>
                    <td className={styles.tableCellMuted}>{new Date(item.fecha_analisis).toLocaleDateString('es-CL', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className={styles.tableCellBold} style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500, color: v('text-main') }}>
                        <UserIcon size={14} color={v('primary')} style={{ opacity: 0.6 }} />
                        {item.usuario_nombre || 'N/A'}
                      </div>
                    </td>
                    <td className={styles.tableCellBold}>
                      <div className={styles.docNameCell}>
                        <FileText size={15} color={v('primary')} className={styles.docIcon} />
                        <span className={styles.docName}>{item.nombre_archivo}</span>
                      </div>
                    </td>
                    <td className={styles.tableCellBold}>{item.proveedor || <span className={styles.proveedorItalic}>Sin proveedor</span>}</td>
                    <td className={styles.tableCellBold} style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>${item.total_cif?.toLocaleString()}</td>
                    <td className={styles.tableCell}><StatusBadge item={item} /></td>
                    <td className={styles.tableCell}><RiskBadge riesgo={item.riesgo} /></td>
                    <td className={styles.tableCellCenter}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button onClick={() => navigate(`/factura/${item.id}/editar`, { state: { historyData: item, prevalidacion: item.prevalidacion_resultado } })}
                          className={`${styles.actionBtn} ${styles.actionBtnDefault}`}
                          title="Ver detalle">
                          <Eye size={15} />
                        </button>
                        <button onClick={() => { setDocToDelete(item); setShowDeleteModal(true); }}
                          className={`${styles.actionBtn} ${styles.actionBtnRed}`}
                          style={{ opacity: 0.7 }}
                          title="Eliminar documento">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showDeleteModal && docToDelete && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContent} ${styles.modalTextCenter}`}>
            <div className={`${styles.modalIconCircle} ${styles.lockIconRed} ${styles.modalIconCenter}`}>
              <Trash2 size={28} color={v('red')} />
            </div>
            <h2 className={styles.modalTitle}>Eliminar documento</h2>
            <p className={styles.modalDesc}>
              Vas a borrar <strong>{docToDelete.nombre_archivo}</strong> de todos los operadores. Esta acción es irreversible.
            </p>
            <div className={styles.modalActions}>
              <button onClick={() => { setShowDeleteModal(false); setDocToDelete(null); }} className={styles.btnCancel}>Cancelar</button>
              <button onClick={handleDelete} disabled={isDeleting} className={styles.btnDanger}>
                {isDeleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
      <Toast mensaje={toast?.mensaje} tipo={toast?.tipo} onCerrar={() => setToast(null)} />
    </div>
  );
};

export default GlobalHistory;

// Historial de facturas del usuario con filtros y paginacion
import React, { useState, useEffect } from 'react';
import { API_BASE, peticionGet } from '../servicios/api';
import { History as HistoryIcon, Search, AlertCircle, FileText, Trash2, RefreshCw, Lock, Eye, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import Toast from '../componentes/Toast';
import { cssVar as v } from '../libreria/utilidades';
import { StatusBadge, RiskBadge } from '../componentes/BadgesCompartidos';
import styles from '../../css/Historial.module.css';

const History = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const navigate = useNavigate();

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [docToDelete, setDocToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [blockedDocName, setBlockedDocName] = useState('');
  const [toast, setToast] = useState(null);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const data = await peticionGet('/api/documentos/historial');
      setHistory(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    fetch(`${API_BASE}/api/documentos/historial`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(r => { if (!r.ok) throw new Error('Error al cargar historial'); return r.json(); })
      .then(data => { setHistory(data); setError(null); })
      .catch(err => { if (err.name !== 'AbortError') setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const handleDelete = async () => {
    if (!docToDelete) return;
    try {
      setIsDeleting(true);
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/documentos/${docToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setHistory(prev => prev.filter(item => item.id !== docToDelete.id));
        setShowDeleteModal(false);
        setDocToDelete(null);
      } else if (response.status === 409) {
        await response.json().catch(() => ({}));
        setBlockedDocName(docToDelete?.nombre_archivo || '');
        setShowDeleteModal(false);
        setShowBlockedModal(true);
        setDocToDelete(null);
      } else {
        const err = await response.json().catch(() => ({}));
        setToast({ mensaje: err.detail || "No se pudo eliminar el documento.", tipo: 'error' });
      }
    } catch (error) {
       setToast({ mensaje: "Error de conexión al servidor.", tipo: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  const FILTROS_ESTADO = ['', 'En Revisión', 'Aprobado', 'Pendiente Aprobación Admin', 'En Espera'];
  const filteredHistory = history.filter(h => {
    const matchSearch = h.nombre_archivo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (h.numero_factura || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (h.proveedor || '').toLowerCase().includes(searchTerm.toLowerCase());
    const estadoDisplay = h.bloqueado ? 'Aprobado' : (h.estado || 'En Revisión');
    const matchEstado = !filterEstado || estadoDisplay === filterEstado;
    return matchSearch && matchEstado;
  });

  return (
    <div className={`fade-in ${styles.pageContainer}`}>
      
      {showBlockedModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={`${styles.modalIconCircle} ${styles.lockIconGreen}`} style={{ marginBottom: '20px' }}>
              <Lock size={28} color={v('green')} />
            </div>
            <h2 className={styles.modalTitle}>Documento bloqueado</h2>
            <p className={styles.modalDesc} style={{ marginBottom: '24px', lineHeight: 1.6 }}>
              <strong>{blockedDocName}</strong> está en estado <strong style={{ color: v('green') }}>Aprobado</strong> y no puede eliminarse. Solo un administrador puede eliminarlo desde el panel de auditoría global.
            </p>
            <button onClick={() => setShowBlockedModal(false)} className={styles.btnPrimaryModal}>Entendido</button>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContent} ${styles.modalTextCenter}`}>
            <div className={`${styles.modalIconCircle} ${styles.lockIconRed} ${styles.modalIconCenter}`}>
              <Trash2 size={28} color={v('red')} />
            </div>
            <h2 className={styles.modalTitle}>Eliminar documento</h2>
            <p className={styles.modalDesc}>
              Vas a borrar <strong>{docToDelete?.nombre_archivo}</strong>. Esta acción es irreversible.
            </p>
            <div className={styles.modalActions}>
              <button onClick={() => setShowDeleteModal(false)} className={styles.btnCancel}>Cancelar</button>
              <button onClick={handleDelete} disabled={isDeleting} className={styles.btnDanger}
                style={{ cursor: isDeleting ? 'not-allowed' : 'pointer' }}>
                {isDeleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.headerSection}>
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.pageTitle}>
              <div className={styles.headerTitleGroup}>
                <div className={styles.headerIconBox}>
                  <HistoryIcon size={20} color={v('primary')} />
                </div>
                Historial de documentos
              </div>
            </h1>
            <p className={styles.pageSubtitle}>{history.length} documento{history.length !== 1 ? 's' : ''} procesado{history.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={fetchHistory} className={styles.refreshBtn}>
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
              {filteredHistory.length} de {history.length}
            </span>
          </div>
          <div className={styles.filterChips}>
            {FILTROS_ESTADO.map(est => (
              <button key={est} onClick={() => setFilterEstado(est)}
                className={`${styles.filterChip} ${filterEstado === est ? styles.filterChipActive : styles.filterChipInactive}`}>
                {est || 'Todos'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className={styles.loadingState}>Cargando...</div>
        ) : error ? (
          <div className={styles.errorState}>
            <AlertCircle size={32} className={styles.emptyIcon} />
            <p style={{ fontSize: '0.85rem' }}>{error}</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className={styles.emptyState}>
            <FileText size={40} className={styles.emptyIcon} />
            <h3 className={styles.emptyTitle}>Sin documentos</h3>
            <p className={styles.emptyText}>Escanea documentos desde el <Link to="/" style={{ color: v('primary'), textDecoration: 'none' }}>Dashboard</Link>.</p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead className={styles.tableHead}>
                <tr>
                  {['Fecha', 'Documento', 'N° Factura', 'Total CIF', 'Estado', 'Riesgo', ''].map(h => (
                    <th key={h} className={styles.tableCell} style={{ textAlign: h === '' ? 'center' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((record, i) => (
                  <tr key={record.id} style={{
                    borderBottom: `1px solid ${v('card-border')}`,
                    background: i % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent',
                    transition: 'background 0.15s',
                  }}>
                    <td className={styles.tableCellMuted}>{new Date(record.fecha_analisis).toLocaleDateString('es-CL', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className={styles.tableCellBold}>
                      <div className={styles.docNameCell}>
                        <FileText size={15} color={v('primary')} className={styles.docIcon} />
                        <span className={styles.docName}>{record.nombre_archivo}</span>
                      </div>
                    </td>
                    <td className={styles.tableCellBold}>{record.numero_factura || <span className={styles.proveedorItalic}>Sin factura</span>}</td>
                    <td className={styles.tableCellBold} style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>${record.total_cif?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</td>
                    <td className={styles.tableCell}><StatusBadge record={record} /></td>
                    <td className={styles.tableCell}><RiskBadge riesgo={record.riesgo} /></td>
                    <td className={styles.tableCellCenter}>
                      <button onClick={() => navigate(`/factura/${record.id}/editar`, { state: { historyData: record, prevalidacion: record.prevalidacion_resultado } })}
                        className={`${styles.actionBtn} ${styles.actionBtnDefault} ${styles.actionBtnGap}`}
                        title="Ver detalle">
                        <Eye size={15} />
                      </button>
                      {record.bloqueado ? (
                        <span className={styles.actionBtnGreen} title="Documento bloqueado">
                          <Lock size={14} />
                        </span>
                      ) : (
                        <button onClick={() => { setDocToDelete(record); setShowDeleteModal(true); }}
                          className={`${styles.actionBtn} ${styles.actionBtnRed}`}
                          title="Eliminar documento">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Toast mensaje={toast?.mensaje} tipo={toast?.tipo} onCerrar={() => setToast(null)} />
    </div>
  );
};

export default History;

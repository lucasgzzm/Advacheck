import React, { useState, useEffect, useMemo } from 'react';
import { API_BASE } from '../servicios/api';
import { Activity, Search, RefreshCw, Clock, User, ShieldCheck, Trash2, FileCheck, LogIn, Shield } from 'lucide-react';

import styles from '../../css/LogAuditoria.module.css';

const ACTION_CONFIG = {
  'Inicio de Sesion':               { color: 'var(--primary)',  bg: 'rgba(59,130,246,0.1)',   icon: LogIn },
  'Analisis de Documento':          { color: '#8b5cf6',         bg: 'rgba(139,92,246,0.1)',   icon: Activity },
  'Aprobacion de Documento':        { color: 'var(--green)',    bg: 'rgba(34,197,94,0.1)',    icon: FileCheck },
  'Solicitud de Revision':          { color: '#f59e0b',         bg: 'rgba(245,158,11,0.1)',   icon: ShieldCheck },
  'Eliminacion de Documento':       { color: 'var(--red)',      bg: 'rgba(239,68,68,0.1)',    icon: Trash2 },
  'Cambio de Estado de Usuario':    { color: '#f59e0b',         bg: 'rgba(245,158,11,0.1)',   icon: Shield },
  'Cambio de Rol de Usuario':       { color: '#8b5cf6',         bg: 'rgba(139,92,246,0.1)',   icon: Shield },
};

const DEFAULT_CONFIG = { color: 'var(--text-muted)', bg: 'rgba(0,0,0,0.05)', icon: Activity };

const ActionBadge = ({ accion }) => {
  const cfg = ACTION_CONFIG[accion] || DEFAULT_CONFIG;
  const Icon = cfg.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem',
      fontWeight: 600, whiteSpace: 'nowrap',
      backgroundColor: cfg.bg, color: cfg.color,
    }}>
      <Icon size={13} />
      {accion}
    </span>
  );
};

const AuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAccion, setFilterAccion] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/admin/auditoria`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Error al conectar con la bitácora de auditoría.');
      }
      const data = await response.json();
      setLogs(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  const accionesUnicas = useMemo(() =>
    [...new Set(logs.map(l => l.accion))].sort(),
    [logs]
  );

  const filteredLogs = useMemo(() => logs.filter(l => {
    const matchSearch =
      l.accion.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.detalles || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.usuario_nombre || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchFilter = filterAccion === '' || l.accion === filterAccion;
    return matchSearch && matchFilter;
  }), [logs, searchTerm, filterAccion]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterAccion]);

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(start, start + itemsPerPage);
  }, [filteredLogs, currentPage]);

  return (
    <div className={`fade-in ${styles.pageContainer}`}>
      
      <header className={styles.headerSection}>
        <div>
          <h1 className={styles.pageTitle}>
            <div className={styles.headerTitleGroup}>
              <div className={styles.headerIconBox}>
                <Activity size={20} color="var(--primary)" />
              </div>
              Trazabilidad y Auditoría
            </div>
          </h1>
          <p className={styles.pageSubtitle}>
            Bitácora inmutable de todas las acciones realizadas en la plataforma.
          </p>
        </div>
        <button onClick={fetchLogs} className="btn btn-secondary" disabled={loading}>
          <RefreshCw size={18} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          {loading ? 'Actualizando...' : 'Sincronizar Logs'}
        </button>
      </header>

      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>

        <div className={styles.filterBar}>
          
          <div className={styles.searchWrapper}>
            <Search size={16} color="var(--text-muted)" className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Buscar usuario, acción, detalles..."
              className={`form-input ${styles.searchInput}`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className={`form-input ${styles.filterSelect}`}
            value={filterAccion}
            onChange={(e) => setFilterAccion(e.target.value)}
          >
            <option value="">Todas las acciones</option>
            {accionesUnicas.map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          <span className={styles.eventCount}>
            {filteredLogs.length} evento{filteredLogs.length !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? (
          <div className={styles.loadingState}>
            <RefreshCw size={32} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
            <p className={styles.loadingText}>Cargando bitácora...</p>
          </div>
        ) : error ? (
          <div className={styles.errorState}>
            <p className={styles.errorTitle}>No se pudo cargar la auditoría</p>
            <p className={styles.errorDetail}>{error}</p>
            <button onClick={fetchLogs} className="btn btn-primary" style={{ marginTop: '16px' }}>
              <RefreshCw size={16} /> Reintentar
            </button>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className={styles.emptyState}>
            <Activity size={48} className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>No hay eventos que coincidan con los filtros.</p>
            {(searchTerm || filterAccion) && (
              <button onClick={() => { setSearchTerm(''); setFilterAccion(''); }} className="btn btn-secondary" style={{ marginTop: '12px' }}>
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead className={styles.tableHead}>
                <tr>
                  <th className={styles.tableHeaderCell}>Fecha y Hora</th>
                  <th className={styles.tableHeaderCell}>Analista</th>
                  <th className={styles.tableHeaderCell}>Tipo de Acción</th>
                  <th className={styles.tableHeaderCell}>Detalles del Evento</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.map((log, i) => (
                  <tr key={log.id} className={styles.tableRow} style={{
                    borderBottom: '1px solid var(--card-border)',
                    background: i % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent',
                  }}>
                    
                    <td className={`${styles.tableCell} ${styles.dateCell}`}>
                      <div className={styles.dateGroup}>
                        <Clock size={14} />
                        {new Date(log.fecha_accion).toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' })}
                        <span className={styles.timePart}>
                          {new Date(log.fecha_accion).toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}
                        </span>
                      </div>
                    </td>

                    <td className={`${styles.tableCell} ${styles.analystCell}`}>
                      <div className={styles.analystGroup}>
                        <div className={styles.analystAvatar}>
                          <User size={14} color="var(--primary)" />
                        </div>
                        <span className={styles.analystName}>
                          {log.usuario_nombre}
                        </span>
                      </div>
                    </td>

                    <td className={styles.tableCell}>
                      <ActionBadge accion={log.accion} />
                    </td>

                    <td className={`${styles.tableCell} ${styles.detailsCell}`}>
                      {log.detalles || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && filteredLogs.length > itemsPerPage && (
          <div className={styles.paginationBar}>
            <span className={styles.paginationInfo}>
              Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredLogs.length)} de {filteredLogs.length} eventos
            </span>
            <div className={styles.paginationControls}>
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                disabled={currentPage === 1}
                className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                Anterior
              </button>
              <span className={styles.pageIndicator}>
                {currentPage} / {totalPages}
              </span>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                disabled={currentPage === totalPages}
                className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default AuditLog;

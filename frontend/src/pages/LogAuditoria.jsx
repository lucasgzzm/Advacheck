import React, { useState, useEffect, useMemo } from 'react';
import { Activity, Search, RefreshCw, Clock, User, ShieldCheck, Trash2, FileCheck, LogIn, Shield } from 'lucide-react';

// Configuración de badges por tipo de acción — fácil de extender
const ACTION_CONFIG = {
  'Inicio de Sesión':          { color: 'var(--primary)',  bg: 'rgba(59,130,246,0.1)',   icon: LogIn },
  'Análisis de Documento':     { color: '#8b5cf6',         bg: 'rgba(139,92,246,0.1)',   icon: Activity },
  'Aprobación de Documento':   { color: 'var(--green)',    bg: 'rgba(34,197,94,0.1)',    icon: FileCheck },
  'Solicitud de Revisión':     { color: '#f59e0b',         bg: 'rgba(245,158,11,0.1)',   icon: ShieldCheck },
  'Eliminación de Documento':  { color: 'var(--red)',      bg: 'rgba(239,68,68,0.1)',    icon: Trash2 },
  'Cambio de Estado de Usuario':{ color: '#f59e0b',        bg: 'rgba(245,158,11,0.1)',   icon: Shield },
  'Cambio de Rol de Usuario':  { color: '#8b5cf6',         bg: 'rgba(139,92,246,0.1)',   icon: Shield },
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
      const response = await fetch('http://127.0.0.1:8000/api/admin/auditoria', {
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

  // Lista única de acciones para el filtro
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

  // Resetear paginación al filtrar
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterAccion]);

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(start, start + itemsPerPage);
  }, [filteredLogs, currentPage]);

  return (
    <div className="fade-in">
      {/* ── Encabezado ────────────────────────────────── */}
      <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-1px', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Activity size={32} color="var(--primary)" />
            Trazabilidad y Auditoría
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px', fontSize: '1.05rem' }}>
            Bitácora inmutable de todas las acciones realizadas en la plataforma.
          </p>
        </div>
        <button onClick={fetchLogs} className="btn btn-secondary" disabled={loading}>
          <RefreshCw size={18} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          {loading ? 'Actualizando...' : 'Sincronizar Logs'}
        </button>
      </header>

      {/* ── Tabla principal ────────────────────────────── */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>

        {/* Barra de filtros */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', backgroundColor: 'rgba(0,0,0,0.02)' }}>
          {/* Buscador */}
          <div style={{ position: 'relative', flex: '1', minWidth: '220px', maxWidth: '380px' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Buscar usuario, acción, detalles..."
              className="form-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', paddingLeft: '38px', fontSize: '0.9rem' }}
            />
          </div>

          {/* Filtro por tipo de acción */}
          <select
            className="form-input"
            value={filterAccion}
            onChange={(e) => setFilterAccion(e.target.value)}
            style={{ fontSize: '0.9rem', minWidth: '200px', flex: '0 0 auto' }}
          >
            <option value="">Todas las acciones</option>
            {accionesUnicas.map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          {/* Contador */}
          <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {filteredLogs.length} evento{filteredLogs.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Contenido */}
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <RefreshCw size={32} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Cargando bitácora...</p>
          </div>
        ) : error ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--red)' }}>
            <p style={{ fontWeight: 600, marginBottom: '8px' }}>No se pudo cargar la auditoría</p>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{error}</p>
            <button onClick={fetchLogs} className="btn btn-primary" style={{ marginTop: '16px' }}>
              <RefreshCw size={16} /> Reintentar
            </button>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Activity size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
            <p style={{ fontWeight: 600 }}>No hay eventos que coincidan con los filtros.</p>
            {(searchTerm || filterAccion) && (
              <button onClick={() => { setSearchTerm(''); setFilterAccion(''); }} className="btn btn-secondary" style={{ marginTop: '12px' }}>
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)', borderBottom: '2px solid var(--card-border)' }}>
                  <th style={{ padding: '14px 24px', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>Fecha y Hora</th>
                  <th style={{ padding: '14px 24px', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>Analista</th>
                  <th style={{ padding: '14px 24px', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>Tipo de Acción</th>
                  <th style={{ padding: '14px 24px', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Detalles del Evento</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.map((log) => (
                  <tr
                    key={log.id}
                    style={{ borderBottom: '1px solid var(--card-border)', transition: 'background-color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--primary-light)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    {/* Fecha */}
                    <td style={{ padding: '14px 24px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        <Clock size={14} />
                        {new Date(log.fecha_accion).toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' })}
                        <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                          {new Date(log.fecha_accion).toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}
                        </span>
                      </div>
                    </td>

                    {/* Usuario */}
                    <td style={{ padding: '14px 24px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <User size={14} color="var(--primary)" />
                        </div>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                          {log.usuario_nombre}
                        </span>
                      </div>
                    </td>

                    {/* Acción (badge) */}
                    <td style={{ padding: '14px 24px', verticalAlign: 'middle' }}>
                      <ActionBadge accion={log.accion} />
                    </td>

                    {/* Detalles */}
                    <td style={{ padding: '14px 24px', verticalAlign: 'middle', fontSize: '0.88rem', color: 'var(--text-muted)', maxWidth: '420px' }}>
                      {log.detalles || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Controles de Paginación ────────────────────── */}
        {!loading && !error && filteredLogs.length > itemsPerPage && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-color)' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredLogs.length)} de {filteredLogs.length} eventos
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                disabled={currentPage === 1}
                className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                Anterior
              </button>
              <span style={{ display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: '0.9rem', fontWeight: 600 }}>
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

      {/* Inline spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default AuditLog;

import React, { useState, useEffect } from 'react';
import { API_BASE } from '../services/api';
import { Download, History as HistoryIcon, Search, AlertCircle, FileText, CheckCircle, AlertTriangle, Trash2, RefreshCw, Lock, Unlock, Eye, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { cssVar as v } from '../lib/utils';

// Componente principal: muestra el historial de documentos del usuario actual
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

  // Obtiene el historial de documentos del usuario desde el servidor
  const fetchHistory = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/documentos/historial`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Error al conectar con la bitácora del servidor.');
      const data = await response.json();
      setHistory(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Elimina un documento del historial
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
        alert(err.detail || "No se pudo eliminar el documento.");
      }
    } catch (error) {
       alert("Error de conexión al servidor.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Renderiza una insignia de estado (aprobado, bloqueado, en revisión)
  const StatusBadge = ({ record }) => {
    if (record.bloqueado) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap', background: 'rgba(16,185,129,0.1)', color: v('green'), border: '1px solid rgba(16,185,129,0.2)' }}>
          <Lock size={12} /> Aprobado
        </span>
      );
    }
    if (record.estado === 'Aprobado' || record.estado === 'Aprobado (Validado)') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap', background: 'rgba(16,185,129,0.08)', color: v('green'), border: '1px solid rgba(16,185,129,0.15)' }}>
          <CheckCircle size={12} /> Aprobado
        </span>
      );
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 500, whiteSpace: 'nowrap', background: 'rgba(100,116,139,0.08)', color: v('text-muted'), border: '1px solid rgba(100,116,139,0.15)' }}>
        {record.estado || 'En Revisión'}
      </span>
    );
  };

  // Renderiza una insignia de nivel de riesgo (bajo, medio, alto)
  const RiskBadge = ({ riesgo }) => {
    switch(riesgo?.toLowerCase()) {
      case 'bajo':
        return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', background: 'rgba(16,185,129,0.08)', color: v('green'), border: '1px solid rgba(16,185,129,0.15)' }}><CheckCircle size={12} /> Bajo</span>;
      case 'alto':
        return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', background: 'rgba(239,68,68,0.08)', color: v('red'), border: '1px solid rgba(239,68,68,0.15)' }}><AlertCircle size={12} /> Alto</span>;
      default:
        return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', background: 'rgba(245,158,11,0.08)', color: v('yellow'), border: '1px solid rgba(245,158,11,0.15)' }}><AlertTriangle size={12} /> Medio</span>;
    }
  };

  // Exporta el historial filtrado a un archivo CSV
  const handleExportCSV = () => {
    if (filteredHistory.length === 0) return;
    const headers = ['Fecha', 'Documento', 'Proveedor', 'Total CIF', 'Estado', 'Riesgo'];
    const rows = filteredHistory.map(h => [
      new Date(h.fecha_analisis).toLocaleDateString('es-CL'),
      h.nombre_archivo,
      h.proveedor || '',
      h.total_cif?.toFixed(2) || '0.00',
      h.bloqueado ? 'Aprobado (Bloqueado)' : (h.estado || 'En Revisión'),
      h.riesgo || '',
    ]);
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `WebCheck_Historial_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const FILTROS_ESTADO = ['', 'En Revisión', 'Aprobado', 'Pendiente Aprobación Admin', 'En Espera'];
  const filteredHistory = history.filter(h => {
    const matchSearch = h.nombre_archivo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (h.proveedor || '').toLowerCase().includes(searchTerm.toLowerCase());
    const estadoDisplay = h.bloqueado ? 'Aprobado' : (h.estado || 'En Revisión');
    const matchEstado = !filterEstado || estadoDisplay === filterEstado;
    return matchSearch && matchEstado;
  });

  // Retorna el estilo de fila alternado para la tabla
  const rowStyle = (isEven) => ({
    borderBottom: '1px solid rgba(0,0,0,0.04)',
    background: isEven ? 'rgba(0,0,0,0.01)' : 'transparent',
    transition: 'background 0.15s',
  });

  return (
    <div className="fade-in" style={{ maxWidth: '100%', margin: '0 auto', padding: '0 20px' }}>
      {/* Blocked Modal */}
      {showBlockedModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ width: '100%', maxWidth: '400px', padding: '32px', background: v('card-bg'), borderRadius: '16px', border: `1px solid ${v('card-border')}`, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
              <Lock size={28} color={v('green')} />
            </div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '8px', color: v('text-main') }}>Documento bloqueado</h2>
            <p style={{ fontSize: '0.85rem', color: v('text-muted'), marginBottom: '24px', lineHeight: 1.6 }}>
              <strong>{blockedDocName}</strong> está en estado <strong style={{ color: v('green') }}>Aprobado</strong> y no puede eliminarse. Solo un administrador puede eliminarlo desde el panel de auditoría global.
            </p>
            <button onClick={() => setShowBlockedModal(false)} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: 'none', background: v('primary'), color: 'white', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>Entendido</button>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ width: '100%', maxWidth: '400px', padding: '32px', background: v('card-bg'), borderRadius: '16px', border: `1px solid ${v('card-border')}`, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
              <Trash2 size={28} color={v('red')} />
            </div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '8px', color: v('text-main') }}>Eliminar documento</h2>
            <p style={{ fontSize: '0.85rem', color: v('text-muted') }}>
              Vas a borrar <strong>{docToDelete?.nombre_archivo}</strong>. Esta acción es irreversible.
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button onClick={() => setShowDeleteModal(false)} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${v('card-border')}`, background: 'transparent', color: v('text-muted'), fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleDelete} disabled={isDeleting} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: v('red'), color: 'white', fontWeight: 600, fontSize: '0.85rem', cursor: isDeleting ? 'not-allowed' : 'pointer', opacity: isDeleting ? 0.6 : 1 }}>
                {isDeleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: v('text-main'), letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <HistoryIcon size={20} color={v('primary')} />
              </div>
              Historial de documentos
            </h1>
            <p style={{ color: v('text-muted'), marginTop: '4px', fontSize: '0.85rem' }}>{history.length} documento{history.length !== 1 ? 's' : ''} procesado{history.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={fetchHistory} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', border: `1px solid ${v('card-border')}`, background: v('card-bg'), color: v('text-muted'), fontWeight: 500, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.15s' }}>
            <RefreshCw size={14} /> Actualizar
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div style={{ background: v('card-bg'), borderRadius: '14px', border: `1px solid ${v('card-border')}`, overflow: 'hidden' }}>
        {/* Search Bar */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${v('card-border')}`, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '360px' }}>
              <Search size={16} color={v('text-muted')} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
              <input type="text" placeholder="Buscar por documento o proveedor..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: '8px', border: `1px solid ${v('card-border')}`, background: v('bg-color'), color: v('text-main'), fontSize: '0.82rem', outline: 'none' }} />
            </div>
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', color: v('text-muted'), cursor: 'pointer', padding: '4px' }}>
                <X size={16} />
              </button>
            )}
            <button onClick={handleExportCSV} title="Exportar CSV" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: `1px solid ${v('card-border')}`, background: v('card-bg'), color: v('text-muted'), fontWeight: 500, fontSize: '0.78rem', cursor: 'pointer' }}>
              <Download size={14} /> CSV
            </button>
            <span style={{ fontSize: '0.75rem', color: v('text-muted'), marginLeft: 'auto' }}>
              {filteredHistory.length} de {history.length}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {FILTROS_ESTADO.map(est => (
              <button key={est} onClick={() => setFilterEstado(est)}
                style={{
                  padding: '4px 12px', borderRadius: '20px', border: `1px solid ${filterEstado === est ? v('primary') : v('card-border')}`,
                  background: filterEstado === est ? 'rgba(99,102,241,0.1)' : 'transparent',
                  color: filterEstado === est ? v('primary') : v('text-muted'),
                  fontWeight: filterEstado === est ? 700 : 500, fontSize: '0.72rem', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
                }}>
                {est || 'Todos'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: v('text-muted'), fontSize: '0.85rem' }}>Cargando...</div>
        ) : error ? (
          <div style={{ padding: '40px', textAlign: 'center', color: v('red') }}>
            <AlertCircle size={32} style={{ marginBottom: '12px', opacity: 0.4 }} />
            <p style={{ fontSize: '0.85rem' }}>{error}</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: v('text-muted') }}>
            <FileText size={40} style={{ marginBottom: '12px', opacity: 0.2 }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '4px', color: v('text-main') }}>Sin documentos</h3>
            <p style={{ fontSize: '0.82rem' }}>Escanea documentos desde el <Link to="/" style={{ color: v('primary'), textDecoration: 'none' }}>Dashboard</Link>.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${v('card-border')}` }}>
                  {['Fecha', 'Documento', 'Proveedor', 'Total CIF', 'Estado', 'Riesgo', ''].map(h => (
                    <th key={h} style={{ padding: '12px 16px', fontWeight: 600, fontSize: '0.72rem', color: v('text-muted'), textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: h === '' ? 'center' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((record, i) => (
                  <tr key={record.id} style={rowStyle(i % 2 === 0)}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99,102,241,0.03)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = rowStyle(i % 2 === 0).background}>
                    <td style={{ padding: '14px 16px', color: v('text-muted'), whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{new Date(record.fecha_analisis).toLocaleDateString('es-CL', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={{ padding: '14px 16px', fontWeight: 600, color: v('text-main') }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={15} color={v('primary')} style={{ flexShrink: 0, opacity: 0.6 }} />
                        <span style={{ wordBreak: 'break-word' }}>{record.nombre_archivo}</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', color: v('text-main') }}>{record.proveedor || <span style={{ color: v('text-muted'), fontStyle: 'italic' }}>Sin proveedor</span>}</td>
                    <td style={{ padding: '14px 16px', fontWeight: 600, color: v('text-main'), fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>${record.total_cif?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</td>
                    <td style={{ padding: '14px 16px' }}><StatusBadge record={record} /></td>
                    <td style={{ padding: '14px 16px' }}><RiskBadge riesgo={record.riesgo} /></td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button onClick={() => navigate(`/factura/${record.id}/editar`, { state: { historyData: record } })}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', padding: 0, border: `1px solid ${v('card-border')}`, borderRadius: '8px', background: 'transparent', color: v('text-muted'), cursor: 'pointer', marginRight: '6px', transition: 'all 0.15s' }}
                        title="Ver detalle">
                        <Eye size={15} />
                      </button>
                      {record.bloqueado ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', border: `1px solid rgba(16,185,129,0.2)`, background: 'rgba(16,185,129,0.06)', color: v('green'), opacity: 0.5, cursor: 'not-allowed' }} title="Documento bloqueado">
                          <Lock size={14} />
                        </span>
                      ) : (
                        <button onClick={() => { setDocToDelete(record); setShowDeleteModal(true); }}
                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', padding: 0, border: `1px solid rgba(239,68,68,0.2)`, borderRadius: '8px', background: 'rgba(239,68,68,0.06)', color: v('red'), cursor: 'pointer', transition: 'all 0.15s' }}
                          title="Eliminar">
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
    </div>
  );
};

export default History;

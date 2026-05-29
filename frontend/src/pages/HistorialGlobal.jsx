import React, { useState, useEffect } from 'react';
import { API_BASE } from '../services/api';
import { Layers, Search, FileText, CheckCircle, AlertTriangle, AlertCircle, RefreshCw, User as UserIcon, Eye, Lock, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { cssVar as v } from '../lib/utils';

// Componente principal: auditoría global con todos los documentos de todos los operadores
const GlobalHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [docToDelete, setDocToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();

  // Obtiene el historial global de documentos desde la API de administración
  const fetchGlobalHistory = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/admin/documents`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Error de privilegios o conexión al servidor.');
      const data = await response.json();
      setHistory(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Elimina un documento del sistema globalmente
  const handleDelete = async () => {
    if (!docToDelete) return;
    setIsDeleting(true);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/documentos/${docToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setHistory(prev => prev.filter(item => item.id !== docToDelete.id));
      } else {
        const err = await response.json().catch(() => ({}));
        alert(err.detail || 'No se pudo eliminar el documento.');
      }
    } catch (error) {
      alert('Error de conexión al servidor.');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setDocToDelete(null);
    }
  };

  useEffect(() => {
    fetchGlobalHistory();
  }, []);

  // Renderiza una insignia de estado del documento
  const StatusBadge = ({ item }) => {
    if (item.bloqueado) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap', background: 'rgba(16,185,129,0.1)', color: v('green'), border: '1px solid rgba(16,185,129,0.2)' }}>
          <Lock size={12} /> Aprobado
        </span>
      );
    }
    if (item.estado === 'Aprobado' || item.estado === 'Aprobado (Validado)') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap', background: 'rgba(16,185,129,0.08)', color: v('green'), border: '1px solid rgba(16,185,129,0.15)' }}>
          <CheckCircle size={12} /> Aprobado
        </span>
      );
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 500, whiteSpace: 'nowrap', background: 'rgba(100,116,139,0.08)', color: v('text-muted'), border: '1px solid rgba(100,116,139,0.15)' }}>
        {item.estado || 'En Revisión'}
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

  const filtered = history.filter(h =>
    h.nombre_archivo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    h.proveedor?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Retorna el estilo de fila alternado para la tabla
  const rowStyle = (isEven) => ({
    borderBottom: '1px solid rgba(0,0,0,0.04)',
    background: isEven ? 'rgba(0,0,0,0.01)' : 'transparent',
    transition: 'background 0.15s',
  });

  return (
    <div className="fade-in" style={{ maxWidth: '100%', margin: '0 auto', padding: '0 20px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: v('text-main'), letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Layers size={20} color={v('primary')} />
              </div>
              Auditoría global
            </h1>
            <p style={{ color: v('text-muted'), marginTop: '4px', fontSize: '0.85rem' }}>{history.length} documento{history.length !== 1 ? 's' : ''} procesado{history.length !== 1 ? 's' : ''} por todos los operadores</p>
          </div>
          <button onClick={fetchGlobalHistory} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', border: `1px solid ${v('card-border')}`, background: v('card-bg'), color: v('text-muted'), fontWeight: 500, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.15s' }}>
            <RefreshCw size={14} /> Actualizar
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div style={{ background: v('card-bg'), borderRadius: '14px', border: `1px solid ${v('card-border')}`, overflow: 'hidden' }}>
        {/* Search Bar */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${v('card-border')}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
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
          <span style={{ fontSize: '0.75rem', color: v('text-muted'), marginLeft: 'auto' }}>
            {filtered.length} de {history.length}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: v('text-muted'), fontSize: '0.85rem' }}><RefreshCw size={24} className="spin" style={{ marginBottom: '12px' }} /><br />Cargando...</div>
        ) : error ? (
          <div style={{ padding: '40px', textAlign: 'center', color: v('red') }}>
            <AlertCircle size={32} style={{ marginBottom: '12px', opacity: 0.4 }} />
            <p style={{ fontSize: '0.85rem' }}>{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: v('text-muted') }}>
            <FileText size={40} style={{ marginBottom: '12px', opacity: 0.2 }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '4px', color: v('text-main') }}>Sin documentos</h3>
            <p style={{ fontSize: '0.82rem' }}>Aún no se han procesado documentos.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${v('card-border')}` }}>
                  {['Fecha', 'Analista', 'Documento', 'Proveedor', 'Total CIF', 'Estado', 'Riesgo', ''].map(h => (
                    <th key={h} style={{ padding: '12px 16px', fontWeight: 600, fontSize: '0.72rem', color: v('text-muted'), textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: h === '' ? 'center' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, i) => (
                  <tr key={item.id} style={rowStyle(i % 2 === 0)}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99,102,241,0.03)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = rowStyle(i % 2 === 0).background}>
                    <td style={{ padding: '14px 16px', color: v('text-muted'), whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{new Date(item.fecha_analisis).toLocaleDateString('es-CL', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500, color: v('text-main'), fontSize: '0.82rem' }}>
                        <UserIcon size={14} color={v('primary')} style={{ opacity: 0.6 }} />
                        {item.usuario_id || 'N/A'}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 600, color: v('text-main') }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={15} color={v('primary')} style={{ flexShrink: 0, opacity: 0.6 }} />
                        <span style={{ wordBreak: 'break-word' }}>{item.nombre_archivo}</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', color: v('text-main') }}>{item.proveedor || <span style={{ color: v('text-muted'), fontStyle: 'italic' }}>Sin proveedor</span>}</td>
                    <td style={{ padding: '14px 16px', fontWeight: 600, color: v('text-main'), fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>${item.total_cif?.toLocaleString()}</td>
                    <td style={{ padding: '14px 16px' }}><StatusBadge item={item} /></td>
                    <td style={{ padding: '14px 16px' }}><RiskBadge riesgo={item.riesgo} /></td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button onClick={() => navigate(`/factura/${item.id}/editar`, { state: { historyData: item } })}
                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', padding: 0, border: `1px solid ${v('card-border')}`, borderRadius: '8px', background: 'transparent', color: v('text-muted'), cursor: 'pointer', transition: 'all 0.15s' }}
                          title="Ver detalle">
                          <Eye size={15} />
                        </button>
                        <button onClick={() => { setDocToDelete(item); setShowDeleteModal(true); }}
                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', padding: 0, border: `1px solid ${v('card-border')}`, borderRadius: '8px', background: 'transparent', color: v('red'), cursor: 'pointer', transition: 'all 0.15s', opacity: 0.7 }}
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

      {/* Delete Modal */}
      {showDeleteModal && docToDelete && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ width: '100%', maxWidth: '400px', padding: '32px', background: v('card-bg'), borderRadius: '16px', border: `1px solid ${v('card-border')}`, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
              <Trash2 size={28} color={v('red')} />
            </div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '8px', color: v('text-main') }}>Eliminar documento</h2>
            <p style={{ fontSize: '0.85rem', color: v('text-muted') }}>
              Vas a borrar <strong>{docToDelete.nombre_archivo}</strong> de todos los operadores. Esta acción es irreversible.
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button onClick={() => { setShowDeleteModal(false); setDocToDelete(null); }} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${v('card-border')}`, background: 'transparent', color: v('text-muted'), fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleDelete} disabled={isDeleting} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: v('red'), color: 'white', fontWeight: 600, fontSize: '0.85rem', cursor: isDeleting ? 'not-allowed' : 'pointer', opacity: isDeleting ? 0.6 : 1 }}>
                {isDeleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalHistory;

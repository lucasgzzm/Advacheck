import React, { useState, useEffect } from 'react';
import { History as HistoryIcon, Search, AlertCircle, FileText, CheckCircle, AlertTriangle, X, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const History = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  // Estados para Eliminación
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [docToDelete, setDocToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch('http://127.0.0.1:8000/api/facturas/historial', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
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

  const handleDelete = async () => {
    if (!docToDelete) return;
    try {
      setIsDeleting(true);
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`http://127.0.0.1:8000/api/facturas/${docToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setHistory(prev => prev.filter(item => item.id !== docToDelete.id));
        setShowDeleteModal(false);
        setDocToDelete(null);
      } else {
        alert("No se pudo eliminar el documento.");
      }
    } catch (error) {
       alert("Error de conexión al servidor.");
    } finally {
      setIsDeleting(false);
    }
  };

  const getRiskBadge = (riesgo) => {
    switch(riesgo?.toLowerCase()) {
      case 'bajo':
        return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(34, 197, 94, 0.1)', color: 'var(--green)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 }}><CheckCircle size={14}/> Bajo Riesgo</span>;
      case 'alto':
        return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--red)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 }}><AlertCircle size={14}/> Riesgo Alto</span>;
      default:
        return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(234, 179, 8, 0.1)', color: 'var(--yellow)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 }}><AlertTriangle size={14}/> Riesgo Medio</span>;
    }
  };

  const filteredHistory = history.filter(h => 
     h.nombre_archivo.toLowerCase().includes(searchTerm.toLowerCase()) ||
     (h.proveedor || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fade-in" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-1px', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <HistoryIcon size={32} color="var(--primary)" />
            Historial de Análisis
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px', fontSize: '1.05rem' }}>
            Trazabilidad completa de las extracciones y pre-validaciones OCR.
          </p>
        </div>
        <button onClick={fetchHistory} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}>
           Actualizar Tabla
        </button>
      </header>

      {/* Modal de Confirmación de Borrado */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
           <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '32px', textAlign: 'center', animation: 'fadeIn 0.2s ease-out' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                 <Trash2 size={32} color="var(--red)" />
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '12px' }}>¿Eliminar documento?</h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '32px' }}>
                 Estás a punto de borrar <strong>{docToDelete?.nombre_archivo}</strong>. Esta acción no se puede deshacer y el documento desaparecerá de tu historial.
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                 <button onClick={() => setShowDeleteModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancelar</button>
                 <button 
                   onClick={handleDelete} 
                   className="btn" 
                   disabled={isDeleting}
                   style={{ flex: 1, backgroundColor: 'var(--red)', color: 'white', border: 'none' }}
                 >
                    {isDeleting ? 'Eliminando...' : 'Sí, eliminar'}
                 </button>
              </div>
           </div>
        </div>
      )}

      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        
        {/* Barra de Filtros */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: 'rgba(0,0,0,0.02)' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
            <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
               type="text" 
               placeholder="Buscar por documento o proveedor..." 
               className="form-input" 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               style={{ width: '100%', paddingLeft: '40px', fontSize: '0.9rem', backgroundColor: 'var(--bg-color)', border: '1px solid var(--card-border)' }} 
            />
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando bitácora...</div>
        ) : error ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--red)' }}>
            <AlertCircle size={40} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
            <p>{error}</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
             <FileText size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
             <h3>No hay documentos analizados</h3>
             <p style={{ fontSize: '0.9rem' }}>Los escaneos que realices en el <Link to="/" style={{ color: 'var(--primary)' }}>Dashboard</Link> aparecerán aquí si activas el guardado.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)', borderBottom: '1px solid var(--card-border)' }}>
                  <th style={{ padding: '16px 24px', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Fecha</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Documento</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Proveedor (Emisor)</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Total CIF</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Estado</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Diagnóstico</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((record) => (
                  <tr key={record.id} style={{ borderBottom: '1px solid var(--card-border)', transition: 'background-color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.02)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <td style={{ padding: '16px 24px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                      {new Date(record.fecha_analisis).toLocaleString()}
                    </td>
                    <td style={{ padding: '16px 24px', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={16} color="var(--primary)" />
                      {record.nombre_archivo}
                    </td>
                    <td style={{ padding: '16px 24px', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                      {record.proveedor || 'No encontrado'}
                    </td>
                    <td style={{ padding: '16px 24px', fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 500 }}>
                      ${record.total_cif?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{ 
                        padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600,
                        backgroundColor: record.estado === 'Aprobado (Validado)' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0,0,0,0.05)',
                        color: record.estado === 'Aprobado (Validado)' ? 'var(--green)' : 'var(--text-muted)'
                      }}>
                        {record.estado || 'En Revisión'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      {getRiskBadge(record.riesgo)}
                    </td>
                    <td style={{ padding: '16px 24px', display: 'flex', gap: '8px' }}>
                       <button 
                         onClick={() => navigate(`/factura/${record.id}/editar`, { state: { historyData: record } })}
                         style={{ background: 'var(--primary-light)', border: '1px solid var(--primary)', cursor: 'pointer', color: 'var(--primary)', padding: '6px 10px', borderRadius: '6px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.85rem' }}
                         onMouseOver={(e) => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.color = 'white'; }}
                         onMouseOut={(e) => { e.currentTarget.style.background = 'var(--primary-light)'; e.currentTarget.style.color = 'var(--primary)'; }}
                       >
                         Ver / Editar
                       </button>
                       <button 
                         onClick={() => { setDocToDelete(record); setShowDeleteModal(true); }}
                         style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid transparent', cursor: 'pointer', color: 'var(--red)', padding: '6px 10px', borderRadius: '6px', transition: 'all 0.2s' }}
                         onMouseOver={(e) => { e.currentTarget.style.background = 'var(--red)'; e.currentTarget.style.color = 'white'; }}
                         onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = 'var(--red)'; }}
                         title="Eliminar"
                       >
                         <X size={18} />
                       </button>
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

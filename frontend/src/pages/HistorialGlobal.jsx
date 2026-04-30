import React, { useState, useEffect } from 'react';
import { Layers, Search, FileText, CheckCircle, AlertTriangle, AlertCircle, RefreshCw, User as UserIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const GlobalHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const fetchGlobalHistory = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch('http://127.0.0.1:8000/api/admin/documents', {
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

  useEffect(() => {
    fetchGlobalHistory();
  }, []);

  const getRiskBadge = (riesgo) => {
    switch(riesgo?.toLowerCase()) {
      case 'bajo':
        return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(34, 197, 94, 0.1)', color: 'var(--green)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 }}><CheckCircle size={14}/> Bajo</span>;
      case 'alto':
        return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--red)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 }}><AlertCircle size={14}/> Crítico</span>;
      default:
        return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(234, 179, 8, 0.1)', color: 'var(--yellow)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 }}><AlertTriangle size={14}/> Medio</span>;
    }
  };

  const filtered = history.filter(h => 
    h.nombre_archivo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    h.proveedor?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fade-in">
      <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-1px', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Layers size={32} color="var(--primary)" />
            Auditoría Global
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px', fontSize: '1.05rem' }}>Visibilidad total sobre los documentos procesados por todos los analistas.</p>
        </div>
        <button onClick={fetchGlobalHistory} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
           <RefreshCw size={18} /> Sincronizar
        </button>
      </header>

      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: 'rgba(0,0,0,0.02)' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
            <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
               type="text" 
               placeholder="Buscar en el historial maestro..." 
               className="form-input" 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               style={{ width: '100%', paddingLeft: '40px' }} 
            />
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center' }}><RefreshCw className="lucide-spin" size={32} color="var(--primary)" /></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)', borderBottom: '1px solid var(--card-border)' }}>
                  <th style={{ padding: '16px 24px', fontWeight: 600, fontSize: '0.85rem' }}>Fecha / Hora</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600, fontSize: '0.85rem' }}>Firma Analista</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600, fontSize: '0.85rem' }}>Documento</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600, fontSize: '0.85rem' }}>Proveedor</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600, fontSize: '0.85rem' }}>Total CIF</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600, fontSize: '0.85rem' }}>Estado Operativo</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600, fontSize: '0.85rem' }}>Semáforo IA</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600, fontSize: '0.85rem' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--card-border)', transition: 'background-color 0.2s' }}>
                    <td style={{ padding: '16px 24px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {new Date(item.fecha_analisis).toLocaleString()}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 600 }}>
                        <UserIcon size={14} color="var(--primary)" />
                        {item.usuario_id || 'N/A'} 
                        {/* Nota: Aquí podrías traer el nombre si el backend hace el join, por ahora mostramos ID */}
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px', fontWeight: 600, fontSize: '0.9rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={16} color="var(--primary)" />
                        {item.nombre_archivo}
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px', fontSize: '0.9rem' }}>{item.proveedor}</td>
                    <td style={{ padding: '16px 24px', fontWeight: 700 }}>${item.total_cif?.toLocaleString()}</td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{ 
                        padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600,
                        backgroundColor: item.estado === 'Aprobado (Validado)' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0,0,0,0.05)',
                        color: item.estado === 'Aprobado (Validado)' ? 'var(--green)' : 'var(--text-muted)'
                      }}>
                        {item.estado || 'En Revisión'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px' }}>{getRiskBadge(item.riesgo)}</td>
                    <td style={{ padding: '16px 24px' }}>
                       <button 
                         onClick={() => navigate(`/factura/${item.id}/editar`, { state: { historyData: item } })}
                         style={{ background: 'var(--primary-light)', border: '1px solid var(--primary)', cursor: 'pointer', color: 'var(--primary)', padding: '6px 10px', borderRadius: '6px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.85rem' }}
                         onMouseOver={(e) => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.color = 'white'; }}
                         onMouseOut={(e) => { e.currentTarget.style.background = 'var(--primary-light)'; e.currentTarget.style.color = 'var(--primary)'; }}
                       >
                         Ver / Editar
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

export default GlobalHistory;

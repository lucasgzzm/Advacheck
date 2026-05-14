import React, { useState } from 'react';
import { UploadCloud, CheckCircle, AlertTriangle, FileText, Loader2, ArrowRight } from 'lucide-react';

const ValidacionCruzada = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
      setResultado(null);
      setError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (files.length < 2) {
      setError('Sube al menos 2 documentos para realizar validación cruzada.');
      return;
    }

    setLoading(true);
    setError(null);
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');

    const formData = new FormData();
    files.forEach(f => formData.append('files', f));

    try {
      const res = await fetch('http://127.0.0.1:8000/api/facturas/scan-multi', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error en la validación.');
      
      setResultado(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in">
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0 }}>Validación Cruzada de Expediente</h1>
        <p style={{ color: 'var(--text-muted)' }}>Sube Múltiples Documentos (Factura, B/L, Packing List) para auditoría cruzada.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        {/* Upload Zone */}
        <div className="glass-panel" style={{ padding: '32px' }}>
          <form onSubmit={handleSubmit}>
            <div 
              style={{
                border: '2px dashed var(--primary)', borderRadius: '12px', padding: '40px 20px',
                textAlign: 'center', backgroundColor: 'var(--primary-light)', cursor: 'pointer',
                transition: 'all 0.3s'
              }}
              onClick={() => document.getElementById('multi-file-upload').click()}
            >
              <UploadCloud size={48} color="var(--primary)" style={{ margin: '0 auto 16px' }} />
              <h3 style={{ margin: '0 0 8px', color: 'var(--primary)', fontWeight: 600 }}>Sube documentos PDF</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Selecciona Factura, B/L, Packing List, etc. (Máximo 5)</p>
              <input 
                id="multi-file-upload" type="file" multiple accept=".pdf" 
                onChange={handleFileChange} style={{ display: 'none' }} 
              />
            </div>

            {files.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '0.9rem', fontWeight: 600 }}>Archivos seleccionados:</h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {files.map((f, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', backgroundColor: 'var(--bg-color)', border: '1px solid var(--card-border)', borderRadius: '8px', fontSize: '0.85rem' }}>
                      <FileText size={16} color="var(--primary)" />
                      <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {error && (
              <div style={{ marginTop: '20px', padding: '12px', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid var(--red)', borderRadius: '8px', color: 'var(--red)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} /> {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '24px' }} disabled={loading || files.length < 2}>
              {loading ? <><Loader2 size={18} className="spin" /> Analizando documentos...</> : 'Iniciar Validación Cruzada'}
            </button>
          </form>
        </div>

        {/* Results */}
        {resultado && (
          <div className="glass-panel fade-in" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              {resultado.discrepancias_encontradas ? (
                <div style={{ padding: '12px', borderRadius: '50%', backgroundColor: 'rgba(239,68,68,0.1)' }}>
                  <AlertTriangle size={32} color="var(--red)" />
                </div>
              ) : (
                <div style={{ padding: '12px', borderRadius: '50%', backgroundColor: 'rgba(34,197,94,0.1)' }}>
                  <CheckCircle size={32} color="var(--green)" />
                </div>
              )}
              <div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: resultado.discrepancias_encontradas ? 'var(--red)' : 'var(--green)' }}>
                  {resultado.discrepancias_encontradas ? 'Discrepancias Detectadas' : 'Validación Exitosa'}
                </h2>
                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>{resultado.conclusion}</p>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 600 }}>Documentos Identificados:</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {resultado.documentos_identificados?.map((doc, i) => (
                  <span key={i} style={{ padding: '6px 12px', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600 }}>
                    {doc}
                  </span>
                ))}
              </div>
            </div>

            {resultado.discrepancias_encontradas && resultado.lista_discrepancias?.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 600, color: 'var(--red)' }}>Hallazgos:</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {resultado.lista_discrepancias.map((disc, i) => (
                    <div key={i} style={{ padding: '16px', backgroundColor: 'rgba(239,68,68,0.05)', borderLeft: `4px solid ${disc.severidad === 'ALTA' ? 'var(--red)' : '#f59e0b'}`, borderRadius: '0 8px 8px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{disc.campo}</span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', backgroundColor: disc.severidad === 'ALTA' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)', color: disc.severidad === 'ALTA' ? 'var(--red)' : '#f59e0b' }}>
                          {disc.severidad}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: 1.5 }}>{disc.descripcion}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!resultado.discrepancias_encontradas && resultado.coincidencias_clave?.length > 0 && (
              <div>
                <h4 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 600, color: 'var(--green)' }}>Coincidencias Clave:</h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {resultado.coincidencias_clave.map((coincidencia, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                      <CheckCircle size={16} color="var(--green)" style={{ marginTop: '2px', flexShrink: 0 }} />
                      <span>{coincidencia}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default ValidacionCruzada;

import React, { useState, useEffect } from 'react';
import { Building2, Search, RefreshCw, AlertTriangle, AlertCircle, CheckCircle, TrendingUp, DollarSign } from 'lucide-react';

const NIVEL_CONFIG = {
  critico:   { label: 'Crítico',    color: 'var(--red)',    bg: 'rgba(239,68,68,0.1)',  icon: AlertCircle },
  elevado:   { label: 'Elevado',    color: '#f59e0b',       bg: 'rgba(245,158,11,0.1)', icon: AlertTriangle },
  moderado:  { label: 'Moderado',   color: '#8b5cf6',       bg: 'rgba(139,92,246,0.1)', icon: TrendingUp },
  confiable: { label: 'Confiable',  color: 'var(--green)',  bg: 'rgba(34,197,94,0.1)',  icon: CheckCircle },
};

const NivelBadge = ({ nivel }) => {
  const cfg = NIVEL_CONFIG[nivel] || NIVEL_CONFIG.moderado;
  const Icon = cfg.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem',
      fontWeight: 600, whiteSpace: 'nowrap',
      backgroundColor: cfg.bg, color: cfg.color,
    }}>
      <Icon size={13} /> {cfg.label}
    </span>
  );
};

const PerfilProveedores = () => {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchProveedores = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const res = await fetch('http://127.0.0.1:8000/api/facturas/proveedores/perfiles', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al obtener perfiles de proveedores.');
      setProveedores(await res.json());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProveedores(); }, []);

  const filtered = proveedores.filter(p =>
    p.proveedor.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fade-in">
      <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-1px', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Building2 size={32} color="var(--primary)" />
            Perfiles de Proveedores
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px', fontSize: '1.05rem' }}>
            Análisis de riesgo acumulativo por operador comercial.
          </p>
        </div>
        <button onClick={fetchProveedores} className="btn btn-secondary" disabled={loading}>
          <RefreshCw size={18} /> Actualizar
        </button>
      </header>

      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'rgba(0,0,0,0.02)' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '380px' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text" placeholder="Buscar proveedor..." className="form-input"
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', paddingLeft: '38px', fontSize: '0.9rem' }}
            />
          </div>
          <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {filtered.length} proveedor{filtered.length !== 1 ? 'es' : ''}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <RefreshCw size={32} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : error ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--red)' }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Building2 size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
            <p style={{ fontWeight: 600 }}>No se encontraron proveedores.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)', borderBottom: '2px solid var(--card-border)' }}>
                  <th style={{ padding: '14px 24px', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Proveedor</th>
                  <th style={{ padding: '14px 24px', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>Operaciones</th>
                  <th style={{ padding: '14px 24px', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>Distribución Riesgo</th>
                  <th style={{ padding: '14px 24px', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>Tasa Riesgo</th>
                  <th style={{ padding: '14px 24px', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>Prom. CIF</th>
                  <th style={{ padding: '14px 24px', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>Nivel</th>
                  <th style={{ padding: '14px 24px', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>Última Op.</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--card-border)', transition: 'background-color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--primary-light)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <td style={{ padding: '14px 24px', fontWeight: 600, fontSize: '0.9rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Building2 size={16} color="var(--primary)" />
                        </div>
                        {p.proveedor}
                      </div>
                    </td>
                    <td style={{ padding: '14px 24px', fontWeight: 700, fontSize: '1.1rem', textAlign: 'center' }}>{p.total_operaciones}</td>
                    <td style={{ padding: '14px 24px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {p.riesgo_alto > 0 && <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--red)' }}>🔴 {p.riesgo_alto}</span>}
                        {p.riesgo_medio > 0 && <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f59e0b' }}>🟡 {p.riesgo_medio}</span>}
                        {p.riesgo_bajo > 0 && <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--green)' }}>🟢 {p.riesgo_bajo}</span>}
                      </div>
                    </td>
                    <td style={{ padding: '14px 24px', fontWeight: 700, textAlign: 'center',
                      color: p.tasa_riesgo_porcentaje >= 50 ? 'var(--red)' : p.tasa_riesgo_porcentaje >= 25 ? '#f59e0b' : 'var(--text-main)' }}>
                      {p.tasa_riesgo_porcentaje}%
                    </td>
                    <td style={{ padding: '14px 24px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                        <DollarSign size={14} color="var(--text-muted)" />
                        {p.promedio_cif?.toLocaleString()}
                      </div>
                    </td>
                    <td style={{ padding: '14px 24px' }}><NivelBadge nivel={p.nivel_proveedor} /></td>
                    <td style={{ padding: '14px 24px', fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {p.ultima_operacion ? new Date(p.ultima_operacion).toLocaleDateString('es-ES') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default PerfilProveedores;

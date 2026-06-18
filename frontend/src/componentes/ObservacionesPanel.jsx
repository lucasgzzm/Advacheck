// Panel de observaciones y notas con mensajeria
import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, User, Clock, AlertTriangle, FileEdit, StickyNote } from 'lucide-react';
import { peticionGet, peticionPost } from '../servicios/api';

const TIPO_CONFIG = {
  nota:       { label: 'Nota', color: 'var(--primary)', bg: 'rgba(59,130,246,0.08)', icon: StickyNote },
  alerta:     { label: 'Alerta', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', icon: AlertTriangle },
  correccion: { label: 'Corrección', color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', icon: FileEdit },
};

const ObservacionesPanel = ({ documentoId }) => {
  const [observaciones, setObservaciones] = useState([]);
  const [contenido, setContenido] = useState('');
  const [tipo, setTipo] = useState('nota');
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const fetchObservaciones = async () => {
    try {
      setLoading(true);
      const data = await peticionGet(`/api/documentos/${documentoId}/observaciones`);
      setObservaciones(data);
    } catch (err) {
      console.error('Error cargando observaciones:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (documentoId) fetchObservaciones();
  }, [documentoId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!contenido.trim()) return;

    setEnviando(true);
    try {
      await peticionPost(`/api/documentos/${documentoId}/observaciones`, {
        contenido: contenido.trim(),
        tipo,
      });
      setContenido('');
      fetchObservaciones();
    } catch (err) {
      console.error('Error enviando observación:', err);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="glass-panel" style={{ marginTop: '0px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--card-border)' }}>
        <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(59,130,246,0.1)' }}>
          <MessageSquare size={20} color="var(--primary)" />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Observaciones del Documento</h3>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {observaciones.length} nota{observaciones.length !== 1 ? 's' : ''} registrada{observaciones.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          {Object.entries(TIPO_CONFIG).map(([key, cfg]) => {
            const Icon = cfg.icon;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTipo(key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem',
                  fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                  border: tipo === key ? `2px solid ${cfg.color}` : '2px solid var(--card-border)',
                  backgroundColor: tipo === key ? cfg.bg : 'transparent',
                  color: tipo === key ? cfg.color : 'var(--text-muted)',
                }}
              >
                <Icon size={13} /> {cfg.label}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <textarea
            value={contenido}
            onChange={(e) => setContenido(e.target.value)}
            placeholder="Escribir observación sobre este documento..."
            rows={2}
            style={{
              flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid var(--card-border)',
              resize: 'vertical', fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none',
              transition: 'border-color 0.2s', minHeight: '60px',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
            onBlur={e => e.target.style.borderColor = 'var(--card-border)'}
          />
          <button
            type="submit"
            disabled={!contenido.trim() || enviando}
            className="btn btn-primary"
            style={{ alignSelf: 'flex-end', opacity: !contenido.trim() ? 0.5 : 1 }}
          >
            <Send size={16} />
          </button>
        </div>
      </form>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>Cargando...</p>
      ) : observaciones.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px', fontSize: '0.9rem' }}>
          No hay observaciones aún. Sé el primero en documentar una anomalía o nota.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {observaciones.map(obs => {
            const cfg = TIPO_CONFIG[obs.tipo] || TIPO_CONFIG.nota;
            const Icon = cfg.icon;
            return (
              <div key={obs.id} style={{
                padding: '14px 16px', borderRadius: '10px',
                border: `1px solid ${cfg.color}30`,
                backgroundColor: cfg.bg,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <User size={14} color={cfg.color} />
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)' }}>{obs.usuario_nombre}</span>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: '10px',
                      backgroundColor: `${cfg.color}20`, color: cfg.color,
                      display: 'flex', alignItems: 'center', gap: '4px'
                    }}>
                      <Icon size={10} /> {cfg.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <Clock size={12} />
                    {new Date(obs.fecha_creacion).toLocaleString('es-ES')}
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
                  {obs.contenido}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ObservacionesPanel;

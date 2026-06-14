import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, BellRing, CheckCheck, AlertTriangle, CheckCircle, Info, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { peticionGet, peticionPatch } from '../servicios/api';

// Mapa de tipos de notificación a componentes de icono
const ICONOS = {
  alerta: AlertTriangle,
  aprobacion: CheckCircle,
  rechazo: X,
  info: Info,
};

// Esquema de colores por tipo de notificación
const COLORES = {
  alerta: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)', icono: 'var(--red)' },
  aprobacion: { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)', icono: 'var(--green)' },
  rechazo: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)', icono: 'var(--red)' },
  info: { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)', icono: 'var(--primary)' },
};

// Componente de campana de notificaciones con menú desplegable y auto‑actualización
function NotificacionCampana({ fullWidth = false }) {
  const [notificaciones, setNotificaciones] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  // Obtiene las notificaciones del usuario desde la API
  const cargar = useCallback(async () => {
    try {
      const data = await peticionGet('/api/documentos/notificaciones/mis');
      setNotificaciones(data);
    } catch {
    }
  }, []);

  useEffect(() => {
    cargar();
    const intervalo = setInterval(cargar, 30000);
    return () => clearInterval(intervalo);
  }, [cargar]);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setAbierto(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const noLeidas = notificaciones.filter((n) => !n.leida).length;

  // Marca todas las notificaciones como leídas
  const handleMarcarTodasLeidas = async () => {
    try {
      await peticionPatch('/api/documentos/notificaciones/leer-todas');
      setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
    } catch {
    }
  };

  // Marca como leída y navega al documento asociado si existe
  const handleClickNotificacion = async (n) => {
    if (!n.leida) {
      try {
        await peticionPatch(`/api/documentos/notificaciones/${n.id}/leer`);
        setNotificaciones((prev) =>
          prev.map((nn) => (nn.id === n.id ? { ...nn, leida: true } : nn))
        );
      } catch {
      }
    }
    if (n.documento_id) {
      setAbierto(false);
      navigate(`/factura/${n.documento_id}/editar`);
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setAbierto((v) => !v)}
        style={{
          background: abierto ? 'rgba(0,0,0,0.03)' : 'none',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          padding: fullWidth ? '12px 16px' : '6px',
          borderRadius: fullWidth ? '12px' : '8px',
          display: 'flex',
          alignItems: 'center',
          gap: fullWidth ? '12px' : '0',
          justifyContent: fullWidth ? 'flex-start' : 'center',
          width: fullWidth ? '100%' : 'auto',
          color: noLeidas > 0 ? 'var(--primary)' : 'var(--text-muted)',
          transition: 'background 0.2s',
          fontWeight: fullWidth ? 500 : 400,
          fontSize: fullWidth ? '0.92rem' : 'inherit',
          textDecoration: 'none',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.03)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = abierto ? 'rgba(0,0,0,0.03)' : 'none'; }}
        title="Notificaciones"
      >
        <span style={{ position: 'relative', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {noLeidas > 0 ? <BellRing size={20} /> : <Bell size={20} />}
          {noLeidas > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                backgroundColor: 'var(--red)',
                color: 'white',
                fontSize: '0.55rem',
                fontWeight: 800,
                minWidth: '16px',
                height: '16px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 3px',
                lineHeight: 1,
              }}
            >
              {noLeidas > 9 ? '9+' : noLeidas}
            </span>
          )}
        </span>
        {fullWidth && <span>Notificaciones</span>}
      </button>

      {abierto && (
        <div
          style={{
            position: 'absolute',
            bottom: fullWidth ? 'calc(100% + 8px)' : 'auto',
            top: fullWidth ? 'auto' : 'calc(100% + 8px)',
            left: fullWidth ? '0' : 'auto',
            right: fullWidth ? 'auto' : '0',
            width: '360px',
            maxHeight: '420px',
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: '14px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--card-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)' }}>
              Notificaciones
            </span>
            {noLeidas > 0 && (
              <button
                onClick={handleMarcarTodasLeidas}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--primary)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--primary-light)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
              >
                <CheckCheck size={14} /> Marcar todas leídas
              </button>
            )}
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notificaciones.length === 0 ? (
              <div
                style={{
                  padding: '32px 16px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem',
                }}
              >
                No tienes notificaciones.
              </div>
            ) : (
              notificaciones.map((n) => {
                const Icono = ICONOS[n.tipo] || Info;
                const colores = COLORES[n.tipo] || COLORES.info;
                return (
                  <div
                    key={n.id}
                    onClick={() => handleClickNotificacion(n)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--card-border)',
                      cursor: n.documento_id ? 'pointer' : 'default',
                      backgroundColor: n.leida ? 'transparent' : 'rgba(59,130,246,0.03)',
                      display: 'flex',
                      gap: '10px',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.02)'; }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = n.leida ? 'transparent' : 'rgba(59,130,246,0.03)';
                    }}
                  >
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        backgroundColor: colores.bg,
                        border: `1px solid ${colores.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '2px',
                      }}
                    >
                      <Icono size={14} color={colores.icono} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: n.leida ? 500 : 700,
                          color: 'var(--text-main)',
                          marginBottom: '2px',
                        }}
                      >
                        {n.titulo}
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          lineHeight: 1.35,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {n.mensaje}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px', opacity: 0.7 }}>
                        {new Date(n.fecha_creacion).toLocaleString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                    {!n.leida && (
                      <div
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--primary)',
                          flexShrink: 0,
                          marginTop: '6px',
                        }}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificacionCampana;

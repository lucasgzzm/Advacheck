import React from 'react';

const VARIANTES_MODAL = {
  error: {
    colorFondo: 'rgba(239, 68, 68, 0.1)',
    colorIcono: '#ef4444',
    colorBoton: 'var(--red)',
  },
  advertencia: {
    colorFondo: 'rgba(245, 158, 11, 0.1)',
    colorIcono: 'var(--yellow)',
    colorBoton: 'var(--yellow)',
  },
  informacion: {
    colorFondo: 'rgba(59, 130, 246, 0.1)',
    colorIcono: 'var(--primary)',
    colorBoton: 'var(--primary)',
  },
};

function Modal({ abierto, titulo, mensaje, variante = 'error', onCerrar, textoBoton = 'Cerrar', colorTextoBoton = '#fff', icono: Icono }) {
  if (!abierto) return null;

  const config = VARIANTES_MODAL[variante] || VARIANTES_MODAL.informacion;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--card-bg)',
          padding: '32px',
          borderRadius: '16px',
          maxWidth: '500px',
          width: '90%',
          textAlign: 'center',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: `1px solid ${variante === 'error' ? 'var(--red)' : 'var(--card-border)'}`,
          animation: 'fadeIn 0.3s ease-out',
        }}
      >
        {Icono && (
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: config.colorFondo,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
            }}
          >
            <Icono size={32} color={config.colorIcono} />
          </div>
        )}

        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '16px' }}>
          {titulo}
        </h2>

        <p
          style={{
            color: variante === 'error' ? 'var(--red)' : 'var(--text-muted)',
            marginBottom: '24px',
            lineHeight: 1.5,
            fontSize: '0.95rem',
            ...(variante === 'error'
              ? {
                  backgroundColor: config.colorFondo,
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                }
              : {}),
          }}
        >
          {mensaje}
        </p>

        <button
          onClick={onCerrar}
          style={{
            backgroundColor: config.colorBoton,
            color: colorTextoBoton,
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontWeight: 'bold',
            cursor: 'pointer',
            width: '100%',
            transition: 'opacity 0.2s',
          }}
          onMouseOver={(e) => (e.target.style.opacity = 0.9)}
          onMouseOut={(e) => (e.target.style.opacity = 1)}
        >
          {textoBoton}
        </button>
      </div>
    </div>
  );
}

export default Modal;

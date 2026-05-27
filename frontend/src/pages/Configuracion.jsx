import React from 'react';
import { Settings } from 'lucide-react';

// Componente principal: página de configuración del sistema (placeholder)
const Configuracion = () => {
  return (
    <div className="fade-in">
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-1px', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Settings size={32} color="var(--primary)" />
          Configuración del Sistema
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px', fontSize: '1.05rem' }}>
          Ajustes generales y preferencias de la plataforma.
        </p>
      </header>

      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <p>Aquí se incluirán las opciones de configuración próximamente.</p>
      </div>
    </div>
  );
};

export default Configuracion;

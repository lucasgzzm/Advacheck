import React from 'react';
import { Plus } from 'lucide-react';

const Shipments = () => {
  return (
    <div className="fade-in">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-1px', margin: 0 }}>Gestor de Operaciones</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px', fontSize: '1.1rem' }}>Crea y asocia nuevas facturas documentales a operaciones.</p>
        </div>
        <button className="btn btn-primary">
          <Plus size={18} /> Nuevo Envío (Operación)
        </button>
      </header>

      <div className="glass-panel" style={{ textAlign: 'center', padding: '100px 20px' }}>
        <h3 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '10px' }}>No hay operaciones vacías pendientes</h3>
        <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto' }}>
          Todos los envíos se originan actualmente desde la importación inicial de facturas.
        </p>
      </div>
    </div>
  );
};

export default Shipments;

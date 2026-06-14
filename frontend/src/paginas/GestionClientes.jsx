import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Plus, Search, Pencil, Trash2, X, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { peticionGet, peticionPost, peticionPut, peticionDelete } from '../servicios/api';

// Componente principal: gestión de clientes con CRUD y búsqueda
function GestionClientes() {
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    razon_social: '', identificacion_fiscal: '', direccion: '',
    email: '', telefono: '', contacto_nombre: '',
  });

  // Obtiene la lista de clientes desde la API
  const cargar = useCallback(async () => {
    try {
      const data = await peticionGet('/api/clientes');
      setClientes(data);
    } catch {
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Abre el modal para crear o editar un cliente
  const abrirModal = (cliente = null) => {
    if (cliente) {
      setEditando(cliente.id);
      setForm({
        razon_social: cliente.razon_social,
        identificacion_fiscal: cliente.identificacion_fiscal,
        direccion: cliente.direccion || '',
        email: cliente.email || '',
        telefono: cliente.telefono || '',
        contacto_nombre: cliente.contacto_nombre || '',
      });
    } else {
      setEditando(null);
      setForm({ razon_social: '', identificacion_fiscal: '', direccion: '', email: '', telefono: '', contacto_nombre: '' });
    }
    setError(null);
    setModalAbierto(true);
  };

  // Guarda (crea o actualiza) un cliente en la API
  const handleGuardar = async () => {
    if (!form.razon_social.trim() || !form.identificacion_fiscal.trim()) {
      setError('Razón social y RUT/ID fiscal son obligatorios.');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      if (editando) {
        await peticionPut(`/api/clientes/${editando}`, form);
      } else {
        await peticionPost('/api/clientes', form);
      }
      setModalAbierto(false);
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  // Elimina un cliente previa confirmación
  const handleEliminar = async (id) => {
    if (!window.confirm('¿Eliminar este cliente? Los documentos vinculados no se verán afectados.')) return;
    try {
      await peticionDelete(`/api/clientes/${id}`);
      await cargar();
    } catch (err) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  const filtrados = clientes.filter((c) =>
    c.razon_social.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.identificacion_fiscal.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="fade-in">
      <header style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Building2 size={28} color="var(--primary)" /> Clientes
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: '0.9rem' }}>
            Cartera de importadores/exportadores — {clientes.length} cliente{clientes.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => abrirModal(null)} className="btn" style={{
          padding: '10px 20px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
          background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer',
        }}>
          <Plus size={18} /> Nuevo Cliente
        </button>
      </header>

      <div className="glass-panel" style={{ padding: '20px', marginBottom: '20px' }}>
        <div style={{ position: 'relative', maxWidth: '320px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="form-input"
            placeholder="Buscar por nombre o RUT..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ padding: '10px 12px 10px 36px', width: '100%', borderRadius: '10px', border: '1px solid var(--card-border)', fontSize: '0.9rem' }}
          />
        </div>
      </div>

      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        {filtrados.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            {busqueda ? 'No se encontraron clientes.' : 'No hay clientes registrados. Crea tu primer cliente.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--card-border)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                <th style={{ padding: '14px 16px', textAlign: 'left' }}>Razón Social</th>
                <th style={{ padding: '14px 16px', textAlign: 'left' }}>RUT/ID Fiscal</th>
                <th style={{ padding: '14px 16px', textAlign: 'left' }}>Contacto</th>
                <th style={{ padding: '14px 16px', textAlign: 'left' }}>Email</th>
                <th style={{ padding: '14px 16px', textAlign: 'right', width: '100px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--card-border)', fontSize: '0.88rem' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 600 }}>{c.razon_social}</td>
                  <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>{c.identificacion_fiscal}</td>
                  <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>{c.contacto_nombre || '—'}</td>
                  <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>{c.email || '—'}</td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <button onClick={() => abrirModal(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: '4px' }} title="Editar">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => handleEliminar(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: '4px', marginLeft: '4px' }} title="Eliminar">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalAbierto && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: 'var(--card-bg)', padding: '32px', borderRadius: '24px', width: '90%', maxWidth: '500px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid var(--card-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>{editando ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
              <button onClick={() => setModalAbierto(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>

            {error && (
              <div style={{ padding: '10px 14px', borderRadius: '10px', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--red)', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={16} /> {error}
              </div>
            )}

            <div style={{ display: 'grid', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Razón Social *</label>
                <input className="form-input" value={form.razon_social} onChange={(e) => setForm({ ...form, razon_social: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--card-border)', fontSize: '0.9rem' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>RUT / ID Fiscal *</label>
                <input className="form-input" value={form.identificacion_fiscal} onChange={(e) => setForm({ ...form, identificacion_fiscal: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--card-border)', fontSize: '0.9rem' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Email</label>
                  <input className="form-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--card-border)', fontSize: '0.9rem' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Teléfono</label>
                  <input className="form-input" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--card-border)', fontSize: '0.9rem' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Nombre de Contacto</label>
                <input className="form-input" value={form.contacto_nombre} onChange={(e) => setForm({ ...form, contacto_nombre: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--card-border)', fontSize: '0.9rem' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Dirección</label>
                <input className="form-input" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--card-border)', fontSize: '0.9rem' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button onClick={() => setModalAbierto(false)} className="btn btn-secondary" style={{ padding: '10px 20px', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleGuardar} disabled={guardando} className="btn" style={{
                padding: '10px 20px', borderRadius: '10px', fontWeight: 600, cursor: 'pointer',
                background: 'var(--primary)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                {guardando ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GestionClientes;

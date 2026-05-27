import React, { useState, useEffect } from 'react';
import { API_BASE } from '../services/api';
import { Shield, Plus, Trash2, AlertCircle, Calendar, DollarSign, Building, FileText, X, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

const v = (name) => `var(--${name})`;

const ESTADOS_GARANTIA = [
  { value: 'Vigente', color: v('green'), bg: 'rgba(16,185,129,0.1)' },
  { value: 'Vencida', color: v('red'), bg: 'rgba(239,68,68,0.1)' },
  { value: 'Ejecutada', color: v('yellow'), bg: 'rgba(245,158,11,0.1)' },
];

const TIPOS_GARANTIA = ['Poliza', 'Seguro', 'Boleta', 'Garantia'];

// Panel colapsable para gestionar garantías y pólizas de un documento
const GarantiasPanel = ({ documentoId }) => {
  const [garantias, setGarantias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    tipo: 'Poliza', numero: '', monto: '', moneda: 'USD',
    fecha_emision: '', fecha_vencimiento: '', emisor: '', observaciones: '',
  });
  const [saving, setSaving] = useState(false);

  // Obtiene la lista de garantías del documento
  const fetchGarantias = async () => {
    if (!documentoId) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/garantias/${documentoId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setGarantias(await res.json());
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchGarantias(); }, [documentoId]);

  // Crea una nueva garantía enviando los datos del formulario
  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const body = {
        ...form,
        monto: parseFloat(form.monto),
        fecha_emision: form.fecha_emision || null,
        fecha_vencimiento: form.fecha_vencimiento || null,
      };
      const res = await fetch(`${API_BASE}/api/garantias/${documentoId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowForm(false);
        setForm({ tipo: 'Poliza', numero: '', monto: '', moneda: 'USD', fecha_emision: '', fecha_vencimiento: '', emisor: '', observaciones: '' });
        fetchGarantias();
      }
    } catch { /* silencioso */ }
    finally { setSaving(false); }
  };

  // Elimina una garantía por su ID
  const handleDelete = async (id) => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const res = await fetch(`${API_BASE}/api/garantias/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) fetchGarantias();
  };

  const estadoCfg = (est) => ESTADOS_GARANTIA.find(e => e.value === est) || ESTADOS_GARANTIA[0];
  const fechaStr = (f) => f ? new Date(f).toLocaleDateString('es-CL') : '—';

  return (
    <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
      <div onClick={() => setOpen(!open)}
        style={{ padding: '16px 20px', borderBottom: open ? `1px solid ${v('card-border')}` : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0, color: v('text-main'), display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={16} color={v('primary')} /> Garant&iacute;as y P&oacute;lizas
          {garantias.length > 0 && <span style={{ fontSize: '0.7rem', color: 'white', background: v('primary'), borderRadius: '10px', padding: '1px 8px', fontWeight: 700 }}>{garantias.length}</span>}
        </h3>
        {open ? <ChevronUp size={16} color={v('text-muted')} /> : <ChevronDown size={16} color={v('text-muted')} />}
      </div>
      {open && (
        <div style={{ padding: '16px 20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}><RefreshCw size={20} className="spin" color={v('text-muted')} /></div>
          ) : garantias.length === 0 && !showForm ? (
            <div style={{ textAlign: 'center', padding: '20px', color: v('text-muted') }}>
              <Shield size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
              <p style={{ fontSize: '0.85rem' }}>Sin garant&iacute;as registradas</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {garantias.map(g => {
                const cfg = estadoCfg(g.estado);
                const vencida = g.fecha_vencimiento && new Date(g.fecha_vencimiento) < new Date();
                return (
                  <div key={g.id} style={{
                    padding: '12px', borderRadius: '10px', border: `1px solid ${vencida ? v('red') + '30' : v('card-border')}`,
                    background: vencida ? 'rgba(239,68,68,0.03)' : v('card-bg'), display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: v('text-main') }}>
                          {g.tipo} #{g.numero}
                        </span>
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 600, padding: '2px 8px', borderRadius: '10px',
                          background: cfg.bg, color: cfg.color,
                        }}>{g.estado}</span>
                        {vencida && <span style={{ fontSize: '0.65rem', color: v('red'), fontWeight: 600 }}>Vencida</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '16px', fontSize: '0.75rem', color: v('text-muted'), flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <DollarSign size={12} /> {g.monto.toLocaleString()} {g.moneda}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={12} /> {fechaStr(g.fecha_emision)} &rarr; {fechaStr(g.fecha_vencimiento)}
                        </span>
                        {g.emisor && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Building size={12} /> {g.emisor}
                        </span>}
                      </div>
                      {g.observaciones && <p style={{ fontSize: '0.7rem', color: v('text-muted'), margin: '6px 0 0' }}>{g.observaciones}</p>}
                    </div>
                    <button onClick={() => handleDelete(g.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: v('text-muted'), padding: '4px', flexShrink: 0 }}>
                      <Trash2 size={14} color={v('red')} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {showForm && (
            <form onSubmit={handleCreate} style={{ marginBottom: '12px', padding: '16px', borderRadius: '10px', border: `1px solid ${v('card-border')}`, background: 'rgba(0,0,0,0.01)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 600, color: v('text-muted'), display: 'block', marginBottom: '4px' }}>Tipo</label>
                  <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: `1px solid ${v('card-border')}`, fontSize: '0.8rem' }}>
                    {TIPOS_GARANTIA.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 600, color: v('text-muted'), display: 'block', marginBottom: '4px' }}>N&uacute;mero</label>
                  <input required value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: `1px solid ${v('card-border')}`, fontSize: '0.8rem' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 600, color: v('text-muted'), display: 'block', marginBottom: '4px' }}>Monto</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input required type="number" step="0.01" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })}
                      style={{ flex: 1, padding: '8px', borderRadius: '6px', border: `1px solid ${v('card-border')}`, fontSize: '0.8rem' }} />
                    <select value={form.moneda} onChange={e => setForm({ ...form, moneda: e.target.value })}
                      style={{ width: '70px', padding: '8px', borderRadius: '6px', border: `1px solid ${v('card-border')}`, fontSize: '0.8rem' }}>
                      <option value="USD">USD</option><option value="CLP">CLP</option><option value="EUR">EUR</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 600, color: v('text-muted'), display: 'block', marginBottom: '4px' }}>Emisor</label>
                  <input value={form.emisor} onChange={e => setForm({ ...form, emisor: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: `1px solid ${v('card-border')}`, fontSize: '0.8rem' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 600, color: v('text-muted'), display: 'block', marginBottom: '4px' }}>Emisi&oacute;n</label>
                  <input type="date" value={form.fecha_emision} onChange={e => setForm({ ...form, fecha_emision: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: `1px solid ${v('card-border')}`, fontSize: '0.8rem' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 600, color: v('text-muted'), display: 'block', marginBottom: '4px' }}>Vencimiento</label>
                  <input type="date" value={form.fecha_vencimiento} onChange={e => setForm({ ...form, fecha_vencimiento: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: `1px solid ${v('card-border')}`, fontSize: '0.8rem' }} />
                </div>
              </div>
              <div style={{ marginTop: '8px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: v('text-muted'), display: 'block', marginBottom: '4px' }}>Observaciones</label>
                <input value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: `1px solid ${v('card-border')}`, fontSize: '0.8rem' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '0.75rem' }}>
                  <X size={12} /> Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.75rem' }}>
                  {saving ? <RefreshCw size={12} className="spin" /> : <Plus size={12} />} Agregar
                </button>
              </div>
            </form>
          )}

          <button onClick={() => setShowForm(!showForm)} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.75rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? 'Cancelar' : 'Agregar Garant&iacute;a'}
          </button>
        </div>
      )}
    </div>
  );
};

export default GarantiasPanel;

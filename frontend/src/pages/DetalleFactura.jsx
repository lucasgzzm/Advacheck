import React, { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, CheckCircle, Save, XCircle, ArrowLeft } from 'lucide-react';

const InvoiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const rawData = location.state?.fullData;
  const historyData = location.state?.historyData;
  const pdfUrl = location.state?.fileUrl;

  // Poblar estado con datos dinámicos si existen, de lo contrario usar un fallback vacío
  const [factura, setFactura] = useState(() => {
    if (rawData) {
      return {
        numero: rawData.factura?.numero || 'N/A',
        emisor: rawData.remitente?.nombre || 'N/A',
        monto_total: rawData.economia?.total || 0,
        riesgo: rawData.riesgo || 'medio',
        observaciones: rawData.observaciones || 'Revisión manual requerida.',
        detalles: (rawData.detalles || []).map((d, i) => ({
          id: i + 1,
          descripcion: d.descripcion_producto,
          cantidad: d.cantidad,
          precio_unitario: d.precio_unitario,
          partida_sugerida: d.partida_sugerida,
          partida_corregida: '',
          inconsistente: false // Aquí podrías aplicar lógica real si la tuvieras por ítem
        }))
      };
    } else if (historyData) {
      return {
        numero: historyData.nombre_archivo || 'N/A',
        emisor: historyData.proveedor || 'N/A',
        monto_total: historyData.total_cif || 0,
        riesgo: historyData.riesgo || 'medio',
        observaciones: 'Recuperado desde el historial (Ítems detallados no guardados en DB).',
        detalles: [{
          id: 1,
          descripcion: 'Resumen consolidado (ver PDF original para detalles)',
          cantidad: 1,
          precio_unitario: historyData.total_cif || 0,
          partida_sugerida: 'No almacenada',
          partida_corregida: '',
          inconsistente: false
        }]
      };
    }
    
    // Fallback de seguridad (Mock) si alguien entra directo por la URL
    return {
      numero: 'FACT-00998',
      emisor: 'Sony Electronics',
      monto_total: 15400.00,
      riesgo: 'alto',
      observaciones: 'Datos no encontrados en sesión. Redirección sugerida.',
      detalles: []
    };
  });

  const handleCorrection = (idDetail, field, value) => {
    setFactura(prev => {
      const nuevosDetalles = prev.detalles.map(d => d.id === idDetail ? { ...d, [field]: value } : d);
      return { ...prev, detalles: nuevosDetalles };
    });
  };

  // Sincronizar dinámicamente el Total CIF cuando se editan los ítems
  React.useEffect(() => {
    if (factura.detalles && factura.detalles.length > 0 && factura.detalles[0].partida_sugerida !== 'No almacenada') {
      const nuevoTotal = factura.detalles.reduce((sum, item) => sum + (parseFloat(item.cantidad || 0) * parseFloat(item.precio_unitario || 0)), 0);
      setFactura(prev => ({ ...prev, monto_total: nuevoTotal.toFixed(2) }));
    }
  }, [factura.detalles]);

  const handlePreAprove = async () => {
    // Si la factura tiene un ID proveniente de la base de datos
    const targetId = historyData?.id;
    
    if (targetId) {
      try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const res = await fetch(`http://127.0.0.1:8000/api/facturas/${targetId}/aprobar`, {
          method: 'PUT',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ nuevo_total: parseFloat(factura.monto_total) })
        });
        
        if (res.ok) {
          alert('¡Operación guardada y pre-aprobada con éxito! Ya está visible para el Administrador como Aprobada.');
          navigate('/');
        } else {
          alert('Error al guardar la operación en la base de datos.');
        }
      } catch (err) {
        alert('Error de red al intentar contactar con el servidor.');
      }
    } else {
      // Caso de recién escaneada (el flujo ideal sería que el scan retornara el ID, pero simularemos)
      alert('¡Datos validados en memoria! Para guardar esta operación oficialmente, activa el autoguardado en el Dashboard.');
      navigate('/');
    }
  };

  const RiesgoBanner = () => {
    let bgColor, color, Icon;
    if (factura.riesgo === 'alto') { bgColor = 'rgba(239, 68, 68, 0.1)'; color = 'var(--red)'; Icon = XCircle; }
    else if (factura.riesgo === 'medio') { bgColor = 'rgba(245, 158, 11, 0.1)'; color = 'var(--yellow)'; Icon = AlertCircle; }
    else { bgColor = 'rgba(16, 185, 129, 0.1)'; color = 'var(--green)'; Icon = CheckCircle; }

    return (
      <div style={{ background: bgColor, color: color, padding: '24px', borderRadius: 'var(--radius-lg)', display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '32px', border: `1px solid ${color}40` }}>
        <Icon size={28} style={{ flexShrink: 0 }} />
        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
            Nivel de Riesgo Operativo: {factura.riesgo.toUpperCase()}
          </h3>
          <p style={{ margin: 0, opacity: 0.9, lineHeight: 1.6 }}>{factura.observaciones}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="fade-in">
      <button onClick={() => navigate('/')} className="btn btn-secondary" style={{ marginBottom: '24px', padding: '8px 16px' }}>
        <ArrowLeft size={16} /> Volver
      </button>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-1px', margin: 0 }}>Revisión de Factura: {factura.numero}</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px', fontSize: '1.1rem' }}>Emisor Comercial: {factura.emisor}</p>
        </div>
        <button onClick={handlePreAprove} className="btn btn-primary" style={{ padding: '16px 32px', fontSize: '1.1rem' }}>
          <CheckCircle size={20} /> Pre-Aprobar Operación
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', height: 'calc(100vh - 200px)' }}>
        
        {/* Lado Izquierdo: Visualizador PDF */}
        <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
           <div style={{ padding: '16px 24px', backgroundColor: 'rgba(0,0,0,0.03)', borderBottom: '1px solid var(--card-border)' }}>
             <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Documento Original (PDF)</h2>
           </div>
           {pdfUrl ? (
             <object data={pdfUrl} type="application/pdf" width="100%" height="100%" style={{ flex: 1, backgroundColor: '#525659' }}>
                <p style={{ textAlign: 'center', padding: '40px' }}>No se pudo cargar el PDF. <a href={pdfUrl} target="_blank" rel="noopener noreferrer">Descargar</a></p>
             </object>
           ) : (
             <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', padding: '40px', textAlign: 'center' }}>
                <p>El PDF original no está disponible en este momento.</p>
                <span style={{ fontSize: '0.85rem', opacity: 0.7 }}>Los documentos recuperados del historial de bitácora no almacenan el archivo físico original por razones de privacidad y espacio.</span>
             </div>
           )}
        </div>

        {/* Lado Derecho: Formulario de Edición */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto', paddingRight: '8px' }}>
          <RiesgoBanner />

          <div className="glass-panel">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '20px' }}>Datos de Cabecera A-3</h2>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Número Documento</label>
                <input className="form-input" type="text" value={factura.numero} disabled />
              </div>
              <div className="form-group">
                <label className="form-label">Monto Total USD Declarado</label>
                <input className="form-input" type="text" value={`$${factura.monto_total}`} disabled />
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--card-border)' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Líneas de Detalle (Ítems)</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '4px' }}>Corrige las partidas arancelarias y valores anómalos para bajar el riesgo.</p>
            </div>
            
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {factura.detalles.length === 0 ? (
                 <p style={{ color: 'var(--text-muted)' }}>No hay ítems para mostrar.</p>
              ) : (
                 factura.detalles.map((item, idx) => (
                  <div key={item.id} style={{ 
                    padding: '20px', 
                    borderRadius: 'var(--radius-md)', 
                    border: item.inconsistente ? '2px solid var(--red)' : '1px solid var(--card-border)',
                    background: 'rgba(255,255,255,0.02)',
                    position: 'relative'
                  }}>
                    {item.inconsistente && (
                      <div style={{ position: 'absolute', top: -10, right: -10, background: 'var(--red)', color: 'white', padding: '4px', borderRadius: '50%' }}>
                        <AlertCircle size={16} />
                      </div>
                    )}
                    <div style={{ marginBottom: '16px', fontWeight: 600, fontSize: '1.1rem' }}>#{idx+1} - {item.descripcion}</div>
                    <div className="grid-2" style={{ gap: '16px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Cantidad</label>
                        <input className="form-input" type="number" value={item.cantidad} 
                          onChange={(e) => handleCorrection(item.id, 'cantidad', parseFloat(e.target.value))} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Precio Unit. (USD)</label>
                        <input className="form-input" type="number" value={item.precio_unitario}
                          onChange={(e) => handleCorrection(item.id, 'precio_unitario', parseFloat(e.target.value))} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ color: 'var(--primary)' }}>Partida Sugerida</label>
                        <input className="form-input" type="text" value={item.partida_sugerida} disabled style={{ background: 'var(--primary-light)', borderColor: 'var(--primary)', color: 'var(--primary)', fontWeight: 600 }} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Corrección Manual (Partida)</label>
                        <input className="form-input" type="text" placeholder="Ej: 8471.30.00.00" value={item.partida_corregida}
                          onChange={(e) => handleCorrection(item.id, 'partida_corregida', e.target.value)} />
                      </div>
                    </div>
                  </div>
                 ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceDetail;

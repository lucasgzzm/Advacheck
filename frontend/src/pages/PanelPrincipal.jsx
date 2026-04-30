import React, { useState, useEffect } from 'react';
import { UploadCloud, CheckCircle, AlertTriangle, AlertCircle, RefreshCw, Eye, Cpu, Activity, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const [autoSave, setAutoSave] = useState(true);
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [oversizeError, setOversizeError] = useState(null);
  const [serverError, setServerError] = useState(null);

  // Estado para Límite de IA (Gemini Free Tier: 15 Requests Per Minute)
  const MAX_RPM = 15;
  const [aiQuota, setAiQuota] = useState(() => {
    const saved = sessionStorage.getItem('aiQuota');
    return saved !== null ? parseInt(saved, 10) : MAX_RPM;
  });
  const [rateLimitError, setRateLimitError] = useState(false);

  // Guardar en sessionStorage cada vez que cambie
  useEffect(() => {
    sessionStorage.setItem('aiQuota', aiQuota);
  }, [aiQuota]);

  // Recargar la cuota de la IA cada minuto (Cooldown natural)
  useEffect(() => {
    const timer = setInterval(() => {
      setAiQuota(MAX_RPM);
    }, 60000); // 60 segundos
    return () => clearInterval(timer);
  }, []);

  // Limpiar la URL del objeto al desmontar
  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  // Funciones drag and drop
  const handleDragOver = (e) => { 
    e.preventDefault(); 
    setIsDragging(true); 
  };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };
  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleFileUpload = (uploadedFile) => {
    if (uploadedFile.type !== "application/pdf") {
      alert("Por favor sube un archivo PDF válido.");
      return;
    }

    // Límite de la capa gratuita de Azure (4MB)
    const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 Megabytes
    if (uploadedFile.size > MAX_FILE_SIZE) {
      const sizeMB = (uploadedFile.size / (1024*1024)).toFixed(2);
      setOversizeError(sizeMB);
      
      // Registrar evento silencioso en la Campana de Notificaciones global
      window.dispatchEvent(new CustomEvent('addSystemNotification', {
        detail: {
          title: 'Documento Rechazado',
          message: `El archivo ${uploadedFile.name} excede el límite de Azure (4MB).`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      }));
      return;
    }

    // Validación de Límite de IA
    if (aiQuota <= 0) {
      setRateLimitError(true);
      return;
    }

    setFile(uploadedFile);
    
    // Descontar una petición de la cuota de la IA inmediatamente
    setAiQuota(prev => prev - 1);
    
    // Crear URL temporal para previsualizar el PDF
    const url = URL.createObjectURL(uploadedFile);
    setFileUrl(url);

    setProcessing(true);
    setExtractedData(null);
    
    // Conexión real con el motor OCR / Extracción del Backend
    const formData = new FormData();
    formData.append('file', uploadedFile);

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    
    // Añadimos el parámetro de guardado dinámico
    fetch(`http://127.0.0.1:8000/api/facturas/scan?guardar=${autoSave}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData,
    })
    .then(async response => {
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error en el procesamiento del PDF');
      }
      return response.json();
    })
    .then(data => {
      setExtractedData(data);
    })
    .catch(err => {
      console.error("Error de extracción:", err);
      // Si el servidor lanza 429 explícito, agotamos la cuota por seguridad
      if (err.message && err.message.includes('429')) {
        setAiQuota(0);
        setRateLimitError(true);
      } else {
        // Mostramos el error explícito del backend en lugar de ignorarlo
        setServerError(err.message || 'Error desconocido al contactar con la API.');
      }
      handleReset();
    })
    .finally(() => {
      setProcessing(false);
    });
  };

  // Resetea el panel y permite subir otro archivo
  const handleReset = () => {
    setFile(null);
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFileUrl(null);
    setExtractedData(null);
  };

  const getRiskBanner = (riesgo, observaciones) => {
    let bgColor, color, Icon, texto;
    if (riesgo === 'alto') { bgColor = 'rgba(239, 68, 68, 0.1)'; color = 'var(--red)'; Icon = AlertCircle; texto = 'Riesgo Alto'; }
    else if (riesgo === 'medio') { bgColor = 'rgba(245, 158, 11, 0.1)'; color = 'var(--yellow)'; Icon = AlertTriangle; texto = 'Riesgo Medio'; }
    else { bgColor = 'rgba(16, 185, 129, 0.1)'; color = 'var(--green)'; Icon = CheckCircle; texto = 'Riesgo Bajo'; }

    return (
      <div style={{ background: bgColor, color: color, padding: '20px', borderRadius: 'var(--radius-md)', display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '24px', border: `1px solid ${color}40` }}>
        <Icon size={24} style={{ flexShrink: 0 }} />
        <div>
          <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 4px 0' }}>Semáforo: {texto}</h4>
          <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.9 }}>{observaciones}</p>
        </div>
      </div>
    );
  };

  // Componente Reutilizable para Secciones de Datos
  const DataSection = ({ title, children }) => (
    <div style={{ padding: '16px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
      <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</h3>
      <div style={{ display: 'grid', gap: '12px' }}>
        {children}
      </div>
    </div>
  );

  const InputField = ({ label, value, colorClass }) => (
    <div>
      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</label>
      <input 
        readOnly 
        className="form-input" 
        style={{ padding: '8px 12px', fontSize: '0.9rem', backgroundColor: colorClass ? 'var(--primary-light)' : 'rgba(0,0,0,0.02)', borderColor: colorClass ? 'var(--primary)' : 'var(--card-border)', color: colorClass ? 'var(--primary)' : 'inherit', fontWeight: colorClass ? '600' : 'normal' }} 
        value={value} 
      />
    </div>
  );

  return (
    <div className="fade-in" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <header className="dashboard-header" style={{ 
        marginBottom: '32px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start', 
        gap: '24px',
        flexWrap: 'wrap' 
      }}>
        <div style={{ flex: '1', minWidth: '300px' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-1px', margin: 0 }}>Terminal de Prevalidación</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px', fontSize: '1.05rem' }}>Carga el documento para iniciar la extracción asistida y la vista previa interactiva.</p>
        </div>
        
        {/* Centro de Control y Telemetría de la IA (Simplificado) */}
        <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
          
          {/* Métrica de Tokens (Session Total) - Estilo Compacto Independiente */}
           <div style={{ 
            padding: '12px 20px', 
            borderRadius: '16px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '16px', 
            border: `1px solid ${aiQuota <= 3 ? 'var(--red)' : 'var(--card-border)'}`, 
            background: aiQuota <= 3 ? 'rgba(239, 68, 68, 0.05)' : 'var(--card-bg)',
            whiteSpace: 'nowrap',
            boxShadow: 'var(--card-shadow)',
            height: 'fit-content',
            transition: 'all 0.3s'
          }}>
             <div style={{ 
               width: '40px', 
               height: '40px', 
               borderRadius: '12px', 
               backgroundColor: aiQuota <= 3 ? 'rgba(239, 68, 68, 0.1)' : 'var(--primary-light)', 
               display: 'flex', 
               alignItems: 'center', 
               justifyContent: 'center',
               flexShrink: 0
             }}>
               <Zap size={22} color={aiQuota <= 3 ? 'var(--red)' : 'var(--primary)'} />
             </div>
             <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: '1.2' }}>
                  Límite IA / Minuto
                </span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: aiQuota <= 3 ? 'var(--red)' : 'var(--primary)', display: 'flex', alignItems: 'baseline', gap: '4px', lineHeight: '1.2' }}>
                  {aiQuota} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>/ {MAX_RPM}</span>
                </span>
             </div>
          </div>

        </div>
      </header>

      <div className="dashboard-container">
      {/* Modal de Error del Servidor (IA fallida, OCR fallido, 503, 500) */}
      {serverError && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: 'var(--card-bg)', padding: '32px', borderRadius: '16px',
            maxWidth: '500px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--red)'
          }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <AlertCircle size={32} color="#ef4444" />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '16px' }}>Error de Extracción</h2>
            <p style={{ color: 'var(--red)', marginBottom: '24px', lineHeight: '1.5', fontSize: '0.95rem', backgroundColor: 'rgba(239, 68, 68, 0.05)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              {serverError}
            </p>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>
              El proceso fue abortado para evitar la generación de datos corruptos o falsos. Por favor, intenta de nuevo.
            </p>
            <button 
              onClick={() => setServerError(null)}
              style={{
                backgroundColor: 'var(--red)', color: 'white', border: 'none', padding: '12px 24px',
                borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', width: '100%', transition: 'opacity 0.2s'
              }}
              onMouseOver={(e) => e.target.style.opacity = 0.9}
              onMouseOut={(e) => e.target.style.opacity = 1}
            >
              Cerrar y Reintentar
            </button>
          </div>
        </div>
      )}

      {/* Modal de Error de Tamaño */}
      {oversizeError && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: 'var(--card-bg)', padding: '32px', borderRadius: '16px',
            maxWidth: '450px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--card-border)'
          }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <AlertTriangle size={32} color="#ef4444" />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '16px' }}>Documento Demasiado Pesado</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px', lineHeight: '1.5', fontSize: '0.95rem' }}>
              El archivo pesa <strong>{oversizeError} MB</strong>.<br /><br />
              Para mantener los tiempos de respuesta y aprovechar el motor gratuito, el sistema requiere PDFs de máximo <strong>4 MB</strong>. Por favor, comprímelo y vuelve a intentarlo.
            </p>
            <button 
              onClick={() => setOversizeError(null)}
              style={{
                backgroundColor: 'var(--primary)', color: 'white', border: 'none', padding: '12px 24px',
                borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', width: '100%', transition: 'opacity 0.2s'
              }}
              onMouseOver={(e) => e.target.style.opacity = 0.9}
              onMouseOut={(e) => e.target.style.opacity = 1}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Modal de Límite de IA Excedido */}
      {rateLimitError && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: 'var(--card-bg)', padding: '32px', borderRadius: '16px',
            maxWidth: '450px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--card-border)'
          }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <Zap size={32} color="var(--yellow)" />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '16px' }}>Enfriamiento de Inteligencia Artificial</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px', lineHeight: '1.5', fontSize: '0.95rem' }}>
              Has alcanzado el límite gratuito de Google Gemini (15 peticiones por minuto). <br /><br />
              Por favor, espera unos segundos a que el contador de la barra superior se recargue para continuar procesando documentos sin errores.
            </p>
            <button 
              onClick={() => setRateLimitError(false)}
              style={{
                backgroundColor: 'var(--yellow)', color: '#000', border: 'none', padding: '12px 24px',
                borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', width: '100%', transition: 'opacity 0.2s'
              }}
              onMouseOver={(e) => e.target.style.opacity = 0.9}
              onMouseOut={(e) => e.target.style.opacity = 1}
            >
              Cerrar y Esperar
            </button>
          </div>
        </div>
      )}

      <div className="dashboard-layout">
        
        {/* Lado Izquierdo: Previsualizador PDF Interactivo */}
        <div className="glass-panel" style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          height: '100%', 
          padding: fileUrl ? '0' : '32px', // Aumentado de 24px a 32px
          overflow: 'hidden' 
        }}>
          
          {!fileUrl ? (
            <div 
              onDragOver={handleDragOver} 
              onDragLeave={handleDragLeave} 
              onDrop={handleDrop}
              style={{ 
                flex: 1, 
                margin: '12px', // Añadido margen para que el borde punteado no toque los bordes
                border: `2px dashed ${isDragging ? 'var(--primary)' : 'var(--card-border)'}`, 
                borderRadius: 'var(--radius-md)', 
                backgroundColor: isDragging ? 'var(--primary-light)' : 'rgba(255,255,255,0.03)',
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                transition: 'all 0.2s', 
                cursor: 'pointer', 
                position: 'relative',
                minHeight: '400px'
              }}
            >
              <input type="file" accept=".pdf" onChange={handleFileInput} style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 10 }} />
              
              <div style={{ textAlign: 'center', padding: '0 40px' }}>
                <UploadCloud size={56} color="var(--primary)" style={{ marginBottom: '16px', opacity: 0.9 }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 12px 0' }}>Arrastra tu Factura Comercial PDF</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5, maxWidth: '300px', margin: '0 auto' }}>
                  Suelta el documento aquí para montarlo en el visor e iniciar la lectura OCR automática.
                </p>
                
                {/* Toggle de Guardado - Elevamos el z-index para que no lo cubra el input invisible */}
                <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', position: 'relative', zIndex: 20 }}>
                   <label style={{ position: 'relative', display: 'inline-block', width: '40px', height: '20px' }}>
                      <input 
                        type="checkbox" 
                        checked={autoSave} 
                        onChange={() => setAutoSave(!autoSave)}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span style={{ 
                        position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, 
                        backgroundColor: autoSave ? 'var(--primary)' : '#ccc', transition: '0.4s', borderRadius: '20px' 
                      }}>
                        <span style={{ 
                           position: 'absolute', content: '""', height: '14px', width: '14px', left: autoSave ? '22px' : '4px', bottom: '3px', 
                           backgroundColor: 'white', transition: '0.4s', borderRadius: '50%' 
                        }} />
                      </span>
                   </label>
                   <span style={{ fontSize: '0.85rem', fontWeight: 600, color: autoSave ? 'var(--primary)' : 'var(--text-muted)' }}>
                      {autoSave ? 'Guardar en historial' : 'No guardar (Solo previsualización)'}
                   </span>
                </div>

                <button className="btn btn-primary" style={{ marginTop: '24px' }}>Explorar Archivos</button>
              </div>
            </div>
          ) : (
             <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ padding: '16px 24px', backgroundColor: 'rgba(0,0,0,0.03)', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Eye size={18} color="var(--primary)" />
                      <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Vista Previa Estricta (PDF Original)</span>
                   </div>
                   <button onClick={handleReset} className="btn" style={{ padding: '6px 12px', fontSize: '0.8rem', backgroundColor: 'var(--bg-color)', border: '1px solid var(--card-border)', color: 'var(--text-main)' }}>
                     Cambiar Archivo
                   </button>
                </div>
                {/* Visualizador de Navegador Nativo */}
                <object 
                  data={fileUrl} 
                  type="application/pdf" 
                  width="100%" 
                  height="100%"
                  style={{ flex: 1, backgroundColor: '#525659' }} /* Background típico para PDFs */
                >
                  <p style={{ textAlign: 'center', padding: '40px' }}>Tu navegador no soporta visualización interna de PDFs. <a href={fileUrl} target="_blank" rel="noopener noreferrer">Descargar para ver.</a></p>
                </object>
             </div>
          )}
        </div>

        {/* Lado Derecho: Extracción OCR y Semáforo */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: '0' }}>
          
          <div style={{ padding: '24px', borderBottom: '1px solid var(--card-border)', position: 'sticky', top: 0, backgroundColor: 'var(--card-bg)', backdropFilter: 'blur(10px)', zIndex: 5 }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Resultados de Inspección</h2>
          </div>

          <div style={{ padding: '24px' }}>
            {!file && !processing && !extractedData && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-muted)', textAlign: 'center' }}>
                  <AlertTriangle size={40} style={{ opacity: 0.3, marginBottom: '16px' }} />
                  <p>Esperando documento para procesar las reglas de inteligencia aduanera.</p>
              </div>
            )}

            {processing && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--primary)' }}>
                <RefreshCw size={40} className="lucide-spin" style={{ marginBottom: '20px', animation: 'spin 1.5s linear infinite' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 8px 0', color: 'var(--text-main)' }}>Escaneando y Validando...</h3>
                <p style={{ fontWeight: 400, color: 'var(--text-muted)' }}>Clasificando estructuras lógicas, rutas y aranceles.</p>
              </div>
            )}

            {extractedData && (
              <div className="fade-in">
                {getRiskBanner(extractedData.riesgo, extractedData.observaciones)}

                {extractedData.validacion_error && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--red)', padding: '16px', borderRadius: 'var(--radius-sm)', marginBottom: '24px', border: '1px solid var(--red)40', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <AlertCircle size={20} />
                    <strong>Inconsistencia detectada:</strong> {extractedData.mensaje_error}
                  </div>
                )}

                <DataSection title="Relación Comercial (Origen/Destino)">
                  <InputField label="Remitente (Emisor)" value={`${extractedData.remitente.nombre} | ${extractedData.remitente.documento}`} />
                  <InputField label="Dir. Remitente" value={extractedData.remitente.direccion} />
                  <div style={{ marginTop: '8px' }}>
                    <InputField label="Destinatario (Receptor)" value={`${extractedData.destinatario.nombre} | ${extractedData.destinatario.documento}`} />
                    <InputField label="Dir. Destinatario" value={extractedData.destinatario.direccion} />
                  </div>
                </DataSection>

                <DataSection title="Trazabilidad y Documento">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                     <InputField label="Nº de Factura" value={extractedData.factura.numero} />
                     <InputField label="Fecha Emisión" value={extractedData.factura.fecha} />
                     <InputField label="País Manifiesto" value={extractedData.transporte.paisOrigen} />
                     <InputField label="Tipo de Transporte" value={extractedData.transporte.metodo} />
                     <InputField label="Courier Autorizado" value={extractedData.transporte.courier} />
                     <InputField label="Tracking (Guía)" value={extractedData.transporte.tracking} />
                  </div>
                </DataSection>

                <DataSection title="Desglose Financiero">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                     <InputField label={`Subtotal FOB (${extractedData.factura.moneda})`} value={extractedData.economia.subtotal} />
                     <InputField label={`Flete / Envío (${extractedData.factura.moneda})`} value={extractedData.economia.envio} />
                     <InputField label={`Seguro (${extractedData.factura.moneda})`} value={extractedData.economia.seguro} />
                     <InputField label={`Gran Total CIF (${extractedData.factura.moneda})`} value={extractedData.economia.total} colorClass={true} />
                  </div>
                </DataSection>

                <DataSection title="Resolución Aduanera (Sugerida)">
                   <InputField label="Clasificación Arancelaria Predominante (HS Code)" value={extractedData.partidaPrincipal} colorClass={true} />
                </DataSection>

                <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingBottom: '24px' }}>
                  <button onClick={handleReset} className="btn btn-secondary">Rechazar / Re-escanear</button>
                  <Link to="/factura/1/editar" state={{ fullData: extractedData, fileUrl: fileUrl }} className="btn btn-primary">Revisar Ítems y Proceder (Siguiente Fase)</Link>
                </div>
              </div>
            )}
          </div>
        </div>
        
      </div>
      </div>
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default Dashboard;

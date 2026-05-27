import React, { useState } from 'react';
import {
  UploadCloud, CheckCircle, AlertTriangle, FileText, Loader2,
  ArrowRight, Scale, Ship, Package, Award, FileSpreadsheet,
  ShieldAlert, Weight, Hash, DollarSign, Globe, Users
} from 'lucide-react';
import PipelinePrevalidacion from '../components/PipelinePrevalidacion';
import { peticionPost } from '../services/api';

const SEVERIDAD_CONFIG = {
  ALTA: { color: 'var(--red)', bg: 'rgba(239,68,68,0.08)', icono: ShieldAlert },
  MEDIA: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', icono: AlertTriangle },
  BAJA: { color: '#6b7280', bg: 'rgba(107,114,128,0.08)', icono: AlertTriangle },
};

// Componente principal: conciliación multi-documento para validación cruzada de facturas
const ValidacionCruzada = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [prevalidacion, setPrevalidacion] = useState(null);
  const [confianza, setConfianza] = useState(null);
  const [cuadratura, setCuadratura] = useState(null);
  const [error, setError] = useState(null);

  // Maneja la selección de archivos PDF para la validación
  const handleFileChange = (e) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
      setResultado(null);
      setError(null);
    }
  };

  // Envía los documentos al servidor para realizar la validación cruzada
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (files.length < 2) {
      setError('Sube al menos 2 documentos para realizar validación cruzada.');
      return;
    }

    setLoading(true);
    setError(null);
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');

    const formData = new FormData();
    files.forEach(f => formData.append('files', f));

    try {
      const data = await peticionPost('/api/facturas/scan-multi', formData);
      const payload = data.data;
      setResultado(payload.validacion_cruzada || payload);
      setPrevalidacion(payload.prevalidacion || null);
      setConfianza(payload.confianza || null);
      setCuadratura(payload.cuadratura_items || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const discrepancias = resultado?.lista_discrepancias || [];
  const coincidencias = resultado?.coincidencias_clave || [];

  const discrepanciasAlta = discrepancias.filter(d => d.severidad === 'ALTA');
  const discrepanciasMedia = discrepancias.filter(d => d.severidad === 'MEDIA');
  const discrepanciasBaja = discrepancias.filter(d => d.severidad === 'BAJA');

  const gruposComparacion = {
    'Factura vs Bill of Lading (B/L)': {
      icono: Ship, color: '#0891b2',
      items: discrepancias.filter(d =>
        d.campo.toLowerCase().includes('flete') ||
        d.campo.toLowerCase().includes('peso') ||
        d.campo.toLowerCase().includes('bulto') ||
        d.campo.toLowerCase().includes('bl') ||
        d.campo.toLowerCase().includes('bill') ||
        d.campo.toLowerCase().includes('puerto')
      ),
      descripcion: 'Conciliación de pesos brutos/netos, cantidad de bultos, flete marítimo y puertos.',
    },
    'Factura vs Packing List': {
      icono: Package, color: '#65a30d',
      items: discrepancias.filter(d =>
        d.campo.toLowerCase().includes('cantidad') ||
        d.campo.toLowerCase().includes('packing') ||
        d.campo.toLowerCase().includes('empaque') ||
        d.campo.toLowerCase().includes('descripcion') ||
        d.campo.toLowerCase().includes('producto')
      ),
      descripcion: 'Cuadre de cantidades físicas, descripciones de producto y unidades de medida.',
    },
    'Factura vs Certificado de Origen': {
      icono: Award, color: '#7c3aed',
      items: discrepancias.filter(d =>
        d.campo.toLowerCase().includes('origen') ||
        d.campo.toLowerCase().includes('exportador') ||
        d.campo.toLowerCase().includes('importador') ||
        d.campo.toLowerCase().includes('proveedor') ||
        d.campo.toLowerCase().includes('tlc') ||
        d.campo.toLowerCase().includes('certificado')
      ),
      descripcion: 'Verificación de proveedor, país de origen, elegibilidad TLC y coincidencia de mercancías.',
    },
    'Conciliación de Valores': {
      icono: DollarSign, color: '#d97706',
      items: discrepancias.filter(d =>
        d.campo.toLowerCase().includes('valor') ||
        d.campo.toLowerCase().includes('monto') ||
        d.campo.toLowerCase().includes('total') ||
        d.campo.toLowerCase().includes('cif') ||
        d.campo.toLowerCase().includes('fob') ||
        d.campo.toLowerCase().includes('moneda')
      ),
      descripcion: 'Conciliación de montos totales, valores FOB/CIF y moneda entre documentos.',
    },
  };

  const documentos = resultado?.documentos_identificados || [];

  return (
    <div className="fade-in">
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Scale size={32} color="var(--primary)" />
          Conciliación Multi-Documento
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
          Cruza visualmente Factura Comercial vs Bill of Lading vs Packing List vs Certificado de Origen para detectar discrepancias.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: resultado ? '380px 1fr' : '1fr', gap: '24px', alignItems: 'start' }}>

        {/* Upload Panel */}
        <div className="glass-panel" style={{ padding: '28px', position: 'sticky', top: '24px' }}>
          <form onSubmit={handleSubmit}>
            <div
              style={{
                border: '2px dashed var(--primary)', borderRadius: '12px', padding: '32px 20px',
                textAlign: 'center', backgroundColor: 'var(--primary-light)', cursor: 'pointer',
                transition: 'all 0.3s',
              }}
              onClick={() => document.getElementById('multi-file-upload').click()}
            >
              <UploadCloud size={40} color="var(--primary)" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ margin: '0 0 6px', color: 'var(--primary)', fontWeight: 600, fontSize: '1rem' }}>
                {files.length > 0 ? `${files.length} archivo(s) seleccionado(s)` : 'Sube documentos PDF'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Factura, B/L, Packing List, Cert. Origen</p>
              <input
                id="multi-file-upload" type="file" multiple accept=".pdf"
                onChange={handleFileChange} style={{ display: 'none' }}
              />
            </div>

            {files.length > 0 && (
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {files.map((f, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 12px', backgroundColor: 'rgba(0,0,0,0.015)',
                    border: '1px solid var(--card-border)', borderRadius: '8px', fontSize: '0.8rem',
                  }}>
                    <FileText size={14} color="var(--primary)" />
                    <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{f.name}</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {(f.size / 1024).toFixed(0)} KB
                    </span>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div style={{
                marginTop: '16px', padding: '10px 14px', borderRadius: '8px',
                backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                color: 'var(--red)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <AlertTriangle size={16} /> {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '20px' }} disabled={loading || files.length < 2}>
              {loading ? <><Loader2 size={16} className="spin" /> Analizando documentos...</> : 'Iniciar Conciliación'}
            </button>
          </form>

          {/* Mini guía */}
          <div style={{ marginTop: '20px', padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(124,58,237,0.03)', border: '1px solid rgba(124,58,237,0.1)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--text-main)' }}>Documentos recomendados:</strong>
            <ul style={{ margin: '6px 0 0 0', paddingLeft: '16px', lineHeight: 1.8 }}>
              <li>Factura Comercial</li>
              <li>Bill of Lading / Guía Aérea</li>
              <li>Packing List</li>
              <li>Certificado de Origen</li>
            </ul>
          </div>
        </div>

        {/* Results Panel */}
        {resultado && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Resumen Global */}
            <div className="glass-panel" style={{
              padding: '24px',
              border: `2px solid ${resultado.discrepancias_encontradas ? 'var(--red)' : 'var(--green)'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  padding: '14px', borderRadius: '12px',
                  backgroundColor: resultado.discrepancias_encontradas ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                }}>
                  {resultado.discrepancias_encontradas
                    ? <AlertTriangle size={28} color="var(--red)" />
                    : <CheckCircle size={28} color="var(--green)" />
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: resultado.discrepancias_encontradas ? 'var(--red)' : 'var(--green)' }}>
                    {resultado.discrepancias_encontradas
                      ? `${discrepanciasAlta.length} Discrepancia(s) Crítica(s) Detectada(s)`
                      : 'Documentos Conciliados — Sin Discrepancias'
                    }
                  </h2>
                  <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{resultado.conclusion}</p>
                </div>

                {/* Métricas rápidas */}
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  {discrepanciasAlta.length > 0 && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--red)' }}>{discrepanciasAlta.length}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Críticas</div>
                    </div>
                  )}
                  {discrepanciasMedia.length > 0 && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f59e0b' }}>{discrepanciasMedia.length}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Medias</div>
                    </div>
                  )}
                  {discrepanciasBaja.length > 0 && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#6b7280' }}>{discrepanciasBaja.length}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Menores</div>
                    </div>
                  )}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--green)' }}>{coincidencias.length}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Coincidencias</div>
                  </div>
                </div>
              </div>

              {/* Documentos Identificados */}
              <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {documentos.map((doc, i) => (
                  <span key={i} style={{
                    padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
                    backgroundColor: 'rgba(124,58,237,0.08)', color: '#a78bfa',
                    border: '1px solid rgba(124,58,237,0.15)',
                    display: 'flex', alignItems: 'center', gap: '4px',
                  }}>
                    <FileText size={12} /> {doc}
                  </span>
                ))}
              </div>
            </div>

            {/* Grupos de Comparación Visual */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {Object.entries(gruposComparacion).map(([titulo, grupo]) => {
                const Icono = grupo.icono;
                const tieneItems = grupo.items.length > 0;
                if (!tieneItems && !coincidencias.length) return null;
                return (
                  <div key={titulo} className="glass-panel" style={{
                    padding: '20px',
                    border: tieneItems ? `1px solid ${grupo.color}40` : '1px solid var(--card-border)',
                    opacity: tieneItems ? 1 : 0.6,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                      <div style={{
                        padding: '8px', borderRadius: '8px',
                        backgroundColor: `${grupo.color}20`,
                      }}>
                        <Icono size={18} color={grupo.color} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: grupo.color }}>
                          {titulo}
                        </h3>
                        <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {grupo.descripcion}
                        </p>
                      </div>
                      {!tieneItems && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--green)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle size={12} /> Sin discrepancias
                        </span>
                      )}
                    </div>

                    {tieneItems && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {grupo.items.map((disc, i) => {
                          const SevCfg = SEVERIDAD_CONFIG[disc.severidad] || SEVERIDAD_CONFIG.MEDIA;
                          const SevIcon = SevCfg.icono;
                          return (
                            <div key={i} style={{
                              padding: '10px 14px',
                              backgroundColor: SevCfg.bg,
                              borderLeft: `3px solid ${SevCfg.color}`,
                              borderRadius: '0 8px 8px 0',
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                  <SevIcon size={12} style={{ marginRight: '4px', color: SevCfg.color }} />
                                  {disc.campo}
                                </span>
                                <span style={{
                                  fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
                                  backgroundColor: `${SevCfg.color}20`, color: SevCfg.color,
                                }}>
                                  {disc.severidad}
                                </span>
                              </div>
                              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                                {disc.descripcion}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Coincidencias Clave */}
            {coincidencias.length > 0 && (
              <div className="glass-panel" style={{ padding: '20px' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: '0.9rem', fontWeight: 700, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={16} /> Coincidencias Clave entre Documentos
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {coincidencias.map((c, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: '10px',
                      padding: '10px 14px', borderRadius: '8px',
                      backgroundColor: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.15)',
                      fontSize: '0.85rem',
                    }}>
                      <CheckCircle size={16} color="var(--green)" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span style={{ color: 'var(--text-main)' }}>{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resumen para informe */}
            <div style={{ textAlign: 'center', padding: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {documentos.length} documento(s) analizado(s) · {discrepancias.length} discrepancia(s) encontrada(s) · {coincidencias.length} coincidencia(s) clave
            </div>
          </div>
        )}

        {prevalidacion && (
          <div className="glass-panel" style={{ padding: '24px', marginTop: '24px' }}>
            <PipelinePrevalidacion prevalidacion={prevalidacion} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ValidacionCruzada;

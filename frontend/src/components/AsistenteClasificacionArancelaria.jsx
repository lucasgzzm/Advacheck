import React, { useState, useMemo } from 'react';
import {
  Sparkles, Scale, Check, X, Search, ChevronDown, ChevronRight,
  BookOpen, AlertTriangle, ShieldAlert, Loader2, FileText,
  Globe, Info, Hash
} from 'lucide-react';
import { obtenerArbolCompleto, obtenerCapitulo, buscarEnArbol } from '../data/arancel';

const SUFICIENCIA_MAP = {
  SUFICIENTE: { label: 'Legalmente Suficiente', color: 'var(--green)', bg: 'rgba(34,197,94,0.1)' },
  INSUFICIENTE: { label: 'Requiere Regla Complementaria', color: 'var(--yellow)', bg: 'rgba(245,158,11,0.1)' },
};

// Componente de asistencia para clasificación arancelaria con IA y corrección manual (Human-in-the-Loop)
export default function AsistenteClasificacionArancelaria({
  item,
  clasificacionIA,
  clasificando,
  errorIA,
  onSolicitarClasificacion,
  onAplicarPartida,
  onAplicarCorreccion,
}) {
  const [busqueda, setBusqueda] = useState('');
  const [seccionExpanded, setSeccionExpanded] = useState(null);
  const [capituloExpanded, setCapituloExpanded] = useState(null);
  const [partidaSeleccionada, setPartidaSeleccionada] = useState(null);
  const [justificacionHumana, setJustificacionHumana] = useState('');
  const [modoAuditor, setModoAuditor] = useState(false);
  const [arbolExpandido, setArbolExpandido] = useState(false);
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);
  const [notasExpandidas, setNotasExpandidas] = useState(true);

  const resultadoIA = clasificacionIA?.result;
  const partidaIASugerida = resultadoIA?.partida_sugerida || '';
  const codigoCapituloIA = partidaIASugerida?.substring(0, 2);
  const codigoPartidaIA = partidaIASugerida?.substring(0, 4);
  const capituloIA = codigoCapituloIA ? obtenerCapitulo(codigoCapituloIA) : null;

  const codigoActivo = partidaSeleccionada?.codigo || codigoPartidaIA;
  const capituloActivo = codigoActivo ? obtenerCapitulo(codigoActivo.substring(0, 2)) : null;

  // Busca capítulos o partidas en el árbol arancelario
  const handleBuscar = (valor) => {
    setBusqueda(valor);
    if (valor.trim().length >= 2) {
      setResultadosBusqueda(buscarEnArbol(valor));
    } else {
      setResultadosBusqueda([]);
    }
  };

  // Selecciona una partida del árbol o resultados de búsqueda
  const handleSeleccionarPartida = (codigo, titulo, notas) => {
    setPartidaSeleccionada({ codigo, titulo, notas: notas || '' });
  };

  // Confirma la partida sugerida por la IA
  const handleConfirmarPartidaIA = () => {
    const just = justificacionHumana.trim() || `Confirmación humana de la partida ${partidaIASugerida} propuesta por IA.`;
    onAplicarPartida(item.id, partidaIASugerida, {
      origen: 'ia_confirmada',
      justificacion: just,
      regla_aplicada: resultadoIA?.regla_aplicada || 'RGI 1 y RGI 6',
      suficiencia_legal: resultadoIA?.suficiencia_legal || 'SUFICIENTE',
    });
  };

  // Aplica una corrección manual con la partida seleccionada por el usuario
  const handleCorregirPartida = () => {
    if (!partidaSeleccionada) return;
    const just = justificacionHumana.trim() || `Corrección manual por el agente: seleccionó la partida ${partidaSeleccionada.codigo} - ${partidaSeleccionada.titulo}`;
    onAplicarCorreccion(item.id, partidaSeleccionada.codigo, {
      origen: 'humano',
      justificacion: just,
      regla_aplicada: 'RGI 1 (Análisis Humano)',
      suficiencia_legal: 'SUFICIENTE',
    });
  };

  const arbol = useMemo(() => obtenerArbolCompleto(), []);

  // Expande/colapsa una sección del árbol arancelario
  const toggleSeccion = (id) => {
    setSeccionExpanded(prev => prev === id ? null : id);
    setCapituloExpanded(null);
  };

  // Expande/colapsa un capítulo dentro de una sección
  const toggleCapitulo = (codigo) => {
    setCapituloExpanded(prev => prev === codigo ? null : codigo);
  };

  return (
    <div style={{
      marginTop: '16px',
      borderRadius: '12px',
      border: '1px solid rgba(124, 58, 237, 0.2)',
      overflow: 'hidden',
      animation: 'fadeIn 0.3s ease-out',
    }}>
      <div style={{
        padding: '14px 16px',
        backgroundColor: 'rgba(124, 58, 237, 0.06)',
        borderBottom: '1px solid rgba(124, 58, 237, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'pointer',
      }}
        onClick={() => setModoAuditor(!modoAuditor)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            padding: '6px', borderRadius: '8px',
            backgroundColor: 'rgba(124, 58, 237, 0.1)',
            display: 'flex',
          }}>
            <Scale size={18} color="#a78bfa" />
          </div>
          <div>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
              Auditor de Partidas Arancelarias
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>
              Human-in-the-Loop — Capítulo {codigoCapituloIA || '—'} • Partida {codigoPartidaIA || '—'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {clasificando && <Loader2 size={14} className="spin" color="#a78bfa" />}
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            {modoAuditor ? '▲ Contraer' : '▼ Expandir'}
          </span>
        </div>
      </div>

      {modoAuditor && (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Propuesta IA */}
          {resultadoIA && (
            <div style={{
              padding: '14px',
              borderRadius: '10px',
              border: `1px solid ${resultadoIA.suficiencia_legal === 'SUFICIENTE' ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
              backgroundColor: resultadoIA.suficiencia_legal === 'SUFICIENTE' ? 'rgba(34,197,94,0.03)' : 'rgba(245,158,11,0.03)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={14} color="#a78bfa" />
                  <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    PROPUESTA DE CLASIFICACIÓN IA
                  </span>
                </div>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
                  backgroundColor: SUFICIENCIA_MAP[resultadoIA.suficiencia_legal]?.bg || 'rgba(245,158,11,0.1)',
                  color: SUFICIENCIA_MAP[resultadoIA.suficiencia_legal]?.color || 'var(--yellow)',
                }}>
                  {SUFICIENCIA_MAP[resultadoIA.suficiencia_legal]?.label || resultadoIA.suficiencia_legal}
                </span>
              </div>

              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#a78bfa', letterSpacing: '0.5px' }}>
                {resultadoIA.partida_sugerida}
              </div>

              {capituloIA && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Cap. {capituloIA.codigo}: {capituloIA.titulo}
                </div>
              )}

              <div style={{
                fontSize: '0.8rem', fontWeight: 600, fontStyle: 'italic',
                color: 'var(--text-main)', marginTop: '8px', lineHeight: 1.4,
                borderLeft: '2px solid #7c3aed', paddingLeft: '10px',
              }}>
                {resultadoIA.descripcion_tarifa}
              </div>

              <div style={{
                marginTop: '8px', padding: '10px', borderRadius: '8px',
                backgroundColor: 'rgba(0,0,0,0.02)', border: '1px solid var(--card-border)',
                fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, marginBottom: '4px' }}>
                  <BookOpen size={12} /> Fundamento Legal ({resultadoIA.regla_aplicada})
                </div>
                {resultadoIA.justificacion}
              </div>
            </div>
          )}

          {/* Buscador del árbol arancelario */}
          <div>
            <div style={{
              display: 'flex', gap: '8px', alignItems: 'center',
              padding: '8px 12px', borderRadius: '8px',
              border: '1px solid var(--card-border)', backgroundColor: 'rgba(0,0,0,0.02)',
            }}>
              <Search size={14} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="Buscar capítulo o partida (ej: 8471, zapatos, computadora)..."
                value={busqueda}
                onChange={(e) => handleBuscar(e.target.value)}
                style={{
                  flex: 1, border: 'none', outline: 'none', fontSize: '0.8rem',
                  backgroundColor: 'transparent', color: 'var(--text-main)',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Resultados de búsqueda */}
            {busqueda.trim().length >= 2 && resultadosBusqueda.length > 0 && (
              <div style={{
                marginTop: '8px', maxHeight: '200px', overflowY: 'auto',
                borderRadius: '8px', border: '1px solid var(--card-border)',
              }}>
                {resultadosBusqueda.slice(0, 20).map((r, i) => (
                  <div
                    key={i}
                    onClick={() => handleSeleccionarPartida(
                      r.tipo === 'partida' ? r.codigo : r.codigo + '00',
                      r.titulo,
                      r.notas || ''
                    )}
                    style={{
                      padding: '8px 12px', cursor: 'pointer',
                      borderBottom: i < resultadosBusqueda.length - 1 ? '1px solid var(--card-border)' : 'none',
                      backgroundColor: partidaSeleccionada?.codigo === r.codigo ? 'rgba(124,58,237,0.08)' : 'transparent',
                      transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(124,58,237,0.04)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor =
                      partidaSeleccionada?.codigo === r.codigo ? 'rgba(124,58,237,0.08)' : 'transparent'
                    }
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 700,
                        color: r.tipo === 'partida' ? '#a78bfa' : 'var(--text-muted)',
                        backgroundColor: r.tipo === 'partida' ? 'rgba(124,58,237,0.1)' : 'rgba(0,0,0,0.03)',
                        padding: '2px 6px', borderRadius: '4px',
                      }}>
                        {r.tipo === 'partida' ? 'Part.' : 'Cap.'} {r.tipo === 'partida' ? r.codigo : r.codigo}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>{r.titulo}</span>
                      {r.tipo === 'partida' && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Secc. {r.seccion}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {busqueda.trim().length >= 2 && resultadosBusqueda.length === 0 && (
              <div style={{ padding: '12px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                No se encontraron resultados para "{busqueda}"
              </div>
            )}
          </div>

          {/* Árbol arancelario completo */}
          <div>
            <div
              onClick={() => setArbolExpandido(!arbolExpandido)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)',
                padding: '6px 0',
              }}
            >
              {arbolExpandido ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Globe size={14} />
              Explorar Sistema Armonizado (Estructura Completa)
            </div>

            {arbolExpandido && (
              <div style={{
                marginTop: '8px', maxHeight: '350px', overflowY: 'auto',
                borderRadius: '8px', border: '1px solid var(--card-border)',
                fontSize: '0.75rem',
              }}>
                {arbol.map((seccion) => (
                  <div key={seccion.id}>
                    <div
                      onClick={() => toggleSeccion(seccion.id)}
                      style={{
                        padding: '8px 12px', cursor: 'pointer',
                        backgroundColor: seccionExpanded === seccion.id ? 'rgba(124,58,237,0.06)' : 'rgba(0,0,0,0.01)',
                        borderBottom: '1px solid var(--card-border)',
                        display: 'flex', alignItems: 'center', gap: '6px',
                        fontWeight: 700, fontSize: '0.75rem',
                        color: 'var(--text-main)',
                        transition: 'background-color 0.15s',
                      }}
                    >
                      {seccionExpanded === seccion.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      <span style={{ color: '#a78bfa', fontWeight: 800 }}>Sección {seccion.id}</span>
                      <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{seccion.titulo}</span>
                    </div>

                    {seccionExpanded === seccion.id && seccion.capitulos.map((cap) => (
                      <div key={cap.codigo}>
                        <div
                          onClick={() => toggleCapitulo(cap.codigo)}
                          style={{
                            padding: '6px 12px 6px 28px', cursor: 'pointer',
                            backgroundColor: capituloExpanded === cap.codigo ? 'rgba(124,58,237,0.04)' : 'transparent',
                            borderBottom: '1px solid var(--card-border)',
                            display: 'flex', alignItems: 'center', gap: '6px',
                            fontSize: '0.7rem', color: 'var(--text-muted)',
                            transition: 'background-color 0.15s',
                          }}
                        >
                          {cap.partidas?.length > 0 && (capituloExpanded === cap.codigo ? <ChevronDown size={10} /> : <ChevronRight size={10} />)}
                          <span style={{
                            fontWeight: 700, color: 'var(--text-main)',
                            backgroundColor: codigoCapituloIA === cap.codigo ? 'rgba(124,58,237,0.15)' : 'transparent',
                            padding: codigoCapituloIA === cap.codigo ? '1px 6px' : '1px 0',
                            borderRadius: '4px',
                          }}>
                            Cap. {cap.codigo}
                          </span>
                          {cap.titulo}
                          {cap.notas && (
                            <span title={cap.notas} style={{ marginLeft: 'auto', cursor: 'help' }}>
                              <Info size={10} color="var(--text-muted)" />
                            </span>
                          )}
                        </div>

                        {capituloExpanded === cap.codigo && cap.partidas?.map((partida) => (
                          <div
                            key={partida.codigo}
                            onClick={() => {
                              handleSeleccionarPartida(partida.codigo, partida.titulo, cap.notas || '');
                              setPartidaSeleccionada({ codigo: partida.codigo, titulo: partida.titulo, notas: cap.notas || '' });
                            }}
                            style={{
                              padding: '5px 12px 5px 40px', cursor: 'pointer',
                              backgroundColor: partidaSeleccionada?.codigo === partida.codigo ? 'rgba(124,58,237,0.1)' : 'transparent',
                              borderBottom: '1px solid var(--card-border)',
                              display: 'flex', alignItems: 'center', gap: '6px',
                              fontSize: '0.7rem', color: 'var(--text-muted)',
                              transition: 'background-color 0.15s',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(124,58,237,0.04)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor =
                              partidaSeleccionada?.codigo === partida.codigo ? 'rgba(124,58,237,0.1)' : 'transparent'
                            }
                          >
                            <Hash size={10} color="#a78bfa" />
                            <span style={{
                              fontWeight: 700, color: 'var(--text-main)',
                              backgroundColor: codigoPartidaIA === partida.codigo ? 'rgba(124,58,237,0.1)' : 'transparent',
                              padding: codigoPartidaIA === partida.codigo ? '1px 4px' : '1px 0',
                              borderRadius: '3px',
                            }}>
                              {partida.codigo}
                            </span>
                            {partida.titulo}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notas explicativas del capítulo */}
          {partidaSeleccionada?.notas && (
            <div style={{
              padding: '10px 14px', borderRadius: '8px',
              backgroundColor: 'rgba(59,130,246,0.04)',
              border: '1px solid rgba(59,130,246,0.15)',
              fontSize: '0.75rem', color: 'var(--text-muted)',
              display: 'flex', gap: '8px', alignItems: 'flex-start',
            }}>
              <Info size={14} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: 'var(--text-main)' }}>Nota Explicativa del Capítulo:</strong>
                <p style={{ margin: '4px 0 0 0', lineHeight: 1.5 }}>{partidaSeleccionada.notas}</p>
              </div>
            </div>
          )}

          {/* Partida seleccionada por el humano */}
          {partidaSeleccionada && (
            <div style={{
              padding: '12px', borderRadius: '8px',
              border: '2px solid #7c3aed', backgroundColor: 'rgba(124,58,237,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Check size={16} color="#a78bfa" />
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    PARTIDA SELECCIONADA
                  </span>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#a78bfa' }}>
                    {partidaSeleccionada.codigo}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>
                    {partidaSeleccionada.titulo}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setPartidaSeleccionada(null)}
                style={{
                  background: 'none', border: 'none', color: 'var(--red)',
                  cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600,
                }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Notas Explicativas del Capítulo */}
          {capituloActivo && (
            <div style={{
              borderRadius: '8px', border: '1px solid rgba(124,58,237,0.2)',
              backgroundColor: 'rgba(124,58,237,0.04)', overflow: 'hidden',
            }}>
              <div
                onClick={() => setNotasExpandidas(!notasExpandidas)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '10px 12px', cursor: 'pointer',
                  fontSize: '0.8rem', fontWeight: 600, color: '#a78bfa',
                  userSelect: 'none',
                }}
              >
                {notasExpandidas ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <BookOpen size={14} />
                Notas Explicativas — Capítulo {capituloActivo.codigo}
              </div>
              {notasExpandidas && (
                <div style={{ padding: '0 12px 10px 12px', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  <div style={{ marginBottom: '6px' }}>
                    <strong>Capítulo {capituloActivo.codigo}:</strong> {capituloActivo.titulo}
                  </div>
                  {capituloActivo.notas ? (
                    <div style={{
                      padding: '8px 10px', borderRadius: '6px',
                      backgroundColor: 'rgba(124,58,237,0.06)',
                      borderLeft: '3px solid #a78bfa',
                    }}>
                      {capituloActivo.notas}
                    </div>
                  ) : (
                    <div style={{ fontStyle: 'italic', opacity: 0.6 }}>
                      No hay notas explicativas registradas para este capítulo.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Justificación legal humana */}
          <div>
            <label style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)',
              marginBottom: '6px',
            }}>
              <FileText size={14} />
              Justificación Legal (Base documental de la clasificación)
            </label>
            <textarea
              value={justificacionHumana}
              onChange={(e) => setJustificacionHumana(e.target.value)}
              placeholder={resultadoIA
                ? "Confirme la propuesta IA o ingrese el fundamento legal de su corrección manual (ej: RGI 3(b) por tratarse de producto compuesto)..."
                : "Ingrese el fundamento legal de la clasificación (RGI, Notas de Capítulo, Notas Legales)..."
              }
              rows={3}
              style={{
                width: '100%', padding: '10px', borderRadius: '8px',
                border: '1px solid var(--card-border)', fontSize: '0.8rem',
                fontFamily: 'inherit', outline: 'none', resize: 'vertical',
                backgroundColor: 'rgba(0,0,0,0.015)', color: 'var(--text-main)',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
              onBlur={(e) => e.target.style.borderColor = 'var(--card-border)'}
            />
          </div>

          {/* Botones de acción */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {resultadoIA && (
              <button
                onClick={handleConfirmarPartidaIA}
                className="btn"
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  padding: '10px', borderRadius: '8px', fontWeight: 700, fontSize: '0.8rem',
                  backgroundColor: 'rgba(34,197,94,0.1)', color: 'var(--green)',
                  border: '1px solid rgba(34,197,94,0.3)', cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(34,197,94,0.2)'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(34,197,94,0.1)'}
              >
                <Check size={16} /> Confirmar Partida IA
              </button>
            )}

            <button
              onClick={handleCorregirPartida}
              disabled={!partidaSeleccionada}
              className="btn"
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                padding: '10px', borderRadius: '8px', fontWeight: 700, fontSize: '0.8rem',
                backgroundColor: partidaSeleccionada ? 'rgba(124,58,237,0.1)' : 'rgba(0,0,0,0.02)',
                color: partidaSeleccionada ? '#a78bfa' : 'var(--text-muted)',
                border: `1px solid ${partidaSeleccionada ? 'rgba(124,58,237,0.3)' : 'var(--card-border)'}`,
                cursor: partidaSeleccionada ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                if (partidaSeleccionada) {
                  e.currentTarget.style.backgroundColor = 'rgba(124,58,237,0.2)';
                }
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = partidaSeleccionada ? 'rgba(124,58,237,0.1)' : 'rgba(0,0,0,0.02)';
              }}
            >
              <Scale size={16} /> Aplicar Corrección Manual
            </button>
          </div>

          {/* Botón para solicitar clasificación IA si no se ha hecho */}
          {!resultadoIA && !clasificando && (
            <button
              onClick={() => onSolicitarClasificacion(item.id, item.descripcion)}
              className="btn"
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '10px', borderRadius: '8px', fontWeight: 600, fontSize: '0.85rem',
                backgroundColor: 'rgba(124,58,237,0.08)', color: '#a78bfa',
                border: '1px solid rgba(124,58,237,0.2)', cursor: 'pointer',
              }}
            >
              <Sparkles size={16} /> Solicitar Clasificación IA
            </button>
          )}

          {clasificando && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px' }}>
              <Loader2 size={18} className="spin" color="#a78bfa" />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Analizando con IA aduanera...
              </span>
            </div>
          )}

          {errorIA && (
            <div style={{
              padding: '10px', borderRadius: '8px',
              backgroundColor: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)',
              display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--red)',
            }}>
              <AlertTriangle size={16} /> {errorIA}
            </div>
          )}

          {/* RRNA Alert */}
          {resultadoIA?.rrna_requerida && (
            <div style={{
              padding: '10px 14px', borderRadius: '8px',
              backgroundColor: 'rgba(239,68,68,0.06)', border: '1px dashed var(--red)',
              display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem',
              color: 'var(--red)', fontWeight: 600,
            }}>
              <ShieldAlert size={16} />
              {resultadoIA.rrna_detalles || 'Esta clasificación requiere RRNA. Adjunte el permiso regulatorio correspondiente.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import React, { useState, useMemo, useEffect } from 'react';
import {
  Sparkles, Scale, Check, X, Search, ChevronDown, ChevronRight,
  BookOpen, AlertTriangle, ShieldAlert, Loader2, FileText,
  Globe, Info, Hash
} from 'lucide-react';
import { obtenerCatalogoArancelario } from '../servicios/api';
import styles from '../../css/AsistenteClasificacionArancelaria.module.css';

const SUFICIENCIA_MAP = {
  SUFICIENTE: { label: 'Legalmente Suficiente', color: 'var(--green)', bg: 'rgba(34,197,94,0.1)' },
  INSUFICIENTE: { label: 'Requiere Regla Complementaria', color: 'var(--yellow)', bg: 'rgba(245,158,11,0.1)' },
};

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

  const [arbol, setArbol] = useState([]);
  const [cargandoArbol, setCargandoArbol] = useState(false);

  useEffect(() => {
    async function cargarCatalogo() {
      setCargandoArbol(true);
      try {
        const datos = await obtenerCatalogoArancelario();
        setArbol(datos.secciones || []);
      } catch (error) {
        console.error('Error cargando catalogo:', error);
      } finally {
        setCargandoArbol(false);
      }
    }
    if (modoAuditor && arbol.length === 0) {
      cargarCatalogo();
    }
  }, [modoAuditor, arbol.length]);

  const obtenerCapituloLocal = (codigo) => {
    for (const s of arbol) {
      const cap = s.capitulos.find(c => c.codigo === codigo);
      if (cap) return { seccion: s.id, ...cap };
    }
    return null;
  };

  const buscarEnArbolLocal = (consulta) => {
    const q = consulta.toLowerCase().trim();
    if (!q) return [];
    const resultados = [];
    for (const seccion of arbol) {
      for (const cap of seccion.capitulos) {
        if (cap.codigo.includes(q) || cap.titulo.toLowerCase().includes(q)) {
          resultados.push({ seccion: seccion.id, tipo: 'capitulo', ...cap });
        }
        const partidas = cap.partidas || [];
        for (const p of partidas) {
          if (p.codigo.includes(q) || p.titulo.toLowerCase().includes(q)) {
            resultados.push({ seccion: seccion.id, tipo: 'partida', capitulo: cap, ...p });
          }
        }
      }
    }
    return resultados;
  };

  const resultadoIA = clasificacionIA?.result;
  const partidaIASugerida = resultadoIA?.partida_sugerida || '';
  const codigoCapituloIA = partidaIASugerida?.substring(0, 2);
  const codigoPartidaIA = partidaIASugerida?.substring(0, 4);
  const capituloIA = codigoCapituloIA ? obtenerCapituloLocal(codigoCapituloIA) : null;

  const codigoActivo = partidaSeleccionada?.codigo || codigoPartidaIA;
  const capituloActivo = codigoActivo ? obtenerCapituloLocal(codigoActivo.substring(0, 2)) : null;

  const handleBuscar = (valor) => {
    setBusqueda(valor);
    if (valor.trim().length >= 2) {
      setResultadosBusqueda(buscarEnArbolLocal(valor));
    } else {
      setResultadosBusqueda([]);
    }
  };

  const handleSeleccionarPartida = (codigo, titulo, notas) => {
    setPartidaSeleccionada({ codigo, titulo, notas: notas || '' });
  };

  const handleConfirmarPartidaIA = () => {
    const just = justificacionHumana.trim() || `Confirmación humana de la partida ${partidaIASugerida} propuesta por IA.`;
    onAplicarPartida(item.id, partidaIASugerida, {
      origen: 'ia_confirmada',
      justificacion: just,
      regla_aplicada: resultadoIA?.regla_aplicada || 'RGI 1 y RGI 6',
      suficiencia_legal: resultadoIA?.suficiencia_legal || 'SUFICIENTE',
    });
  };

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

  const toggleSeccion = (id) => {
    setSeccionExpanded(prev => prev === id ? null : id);
    setCapituloExpanded(null);
  };

  const toggleCapitulo = (codigo) => {
    setCapituloExpanded(prev => prev === codigo ? null : codigo);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header} onClick={() => setModoAuditor(!modoAuditor)}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIconBox}>
            <Scale size={18} color="#a78bfa" />
          </div>
          <div>
            <span className={styles.headerTitle}>Auditor de Partidas Arancelarias</span>
            <span className={styles.headerSubtitle}>
              Human-in-the-Loop &mdash; Cap&iacute;tulo {codigoCapituloIA || '&mdash;'} &bull; Partida {codigoPartidaIA || '&mdash;'}
            </span>
          </div>
        </div>
        <div className={styles.headerRight}>
          {clasificando && <Loader2 size={14} className="spin" color="#a78bfa" />}
          <span className={styles.headerToggle}>
            {modoAuditor ? '▲ Contraer' : '▼ Expandir'}
          </span>
        </div>
      </div>

      {modoAuditor && cargandoArbol && (
        <div className={styles.loadingState}>
          <Loader2 size={32} className="spin" color="#a78bfa" />
          <span className={styles.loadingText}>
            Cargando cat&aacute;logo arancelario desde el servidor...
          </span>
        </div>
      )}

      {modoAuditor && !cargandoArbol && arbol.length > 0 && (
        <div className={styles.body}>

          {resultadoIA && (
            <div className={styles.proposalBox} style={{
              border: `1px solid ${resultadoIA.suficiencia_legal === 'SUFICIENTE' ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
              backgroundColor: resultadoIA.suficiencia_legal === 'SUFICIENTE' ? 'rgba(34,197,94,0.03)' : 'rgba(245,158,11,0.03)',
            }}>
              <div className={styles.proposalHeader}>
                <div className={styles.proposalLabel}>
                  <Sparkles size={14} color="#a78bfa" />
                  <span className={styles.proposalLabelText}>PROPUESTA DE CLASIFICACI&Oacute;N IA</span>
                </div>
                <span className={styles.proposalBadge} style={{
                  backgroundColor: SUFICIENCIA_MAP[resultadoIA.suficiencia_legal]?.bg || 'rgba(245,158,11,0.1)',
                  color: SUFICIENCIA_MAP[resultadoIA.suficiencia_legal]?.color || 'var(--yellow)',
                }}>
                  {SUFICIENCIA_MAP[resultadoIA.suficiencia_legal]?.label || resultadoIA.suficiencia_legal}
                </span>
              </div>

              <div className={styles.proposalCode}>
                {resultadoIA.partida_sugerida}
              </div>

              {capituloIA && (
                <div className={styles.proposalCapitulo}>
                  Cap. {capituloIA.codigo}: {capituloIA.titulo}
                </div>
              )}

              <div className={styles.proposalDesc}>
                {resultadoIA.descripcion_tarifa}
              </div>

              <div className={styles.proposalLegal}>
                <div className={styles.proposalLegalHeader}>
                  <BookOpen size={12} /> Fundamento Legal ({resultadoIA.regla_aplicada})
                </div>
                {resultadoIA.justificacion}
              </div>
            </div>
          )}

          <div>
            <div className={styles.searchBar}>
              <Search size={14} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="Buscar cap&iacute;tulo o partida (ej: 8471, zapatos, computadora)..."
                value={busqueda}
                onChange={(e) => handleBuscar(e.target.value)}
                className={styles.searchInput}
              />
            </div>

            {busqueda.trim().length >= 2 && resultadosBusqueda.length > 0 && (
              <div className={styles.searchResults}>
                {resultadosBusqueda.slice(0, 20).map((r, i) => (
                  <div
                    key={i}
                    onClick={() => handleSeleccionarPartida(
                      r.tipo === 'partida' ? r.codigo : r.codigo + '00',
                      r.titulo,
                      r.notas || ''
                    )}
                    className={styles.searchResultItem}
                    style={{
                      borderBottom: i < resultadosBusqueda.length - 1 ? '1px solid var(--card-border)' : 'none',
                      backgroundColor: partidaSeleccionada?.codigo === r.codigo ? 'rgba(124,58,237,0.08)' : 'transparent',
                    }}
                  >
                    <span className={styles.searchResultBadge} style={{
                      color: r.tipo === 'partida' ? '#a78bfa' : 'var(--text-muted)',
                      backgroundColor: r.tipo === 'partida' ? 'rgba(124,58,237,0.1)' : 'rgba(0,0,0,0.03)',
                    }}>
                      {r.tipo === 'partida' ? 'Part.' : 'Cap.'} {r.tipo === 'partida' ? r.codigo : r.codigo}
                    </span>
                    <span className={styles.searchResultTitle}>{r.titulo}</span>
                    {r.tipo === 'partida' && <span className={styles.searchResultSeccion}>Secc. {r.seccion}</span>}
                  </div>
                ))}
              </div>
            )}

            {busqueda.trim().length >= 2 && resultadosBusqueda.length === 0 && (
              <div className={styles.searchEmpty}>
                No se encontraron resultados para &ldquo;{busqueda}&rdquo;
              </div>
            )}
          </div>

          <div>
            <div className={styles.treeToggle} onClick={() => setArbolExpandido(!arbolExpandido)}>
              {arbolExpandido ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Globe size={14} />
              Explorar Sistema Armonizado (Estructura Completa)
            </div>

            {arbolExpandido && (
              <div className={styles.treePanel}>
                {arbol.map((seccion) => (
                  <div key={seccion.id}>
                    <div className={styles.seccionNode}
                      onClick={() => toggleSeccion(seccion.id)}
                      style={{
                        backgroundColor: seccionExpanded === seccion.id ? 'rgba(124,58,237,0.06)' : 'rgba(0,0,0,0.01)',
                      }}
                    >
                      {seccionExpanded === seccion.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      <span className={styles.seccionLabel}>Secci&oacute;n {seccion.id}</span>
                      <span className={styles.seccionTitle}>{seccion.titulo}</span>
                    </div>

                    {seccionExpanded === seccion.id && seccion.capitulos.map((cap) => (
                      <div key={cap.codigo}>
                        <div className={styles.capituloNode}
                          onClick={() => toggleCapitulo(cap.codigo)}
                          style={{
                            backgroundColor: capituloExpanded === cap.codigo ? 'rgba(124,58,237,0.04)' : 'transparent',
                          }}
                        >
                          {cap.partidas?.length > 0 && (capituloExpanded === cap.codigo ? <ChevronDown size={10} /> : <ChevronRight size={10} />)}
                          <span className={styles.capituloCode} style={{
                            backgroundColor: codigoCapituloIA === cap.codigo ? 'rgba(124,58,237,0.15)' : 'transparent',
                            padding: codigoCapituloIA === cap.codigo ? '1px 6px' : '1px 0',
                            borderRadius: '4px',
                          }}>
                            Cap. {cap.codigo}
                          </span>
                          {cap.titulo}
                          {cap.notas && (
                            <span className={styles.capituloNotaIcon} title={cap.notas}>
                              <Info size={10} color="var(--text-muted)" />
                            </span>
                          )}
                        </div>

                        {capituloExpanded === cap.codigo && cap.partidas?.map((partida) => (
                          <div
                            key={partida.codigo}
                            className={styles.partidaNode}
                            onClick={() => {
                              handleSeleccionarPartida(partida.codigo, partida.titulo, cap.notas || '');
                              setPartidaSeleccionada({ codigo: partida.codigo, titulo: partida.titulo, notas: cap.notas || '' });
                            }}
                            style={{
                              backgroundColor: partidaSeleccionada?.codigo === partida.codigo ? 'rgba(124,58,237,0.1)' : 'transparent',
                            }}
                          >
                            <Hash size={10} color="#a78bfa" />
                            <span className={styles.partidaCode} style={{
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

          {partidaSeleccionada?.notas && (
            <div className={styles.notasBox}>
              <Info size={14} color="var(--primary)" className={styles.notasIcon} />
              <div>
                <strong className={styles.notasTitle}>Nota Explicativa del Cap&iacute;tulo:</strong>
                <p className={styles.notasBody}>{partidaSeleccionada.notas}</p>
              </div>
            </div>
          )}

          {partidaSeleccionada && (
            <div className={styles.selectedPartida}>
              <div className={styles.selectedPartidaLeft}>
                <Check size={16} color="#a78bfa" />
                <div className={styles.selectedPartidaInfo}>
                  <span className={styles.selectedPartidaLabel}>PARTIDA SELECCIONADA</span>
                  <div className={styles.selectedPartidaCode}>{partidaSeleccionada.codigo}</div>
                  <div className={styles.selectedPartidaTitle}>{partidaSeleccionada.titulo}</div>
                </div>
              </div>
              <button onClick={() => setPartidaSeleccionada(null)} className={styles.selectedPartidaClear}>
                <X size={14} />
              </button>
            </div>
          )}

          {capituloActivo && (
            <div className={styles.notasExplicativas}>
              <div className={styles.notasExplicativasHeader}
                onClick={() => setNotasExpandidas(!notasExpandidas)}>
                {notasExpandidas ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <BookOpen size={14} />
                Notas Explicativas &mdash; Cap&iacute;tulo {capituloActivo.codigo}
              </div>
              {notasExpandidas && (
                <div className={styles.notasExplicativasBody}>
                  <div className={styles.notasExplicativasTitle}>
                    <strong>Cap&iacute;tulo {capituloActivo.codigo}:</strong> {capituloActivo.titulo}
                  </div>
                  {capituloActivo.notas ? (
                    <div className={styles.notasExplicativasContent}>
                      {capituloActivo.notas}
                    </div>
                  ) : (
                    <div className={styles.notasExplicativasEmpty}>
                      No hay notas explicativas registradas para este cap&iacute;tulo.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <label className={styles.justificacionLabel}>
              <FileText size={14} />
              Justificaci&oacute;n Legal (Base documental de la clasificaci&oacute;n)
            </label>
            <textarea
              value={justificacionHumana}
              onChange={(e) => setJustificacionHumana(e.target.value)}
              placeholder={resultadoIA
                ? "Confirme la propuesta IA o ingrese el fundamento legal de su corrección manual (ej: RGI 3(b) por tratarse de producto compuesto)..."
                : "Ingrese el fundamento legal de la clasificación (RGI, Notas de Capítulo, Notas Legales)..."
              }
              rows={3}
              className={styles.justificacionTextarea}
            />
          </div>

          <div className={styles.actionRow}>
            {resultadoIA && (
              <button
                onClick={handleConfirmarPartidaIA}
                className={`btn ${styles.confirmBtn}`}
                style={{
                  backgroundColor: 'rgba(34,197,94,0.1)', color: 'var(--green)',
                  border: '1px solid rgba(34,197,94,0.3)',
                }}
              >
                <Check size={16} /> Confirmar Partida IA
              </button>
            )}

            <button
              onClick={handleCorregirPartida}
              disabled={!partidaSeleccionada}
              className={`btn ${styles.correctBtn}`}
              style={{
                backgroundColor: partidaSeleccionada ? 'rgba(124,58,237,0.1)' : 'rgba(0,0,0,0.02)',
                color: partidaSeleccionada ? '#a78bfa' : 'var(--text-muted)',
                border: `1px solid ${partidaSeleccionada ? 'rgba(124,58,237,0.3)' : 'var(--card-border)'}`,
                cursor: partidaSeleccionada ? 'pointer' : 'not-allowed',
              }}
            >
              <Scale size={16} /> Aplicar Correcci&oacute;n Manual
            </button>
          </div>

          {!resultadoIA && !clasificando && (
            <button
              onClick={() => onSolicitarClasificacion(item.id, item.descripcion)}
              className={`btn ${styles.solicitarBtn}`}
              style={{
                backgroundColor: 'rgba(124,58,237,0.08)', color: '#a78bfa',
                border: '1px solid rgba(124,58,237,0.2)',
              }}
            >
              <Sparkles size={16} /> Solicitar Clasificaci&oacute;n IA
            </button>
          )}

          {clasificando && (
            <div className={styles.loadingIndicator}>
              <Loader2 size={18} className="spin" color="#a78bfa" />
              <span className={styles.loadingIndicatorText}>Analizando con IA aduanera...</span>
            </div>
          )}

          {errorIA && (
            <div className={styles.errorBox}>
              <AlertTriangle size={16} /> {errorIA}
            </div>
          )}

          {resultadoIA?.rrna_requerida && (
            <div className={styles.rrnaBox}>
              <ShieldAlert size={16} />
              {resultadoIA.rrna_detalles || 'Esta clasificación requiere RRNA. Adjunte el permiso regulatorio correspondiente.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
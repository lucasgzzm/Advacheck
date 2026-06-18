import React, { useState, useRef, useEffect } from 'react';
import { X, Scan, ZoomIn, ZoomOut, Loader2, AlertCircle } from 'lucide-react';

export default function PdfTextSelector({ pdfUrl, onClose, onTextSelected, fieldLabel }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState(null);
  const [textItems, setTextItems] = useState([]);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    
    async function loadPdf() {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdfDoc = await loadingTask.promise;
        if (cancelled) return;

        setPdf(pdfjsLib);
        setTotalPages(pdfDoc.numPages);
        setPdf(prev => ({ ...prev, doc: pdfDoc }));
        setLoading(false);
        renderPage(pdfDoc, 1, 1.5, pdfjsLib);
      } catch (err) {
        if (!cancelled) {
          setError('No se pudo cargar el PDF para extracción visual.');
          setLoading(false);
        }
      }
    }
    if (pdfUrl) loadPdf();
    return () => { cancelled = true; };
  }, [pdfUrl]);

  async function renderPage(doc, pageNumber, scaleVal, lib) {
    if (!doc) return;
    try {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: scaleVal });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;

      const textContent = await page.getTextContent();
      setTextItems(textContent.items.map(item => ({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
        height: item.height,
        font: item.fontName,
      })));
    } catch (err) {
      console.error('Error rendering page:', err);
    }
  }

  const handleChangePage = async (delta) => {
    const newPage = pageNum + delta;
    if (newPage < 1 || newPage > totalPages) return;
    setPageNum(newPage);
    setSelectedText('');
    setSelectionBox(null);
    if (pdf?.doc) {
      await renderPage(pdf.doc, newPage, scale, pdf);
    }
  };

  const handleZoom = async (delta) => {
    const newScale = Math.max(0.5, Math.min(3, scale + delta));
    setScale(newScale);
    if (pdf?.doc) {
      await renderPage(pdf.doc, pageNum, newScale, pdf);
    }
  };

  const handleMouseDown = (e) => {
    if (!selectionMode) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setIsSelecting(true);
    setSelectionBox({ x1: x, y1: y, x2: x, y2: y });
  };

  const handleMouseMove = (e) => {
    if (!isSelecting || !selectionMode) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setSelectionBox(prev => ({ ...prev, x2: x, y2: y }));
  };

  const handleMouseUp = () => {
    if (!isSelecting || !selectionMode) return;
    setIsSelecting(false);

    if (selectionBox) {
      const minX = Math.min(selectionBox.x1, selectionBox.x2);
      const maxX = Math.max(selectionBox.x1, selectionBox.x2);
      const minY = Math.min(selectionBox.y1, selectionBox.y2);
      const maxY = Math.max(selectionBox.y1, selectionBox.y2);

      const canvas = canvasRef.current;
      const canvasRect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / canvasRect.width;
      const scaleY = canvas.height / canvasRect.height;

      const canvasMinX = minX * scaleX;
      const canvasMaxX = maxX * scaleX;
      const canvasMinY = minY * scaleY;
      const canvasMaxY = maxY * scaleY;

      const foundTexts = textItems.filter(item => {
        const itemX = item.x;
        const itemY = item.y;
        const itemX2 = item.x + item.width;
        const itemY2 = item.y + item.height;
        return (
          itemX >= canvasMinX - 5 && itemX2 <= canvasMaxX + 5 &&
          itemY >= canvasMinY - 5 && itemY2 <= canvasMaxY + 5
        );
      }).map(item => item.str).join(' ');

      setSelectedText(foundTexts || 'No se detectó texto en esta región.');
    }
  };

  const handleConfirmSelection = () => {
    if (selectedText && selectedText !== 'No se detectó texto en esta región.') {
      onTextSelected(selectedText.trim());
      onClose();
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        width: '90vw', height: '90vh', maxWidth: '1200px',
        backgroundColor: 'var(--bg-color)', borderRadius: '16px',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
      }}>
        
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', borderBottom: '1px solid var(--card-border)',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Scan size={18} color="var(--primary)" />
              Corrección Asistida de OCR
            </h3>
            {fieldLabel && (
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Extrayendo dato para: <strong>{fieldLabel}</strong>
              </p>
            )}
          </div>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '8px', borderRadius: '8px' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '10px 20px', borderBottom: '1px solid var(--card-border)',
          backgroundColor: 'rgba(0,0,0,0.02)',
        }}>
          <button
            onClick={() => handleChangePage(-1)}
            disabled={pageNum <= 1}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.8rem', opacity: pageNum <= 1 ? 0.4 : 1 }}
          >
            ← Anterior
          </button>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            Pág. {pageNum} / {totalPages}
          </span>
          <button
            onClick={() => handleChangePage(1)}
            disabled={pageNum >= totalPages}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.8rem', opacity: pageNum >= totalPages ? 0.4 : 1 }}
          >
            Siguiente →
          </button>

          <div style={{ flex: 1 }} />

          <button onClick={() => handleZoom(-0.25)} className="btn btn-secondary" style={{ padding: '6px', borderRadius: '6px' }}>
            <ZoomOut size={14} />
          </button>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            {Math.round(scale * 100)}%
          </span>
          <button onClick={() => handleZoom(0.25)} className="btn btn-secondary" style={{ padding: '6px', borderRadius: '6px' }}>
            <ZoomIn size={14} />
          </button>

          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--card-border)' }} />

          <button
            onClick={() => {
              setSelectionMode(!selectionMode);
              setSelectedText('');
              setSelectionBox(null);
            }}
            className="btn"
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px', fontSize: '0.8rem', fontWeight: 600,
              backgroundColor: selectionMode ? 'rgba(124,58,237,0.15)' : 'transparent',
              color: selectionMode ? '#a78bfa' : 'var(--text-muted)',
              border: selectionMode ? '2px solid #a78bfa' : '1px solid var(--card-border)',
              borderRadius: '8px', cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Scan size={14} />
            {selectionMode ? 'Seleccionando...' : 'Seleccionar Texto'}
          </button>
        </div>

        <div
          ref={containerRef}
          style={{
            flex: 1, overflow: 'auto', display: 'flex',
            justifyContent: 'center', alignItems: 'flex-start',
            padding: '20px', backgroundColor: '#525659',
            cursor: selectionMode ? 'crosshair' : 'default',
            position: 'relative',
          }}
        >
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '60px' }}>
              <Loader2 size={32} className="spin" color="white" />
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>Cargando PDF para extracción...</span>
            </div>
          )}

          {error && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '60px', color: 'rgba(255,255,255,0.7)' }}>
              <AlertCircle size={32} color="var(--red)" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && (
            <div style={{ position: 'relative', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', borderRadius: '4px', overflow: 'hidden' }}>
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => {
                  if (isSelecting) handleMouseUp();
                }}
                style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
              />

              {selectionBox && selectionMode && (
                <div style={{
                  position: 'absolute',
                  left: Math.min(selectionBox.x1, selectionBox.x2),
                  top: Math.min(selectionBox.y1, selectionBox.y2),
                  width: Math.abs(selectionBox.x2 - selectionBox.x1),
                  height: Math.abs(selectionBox.y2 - selectionBox.y1),
                  border: '2px solid #a78bfa',
                  backgroundColor: 'rgba(124,58,237,0.15)',
                  pointerEvents: 'none',
                  borderRadius: '2px',
                }} />
              )}
            </div>
          )}
        </div>

        {selectedText && (
          <div style={{
            padding: '14px 20px', borderTop: '2px solid #a78bfa',
            backgroundColor: 'rgba(124,58,237,0.04)',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <Scan size={16} color="#a78bfa" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '2px' }}>
                TEXTO EXTRAÍDO
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>
                {selectedText}
              </div>
            </div>
            <button
              onClick={handleConfirmSelection}
              className="btn btn-primary"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 20px', fontSize: '0.85rem', fontWeight: 700,
                borderRadius: '8px',
              }}
              disabled={selectedText === 'No se detectó texto en esta región.'}
            >
              Aplicar al Campo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

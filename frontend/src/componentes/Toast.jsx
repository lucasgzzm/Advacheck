// Notificacion tipo toast con auto-descarte
import React, { useEffect } from 'react';
import styles from '../../css/Toast.module.css';

const TYPE_COLORS = {
  success: { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.4)', text: '#34d399', icon: '✓' },
  error: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)', text: '#f87171', icon: '✕' },
  info: { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)', text: '#60a5fa', icon: 'ℹ' },
};

export default function Toast({ mensaje, tipo = 'info', duracion = 3500, onCerrar }) {
  const colors = TYPE_COLORS[tipo] || TYPE_COLORS.info;

  useEffect(() => {
    if (!mensaje) return;
    const timer = setTimeout(onCerrar, duracion);
    return () => clearTimeout(timer);
  }, [mensaje, duracion, onCerrar]);

  if (!mensaje) return null;

  return (
    <div className={styles.contenedor} style={{ border: `1px solid ${colors.border}` }}>
      <span className={styles.iconCircle} style={{ background: colors.bg, color: colors.text }}>
        {colors.icon}
      </span>
      <span className={styles.mensaje}>
        {mensaje}
      </span>
      <button onClick={onCerrar} className={styles.btnCerrar}>✕</button>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { LayoutDashboard, AlertCircle, CheckCircle, TrendingUp, Users, RefreshCw, Layers } from 'lucide-react';

const AdminDashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const response = await fetch('http://127.0.0.1:8000/api/admin/metrics', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setMetrics(data);
        }
      } catch (error) {
        console.error("Error al cargar métricas admin:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <RefreshCw className="lucide-spin" size={40} color="var(--primary)" style={{ animation: 'spin 1.5s linear infinite' }} />
      </div>
    );
  }

  const KPICard = ({ title, value, icon: Icon, color, subtitle }) => (
    <div className="glass-panel" style={{ padding: '24px', flex: 1, minWidth: '240px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div style={{ backgroundColor: `${color}15`, padding: '10px', borderRadius: '12px' }}>
          <Icon size={24} color={color} />
        </div>
      </div>
      <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500, margin: '0 0 8px 0' }}>{title}</h3>
      <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-1px' }}>{value}</div>
      {subtitle && <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{subtitle}</p>}
    </div>
  );

  return (
    <div className="fade-in">
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-1px', margin: 0 }}>Portal de Gerencia Aduanera</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px', fontSize: '1.05rem' }}>Supervisión estratégica y control de operaciones globales.</p>
      </header>

      {/* Fila de KPIs */}
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '32px' }}>
        <KPICard 
          title="Operaciones Totales" 
          value={metrics?.total_operaciones} 
          icon={Layers} 
          color="var(--primary)" 
          subtitle="Documentos procesados por el equipo"
        />
        <KPICard 
          title="Riesgo Crítico" 
          value={`${metrics?.riesgos.alto_porcentaje}%`} 
          icon={AlertCircle} 
          color="var(--red)" 
          subtitle="Tasa de alertas de alto riesgo"
        />
        <KPICard 
          title="Eficiencia IA" 
          value={`${metrics?.salud_ocr}%`} 
          icon={TrendingUp} 
          color="var(--green)" 
          subtitle="Precisión del motor de extracción"
        />
        <KPICard 
          title="Analistas en Turno" 
          value={metrics?.analistas_activos} 
          icon={Users} 
          color="#8b5cf6" 
          subtitle="Cuentas activas en la plataforma"
        />
      </div>

      {/* Segundo Nivel: Alertas y Estado */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={20} color="var(--red)" />
            Distribución de Alertas por IA
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '16px', backgroundColor: 'rgba(239, 68, 68, 0.05)', borderRadius: '12px', borderLeft: '4px solid var(--red)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Riesgo Alto</span>
                <span style={{ fontWeight: 700 }}>{metrics?.riesgos.alto}</span>
              </div>
              <div style={{ height: '8px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${metrics?.riesgos.alto_porcentaje}%`, backgroundColor: 'var(--red)' }}></div>
              </div>
            </div>
            
            <div style={{ padding: '16px', backgroundColor: 'rgba(245, 158, 11, 0.05)', borderRadius: '12px', borderLeft: '4px solid var(--yellow)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Riesgo Medio</span>
                <span style={{ fontWeight: 700 }}>{metrics?.riesgos.medio}</span>
              </div>
              <div style={{ height: '8px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${metrics?.riesgos.medio_porcentaje || 0}%`, backgroundColor: 'var(--yellow)' }}></div>
              </div>
            </div>

            <div style={{ padding: '16px', backgroundColor: 'rgba(16, 185, 129, 0.05)', borderRadius: '12px', borderLeft: '4px solid var(--green)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Riesgo Bajo</span>
                <span style={{ fontWeight: 700 }}>{metrics?.riesgos.bajo}</span>
              </div>
              <div style={{ height: '8px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${metrics?.riesgos.bajo_porcentaje || 0}%`, backgroundColor: 'var(--green)' }}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'rgba(34, 197, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
            <CheckCircle size={40} color="var(--green)" />
          </div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Sistema Saludable</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '300px', margin: '12px 0 24px 0' }}>
            El motor de Inteligencia Bimodal Avanzado (Gemini 2.5 + Azure) está operando de manera totalmente sincrónica.
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
             <button className="btn btn-secondary">Logs Técnicos</button>
             <button className="btn btn-primary">Ajustar Reglas</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

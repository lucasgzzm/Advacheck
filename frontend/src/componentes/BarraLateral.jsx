import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, User, Users, LogOut, History as HistoryIcon, Activity, Building2, Briefcase } from 'lucide-react';
import FloatingActionMenu from './interfaz/MenuAccionFlotante';
import NotificacionCampana from './NotificacionCampana';
import { useAuth } from '../contexto/ContextoAuth';

// Barra de navegación lateral con menú adaptado según rol (Admin/Agente)
function Sidebar() {
  const { user, logout } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isAdmin = user?.role === 'Administrador';

  const menuItems = isAdmin
    ? [
        { path: '/', name: 'Métricas', icon: LayoutDashboard },
        { path: '/maestro', name: 'Historial Maestro', icon: HistoryIcon },
        { path: '/auditoria', name: 'Auditoría', icon: Activity },
        { path: '/usuarios', name: 'Personal', icon: Users },
      ]
    : [
        { path: '/', name: 'Dashboard', icon: LayoutDashboard },
        { path: '/historial', name: 'Mis Facturas', icon: HistoryIcon },
        { path: '/clientes', name: 'Clientes', icon: Briefcase },
      ];

  return (
    <aside
      className="sidebar"
      style={{
        width: '260px',
        height: '100vh',
        backgroundColor: 'var(--card-bg)',
        borderRight: '1px solid var(--card-border)',
        position: 'fixed',
        left: 0,
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        padding: '24px 0',
      }}
    >
      <div style={{ padding: '0 16px', marginBottom: '40px', display: 'flex', justifyContent: 'center', position: 'relative' }}>
        <Link to="/" className="sidebar-logo-link" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none', gap: '6px' }}>
          <img src="/logo-completo.png" alt="WebCheck" style={{ height: '48px', width: 'auto' }} />
          <span
            style={{
              backgroundColor: isAdmin ? 'var(--primary-light)' : 'rgba(16, 185, 129, 0.1)',
              color: isAdmin ? 'var(--primary)' : 'var(--green)',
              fontSize: '0.6rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '4px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              border: `1px solid ${isAdmin ? 'rgba(59,130,246,0.2)' : 'rgba(16,185,129,0.2)'}`,
            }}
          >
            {isAdmin ? 'ADMIN' : 'AGENTE'}
          </span>
        </Link>
      </div>

      <nav style={{ flex: 1, padding: '0 12px' }}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '12px',
                textDecoration: 'none',
                marginBottom: '4px',
                transition: 'all 0.2s ease',
                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                backgroundColor: isActive ? 'var(--primary-light)' : 'transparent',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.92rem',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.03)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Icon size={20} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: '0 12px 8px 12px' }}>
        <NotificacionCampana fullWidth />
      </div>

      <div style={{ padding: '16px 16px 24px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <FloatingActionMenu
          className="relative"
          title={user?.name || 'Perfil'}
          options={[
            {
              label: 'Perfil',
              Icon: <User size={16} />,
              onClick: () => navigate('/perfil'),
            },
            {
              label: 'Cerrar Sesión',
              Icon: <LogOut size={16} />,
              onClick: () => setShowLogoutModal(true),
            },
          ]}
        />
      </div>

      {showLogoutModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--card-bg)',
              padding: '32px',
              borderRadius: '24px',
              width: '90%',
              maxWidth: '400px',
              textAlign: 'center',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--card-border)',
              animation: 'slideUp 0.3s ease',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}
            >
              <LogOut size={32} color="var(--red)" />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>¿Cerrar Sesión?</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '28px', fontSize: '0.95rem' }}>
              Estás a punto de salir de tu cuenta de WebCheck. Deberás volver a ingresar tus credenciales.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowLogoutModal(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1px solid var(--card-border)',
                  backgroundColor: 'white',
                  color: 'var(--text-main)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={logout}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: 'var(--red)',
                  color: 'white',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;

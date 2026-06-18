// Barra lateral de navegacion con menu segun rol
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, LogOut, History as HistoryIcon, Activity } from 'lucide-react';
import FloatingActionMenu from './interfaz/MenuAccionFlotante';
import { useAuth } from '../contexto/ContextoAuth';
import styles from '../../css/BarraLateral.module.css';

function Sidebar() {
  const { user, logout } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const location = useLocation();

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
      ];

  return (
    <aside className={`sidebar ${styles.aside}`}>
      <div className={styles.logoContainer}>
        <Link to="/" className={`sidebar-logo-link ${styles.logoLink}`}>
          <img src="/logo-completo.png" alt="WebCheck" className={styles.logoImg} />
          <span
            className={styles.badge}
            style={{
              backgroundColor: isAdmin ? 'var(--primary-light)' : 'rgba(16, 185, 129, 0.1)',
              color: isAdmin ? 'var(--primary)' : 'var(--green)',
              border: `1px solid ${isAdmin ? 'rgba(59,130,246,0.2)' : 'rgba(16,185,129,0.2)'}`,
            }}
          >
            {isAdmin ? 'ADMIN' : 'AGENTE'}
          </span>
        </Link>
      </div>

      <nav className={styles.nav}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`${styles.menuItem} ${isActive ? styles.menuItemActive : ''}`}
            >
              <Icon size={20} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className={styles.footer}>
        <FloatingActionMenu
          className="relative"
          title={user?.name || 'Usuario'}
          options={[
            {
              label: 'Cerrar Sesión',
              Icon: <LogOut size={16} />,
              onClick: () => setShowLogoutModal(true),
            },
          ]}
        />
      </div>

      {showLogoutModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalIconCircle}>
              <LogOut size={32} color="var(--red)" />
            </div>
            <h2 className={styles.modalTitle}>¿Cerrar Sesión?</h2>
            <p className={styles.modalDesc}>
              Estás a punto de salir de tu cuenta de WebCheck. Deberás volver a ingresar tus credenciales.
            </p>
            <div className={styles.modalButtons}>
              <button onClick={() => setShowLogoutModal(false)} className={styles.btnCancel}>
                Cancelar
              </button>
              <button onClick={logout} className={styles.btnLogout}>
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

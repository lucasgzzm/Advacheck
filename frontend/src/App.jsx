import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Truck, User, Users, LogOut, Menu, X, History as HistoryIcon } from 'lucide-react';
import PanelPrincipal from './pages/PanelPrincipal';
import Envios from './pages/Envios';
import DetalleFactura from './pages/DetalleFactura';
import InicioSesion from './pages/InicioSesion';
import Registro from './pages/Registro';
import Perfil from './pages/Perfil';
import Historial from './pages/Historial';
import PanelAdmin from './pages/PanelAdmin';
import HistorialGlobal from './pages/HistorialGlobal';
import GestionUsuarios from './pages/GestionUsuarios';
import { AuthProvider, useAuth } from './context/ContextoAuth';

const Navbar = () => {
  const { user, logout } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const location = useLocation();
  const navContainerRef = useRef(null);
  const sliderRef = useRef(null);

  useEffect(() => {
    const updateSlider = () => {
      if (navContainerRef.current && sliderRef.current) {
        const activeEl = navContainerRef.current.querySelector('.nav-link-active');
        if (activeEl) {
          sliderRef.current.style.width = `${activeEl.offsetWidth}px`;
          sliderRef.current.style.transform = `translateX(${activeEl.offsetLeft}px)`;
        }
      }
    };

    // Actualizar inmediatamente y tras un pequeño delay para asegurar renderizado
    updateSlider();
    const timeoutId = setTimeout(updateSlider, 50);

    // Escuchar cambios de resolución para que el slider no se pierda
    window.addEventListener('resize', updateSlider);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updateSlider);
    };
  }, [location.pathname]);

  const isAdmin = user?.role === 'Administrador';

  const menuItems = isAdmin ? [
    { path: '/', name: 'Métricas', icon: LayoutDashboard },
    { path: '/maestro', name: 'Historial Maestro', icon: HistoryIcon },
    { path: '/usuarios', name: 'Personal', icon: Users },
  ] : [
    { path: '/', name: 'Dashboard', icon: LayoutDashboard },
    { path: '/historial', name: 'Mis Facturas', icon: HistoryIcon },
    { path: '/envios', name: 'Envíos', icon: Truck },
  ];

  return (
    <header style={{ backgroundColor: 'var(--card-bg)', borderBottom: '1px solid var(--card-border)', transition: 'background-color 0.3s', position: 'sticky', top: 0, zIndex: 1000 }}>
      <nav className="navbar-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Botón Hamburguesa (Móvil) */}
          <div className="hamburger-btn" onClick={() => setIsMobileMenuOpen(true)}>
            <Menu size={24} />
          </div>

          {/* Brand Logo Completo */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', textDecoration: 'none', gap: '8px' }}>
            <img
              src="/logo-completo.png"
              alt="AdvaCheck"
              className="navbar-logo"
              style={{ height: '40px', width: 'auto', objectFit: 'contain' }}
            />
            {isAdmin && (
              <span style={{ 
                backgroundColor: 'var(--primary-light)', 
                color: 'var(--primary)', 
                fontSize: '0.6rem', 
                fontWeight: 800, 
                padding: '2px 6px', 
                borderRadius: '4px', 
                letterSpacing: '0.5px',
                border: '1px solid var(--primary)',
                marginLeft: '4px',
                flexShrink: 0
              }}>ADMIN</span>
            )}
          </Link>
        </div>

      {/* Navigation Links (Escritorio) */}
      <div className="nav-links-desktop" ref={navContainerRef}>
        <div 
          ref={sliderRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            backgroundColor: 'var(--primary-light)',
            borderRadius: '8px',
            transition: 'transform 0.4s cubic-bezier(0.4, 1.2, 0.5, 1), width 0.4s cubic-bezier(0.4, 1.2, 0.5, 1)',
            zIndex: 0
          }}
        />
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <Link key={item.path} to={item.path} className={isActive ? 'nav-link-active' : ''} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 16px', borderRadius: '8px',
              textDecoration: 'none',
              color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
              fontWeight: isActive ? 700 : 500,
              transition: 'color 0.2s',
              fontSize: '0.95rem',
              position: 'relative',
              zIndex: 1
            }}>
              <item.icon size={18} />
              <span className="hide-on-mobile">{item.name}</span>
            </Link>
          );
        })}
      </div>

      {/* Acciones de usuario */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div style={{ position: 'relative' }} ref={profileRef}>
          <div 
            style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '6px 12px', borderRadius: '8px', transition: 'background-color 0.2s' }}
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="dropdown-item"
          >
            <div style={{
              width: '36px', height: '36px',
              backgroundColor: 'var(--bg-color)',
              border: '1px solid var(--card-border)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <User size={18} color="var(--text-muted)" />
            </div>
            <span className="hide-on-mobile" style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>{user?.name || 'Usuario'}</span>
          </div>

          {/* Dropdown Perfil */}
          <div className={`dropdown-menu ${isProfileOpen ? 'active' : ''}`} style={{ width: '220px', top: '55px', right: 0 }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--card-border)', backgroundColor: 'var(--bg-color)' }}>
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>{user?.name || 'Usuario'}</p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{user?.role || 'Agente'}</p>
            </div>
            <div style={{ padding: '8px' }}>
              <Link to="/perfil" className="dropdown-item" onClick={() => setIsProfileOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', color: 'var(--text-main)', textDecoration: 'none', borderRadius: '6px', fontSize: '0.9rem', transition: 'background-color 0.2s' }}>
                <User size={16} color="var(--text-muted)" /> Ver Perfil
              </Link>
            </div>
            <div style={{ padding: '8px', borderTop: '1px solid var(--card-border)' }}>
              <div 
                className="dropdown-item"
                onClick={() => { setIsProfileOpen(false); logout(); }}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', color: 'var(--red)', textDecoration: 'none', borderRadius: '6px', fontSize: '0.9rem', cursor: 'pointer', transition: 'background-color 0.2s' }} 
              >
                <LogOut size={16} color="var(--red)" /> Cerrar sesión
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Menú Móvil Lateral */}
      <div className={`mobile-menu-overlay ${isMobileMenuOpen ? 'active' : ''}`} onClick={() => setIsMobileMenuOpen(false)} />
      <div className={`mobile-menu ${isMobileMenuOpen ? 'active' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <img src="/logo-completo.png" alt="Logo" style={{ height: '32px' }} />
          <div onClick={() => setIsMobileMenuOpen(false)} style={{ cursor: 'pointer', padding: '8px' }}>
            <X size={24} color="var(--text-main)" />
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px', paddingLeft: '16px' }}>Navegación</p>
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link 
                key={item.path} 
                to={item.path} 
                className={`mobile-menu-link ${isActive ? 'active' : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <item.icon size={20} />
                {item.name}
              </Link>
            );
          })}
          <Link 
            to="/perfil" 
            className={`mobile-menu-link ${location.pathname === '/perfil' ? 'active' : ''}`}
            onClick={() => setIsMobileMenuOpen(false)}
            style={{ marginTop: '8px' }}
          >
            <User size={20} />
            Mi Perfil
          </Link>
        </div>

        <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '24px' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '16px', marginBottom: '20px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={20} color="var(--primary)" />
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>{user?.name || 'Usuario'}</p>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{user?.role || 'Agente'}</p>
              </div>
           </div>
           <div 
             className="mobile-menu-link" 
             style={{ color: 'var(--red)', marginBottom: 0 }}
             onClick={() => { setIsMobileMenuOpen(false); logout(); }}
           >
             <LogOut size={20} /> Cerrar sesión
           </div>
        </div>
      </div>
    </nav>
  </header>
  );
};

const Layout = ({ children }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--bg-color)', transition: 'background-color 0.3s' }}>
      <Navbar />
      <main className="layout-container" style={{ flex: 1, padding: '24px 20px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        {children}
      </main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}

function AppContent() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<InicioSesion />} />
        <Route path="/registrar" element={<Registro />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const isAdmin = user?.role === 'Administrador';

  return (
    <Layout>
      <Routes>
        {/* Rutas compartidas */}
        <Route path="/perfil" element={<Perfil />} />

        {/* Rutas de Administrador */}
        {isAdmin ? (
          <>
            <Route path="/" element={<PanelAdmin />} />
            <Route path="/maestro" element={<HistorialGlobal />} />
            <Route path="/usuarios" element={<GestionUsuarios />} />
          </>
        ) : (
          /* Rutas de Agente */
          <>
            <Route path="/" element={<PanelPrincipal />} />
            <Route path="/historial" element={<Historial />} />
            <Route path="/envios" element={<Envios />} />
            <Route path="/factura/:id/editar" element={<DetalleFactura />} />
          </>
        )}
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;

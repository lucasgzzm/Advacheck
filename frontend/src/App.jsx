import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PanelPrincipal from './pages/PanelPrincipal';
import DetalleFactura from './pages/DetalleFactura';
import InicioSesion from './pages/InicioSesion';
import Perfil from './pages/Perfil';
import Configuracion from './pages/Configuracion';
import GestionClientes from './pages/GestionClientes';
import Historial from './pages/Historial';
import PanelAdmin from './pages/PanelAdmin';
import HistorialGlobal from './pages/HistorialGlobal';
import GestionUsuarios from './pages/GestionUsuarios';
import LogAuditoria from './pages/LogAuditoria';
import PerfilProveedores from './pages/PerfilProveedores';
import ValidacionCruzada from './pages/ValidacionCruzada';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './context/ContextoAuth';

// Componente que define las rutas según autenticación y rol del usuario
function RutasProtegidas() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<InicioSesion />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const esAdmin = user?.role === 'Administrador';

  return (
    <Layout>
      <Routes>
        <Route path="/perfil" element={<Perfil />} />
        <Route path="/factura/:id/editar" element={<DetalleFactura />} />
        {esAdmin ? (
          <>
            <Route path="/configuracion" element={<Configuracion />} />
            <Route path="/" element={<PanelAdmin />} />
            <Route path="/maestro" element={<HistorialGlobal />} />
            <Route path="/proveedores" element={<PerfilProveedores />} />
            <Route path="/auditoria" element={<LogAuditoria />} />
            <Route path="/usuarios" element={<GestionUsuarios />} />
            <Route path="/validacion" element={<ValidacionCruzada />} />
          </>
        ) : (
          <>
            <Route path="/" element={<PanelPrincipal />} />
            <Route path="/clientes" element={<GestionClientes />} />
            <Route path="/historial" element={<Historial />} />
            <Route path="/validacion" element={<ValidacionCruzada />} />
          </>
        )}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

// Componente raíz: provee autenticación y enrutamiento
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <RutasProtegidas />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PanelPrincipal from './paginas/PanelPrincipal';
import DetalleFactura from './paginas/DetalleFactura';
import InicioSesion from './paginas/InicioSesion';

import Historial from './paginas/Historial';
import PanelAdmin from './paginas/PanelAdmin';
import HistorialGlobal from './paginas/HistorialGlobal';
import GestionUsuarios from './paginas/GestionUsuarios';
import LogAuditoria from './paginas/LogAuditoria';
import Layout from './componentes/Disposicion';
import LimiteDeError from './componentes/interfaz/LimiteDeError';
import { AuthProvider, useAuth } from './contexto/ContextoAuth';

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
      <LimiteDeError>
      <Routes>
        <Route path="/factura/:id/editar" element={<DetalleFactura />} />
        {esAdmin ? (
          <>
            <Route path="/" element={<PanelAdmin />} />
            <Route path="/maestro" element={<HistorialGlobal />} />
            <Route path="/auditoria" element={<LogAuditoria />} />
            <Route path="/usuarios" element={<GestionUsuarios />} />
          </>
        ) : (
          <>
            <Route path="/" element={<PanelPrincipal />} />
            <Route path="/historial" element={<Historial />} />
          </>
        )}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </LimiteDeError>
    </Layout>
  );
}

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

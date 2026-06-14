import React from 'react';
import Sidebar from './BarraLateral';

// Layout principal con sidebar y área de contenido
function Layout({ children }) {
  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-color)',
        transition: 'background-color 0.3s',
      }}
    >
      <Sidebar />
      <main
        style={{
          flex: 1,
          marginLeft: '260px',
          padding: '32px 40px',
          width: 'calc(100% - 260px)',
          height: '100vh',
          overflowY: 'auto',
        }}
      >
        {children}
      </main>
    </div>
  );
}

export default Layout;

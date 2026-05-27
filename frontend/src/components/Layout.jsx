import React from 'react';
import Sidebar from './Sidebar';

// Layout principal con sidebar y área de contenido
function Layout({ children }) {
  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
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
          minHeight: '100vh',
        }}
      >
        {children}
      </main>
    </div>
  );
}

export default Layout;

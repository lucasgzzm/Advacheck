import React from 'react';
import Sidebar from './BarraLateral';
import styles from '../../css/Disposicion.module.css';

function Layout({ children }) {
  return (
    <div className={styles.contenedor}>
      <Sidebar />
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}

export default Layout;

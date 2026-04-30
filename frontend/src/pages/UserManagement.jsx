import React, { useState, useEffect, useRef } from 'react';
import { Users, UserX, UserCheck, Shield, Search, RefreshCw, MoreVertical, Mail, X, Check } from 'lucide-react';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados para Menús y Modales
  const [activeMenu, setActiveMenu] = useState(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const menuRef = useRef(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch('http://127.0.0.1:8000/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Error al obtener la lista de usuarios');
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch('http://127.0.0.1:8000/api/admin/roles', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setRoles(data);
      }
    } catch (error) {
       console.error("Error al cargar roles:", error);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchRoles();

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleUserStatus = async (userId) => {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`http://127.0.0.1:8000/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        fetchUsers();
        setActiveMenu(null);
      } else {
        const err = await response.json();
        alert(err.detail || "Error al cambiar estado");
      }
    } catch (error) {
       alert("Error de conexión");
    }
  };

  const handleUpdateRole = async (newRoleId) => {
    if (!userToEdit) return;
    try {
      setIsUpdating(true);
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`http://127.0.0.1:8000/api/admin/users/${userToEdit.id}/role?rol_id=${newRoleId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        fetchUsers();
        setShowRoleModal(false);
        setUserToEdit(null);
      } else {
        const err = await response.json();
        alert(err.detail || "No se pudo actualizar el rol");
      }
    } catch (error) {
      alert("Error en la comunicación con el servidor");
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fade-in">
      <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-1px', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Users size={32} color="var(--primary)" />
            Gestión de Personal
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px', fontSize: '1.05rem' }}>Administración de accesos, roles y seguridad de cuentas.</p>
        </div>
        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
           Crear Analista
        </button>
      </header>

      {/* Modal de Cambio de Rol */}
      {showRoleModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '32px', animation: 'fadeIn 0.3s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Modificar Privilegios</h2>
              <button onClick={() => setShowRoleModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20}/></button>
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
              Selecciona el nuevo rol para <strong>{userToEdit?.nombre}</strong>. Esto cambiará sus permisos de acceso inmediatamente.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {roles.map(rol => (
                <button
                  key={rol.id}
                  onClick={() => handleUpdateRole(rol.id)}
                  disabled={isUpdating}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid var(--card-border)',
                    backgroundColor: userToEdit?.rol_nombre === rol.nombre ? 'var(--primary-light)' : 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'left'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: userToEdit?.rol_nombre === rol.nombre ? 'var(--primary)' : 'var(--text-main)' }}>{rol.nombre}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{rol.descripcion}</div>
                  </div>
                  {userToEdit?.rol_nombre === rol.nombre && <Check size={18} color="var(--primary)" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: 'rgba(0,0,0,0.02)' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
            <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Buscar por nombre o email..." 
              className="form-input" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', paddingLeft: '40px', fontSize: '0.9rem' }} 
            />
          </div>
          <button onClick={fetchUsers} className="btn" style={{ padding: '10px', backgroundColor: 'transparent', border: '1px solid var(--card-border)' }}>
             <RefreshCw size={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center' }}><RefreshCw className="lucide-spin" size={32} color="var(--primary)" /></div>
        ) : error ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--red)' }}>{error}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)', borderBottom: '1px solid var(--card-border)' }}>
                  <th style={{ padding: '16px 24px', fontWeight: 600, fontSize: '0.85rem' }}>Usuario</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600, fontSize: '0.85rem' }}>Email</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600, fontSize: '0.85rem' }}>Rol de Acceso</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600, fontSize: '0.85rem' }}>Estado</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600, fontSize: '0.85rem' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--card-border)', transition: 'background-color 0.2s' }}>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700 }}>
                          {u.nombre.substring(0,2).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{u.nombre}</span>
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                         <Mail size={14} /> {u.email}
                       </div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 500 }}>
                          <Shield size={14} color="var(--primary)" />
                          {u.rol_nombre}
                        </div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                       {u.activo ? (
                         <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--green)', fontSize: '0.8rem', fontWeight: 600, background: 'rgba(34, 197, 94, 0.1)', padding: '4px 10px', borderRadius: '20px' }}>
                           <UserCheck size={14} /> Activo
                         </span>
                       ) : (
                         <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--red)', fontSize: '0.8rem', fontWeight: 600, background: 'rgba(239, 68, 68, 0.1)', padding: '4px 10px', borderRadius: '20px' }}>
                           <UserX size={14} /> Bloqueado
                         </span>
                       )}
                    </td>
                    <td style={{ padding: '16px 24px', position: 'relative' }}>
                       <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setActiveMenu(activeMenu === u.id ? null : u.id); 
                            }} 
                            className="btn" 
                            style={{ padding: '8px', backgroundColor: 'transparent' }}
                          >
                            <MoreVertical size={18} />
                          </button>
                          
                          {activeMenu === u.id && (
                            <div ref={menuRef} style={{ position: 'absolute', right: '40px', top: '50px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid var(--card-border)', zIndex: 50, overflow: 'hidden', minWidth: '160px', animation: 'fadeIn 0.2s ease-out' }}>
                               <button 
                                 className="dropdown-item" 
                                 onClick={() => { setShowRoleModal(true); setUserToEdit(u); setActiveMenu(null); }}
                                 style={{ width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '0.9rem' }}
                               >
                                  <Shield size={16} color="var(--primary)" /> Modificar Rol
                               </button>
                               <button 
                                 className="dropdown-item" 
                                 onClick={() => toggleUserStatus(u.id)}
                                 style={{ width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', border: 'none', borderTop: '1px solid var(--card-border)', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '0.9rem', color: u.activo ? 'var(--red)' : 'var(--green)' }}
                               >
                                  {u.activo ? <UserX size={16} /> : <UserCheck size={16} />} 
                                  {u.activo ? 'Bloquear Usuario' : 'Activar Usuario'}
                               </button>
                            </div>
                          )}
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement;

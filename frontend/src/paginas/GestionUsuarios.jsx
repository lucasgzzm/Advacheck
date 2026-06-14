import React, { useState, useEffect } from 'react';
import { API_BASE } from '../servicios/api';
import { Users, UserX, UserCheck, Shield, Search, RefreshCw, Mail, X, Check, Trash2, UserPlus, Plus } from 'lucide-react';

// Componente principal: gestión de usuarios con roles, búsqueda, creación y eliminación
const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para Menús y Modales
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Estados para crear usuario
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState({ nombre: '', email: '', password: '', rol_id: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Obtiene la lista de usuarios desde el servidor
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/admin/users`, {
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

  // Obtiene la lista de roles disponibles desde el servidor
  const fetchRoles = async () => {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/admin/roles`, {
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
  }, []);

  // Activa o desactiva (bloquea) un usuario
  const toggleUserStatus = async (userId) => {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        fetchUsers();
      } else {
        const err = await response.json();
        alert(err.detail || "Error al cambiar estado");
      }
    } catch (error) {
      alert("Error de conexión");
    }
  };

  // Elimina permanentemente al usuario seleccionado
  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/admin/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        fetchUsers();
        setShowDeleteModal(false);
        setUserToDelete(null);
      } else {
        const err = await response.json();
        alert(err.detail || "Error al eliminar usuario");
      }
    } catch (error) {
      alert("Error de conexión al eliminar");
    }
  };

  // Actualiza el rol de un usuario
  const handleUpdateRole = async (newRoleId) => {
    if (!userToEdit) return;
    try {
      setIsUpdating(true);
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/admin/users/${userToEdit.id}/role?rol_id=${newRoleId}`, {
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

  // Crea un nuevo usuario con los datos del formulario
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateError('');
    if (!newUser.rol_id) { setCreateError('Selecciona un rol'); return; }
    setCreating(true);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/admin/users`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });
      if (response.ok) {
        setShowCreateForm(false);
        setNewUser({ nombre: '', email: '', password: '', rol_id: '' });
        fetchUsers();
      } else {
        const err = await response.json();
        setCreateError(err.detail || 'Error al crear usuario');
      }
    } catch (error) {
      setCreateError('Error de conexión');
    } finally {
      setCreating(false);
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
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', fontSize: '0.85rem', fontWeight: 700 }}
        >
          {showCreateForm ? <X size={18} /> : <UserPlus size={18} />}
          {showCreateForm ? 'Cancelar' : 'Nuevo Usuario'}
        </button>
      </header>

      {/* Formulario de Creación de Usuario */}
      {showCreateForm && (
        <div className="glass-panel" style={{ marginBottom: '24px', padding: '24px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserPlus size={20} color="var(--primary)" /> Crear Nuevo Usuario
          </h3>
          <form onSubmit={handleCreateUser} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Nombre completo</label>
              <input type="text" required placeholder="Ej: Juan Pérez" value={newUser.nombre} onChange={(e) => setNewUser({ ...newUser, nombre: e.target.value })}
                className="form-input" style={{ width: '100%', fontSize: '0.85rem' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Email</label>
              <input type="email" required placeholder="correo@webcheck.com" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                className="form-input" style={{ width: '100%', fontSize: '0.85rem' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Contraseña</label>
              <input type="password" required placeholder="Mín. 6 caracteres" minLength={6} value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                className="form-input" style={{ width: '100%', fontSize: '0.85rem' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Rol</label>
              <select required value={newUser.rol_id} onChange={(e) => setNewUser({ ...newUser, rol_id: parseInt(e.target.value) })}
                className="form-input" style={{ width: '100%', fontSize: '0.85rem' }}>
                <option value="">Seleccionar...</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button type="submit" disabled={creating} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', fontSize: '0.85rem' }}>
                {creating ? <RefreshCw size={16} className="spin" /> : <Plus size={16} />}
                {creating ? 'Creando...' : 'Crear Usuario'}
              </button>
              {createError && <span style={{ color: 'var(--red)', fontSize: '0.8rem' }}>{createError}</span>}
            </div>
          </form>
        </div>
      )}

      {/* Modal de Cambio de Rol */}
      {showRoleModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(8px)' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '32px', animation: 'fadeIn 0.3s ease-out', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Modificar Privilegios</h2>
              <button onClick={() => setShowRoleModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
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

      {/* Modal Flotante de Confirmación de Eliminación */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(8px)' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '32px', border: '1px solid rgba(239, 68, 68, 0.2)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', transform: 'scale(1)', transition: 'all 0.3s ease-out' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                <Trash2 size={28} color="var(--red)" />
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 12px 0', letterSpacing: '-0.5px' }}>
                ¿Eliminar Personal?
              </h2>
              <p style={{ fontSize: '0.925rem', color: 'var(--text-muted)', lineHeight: '1.6', margin: '0 0 28px 0' }}>
                Estás a punto de eliminar permanentemente a <strong>{userToDelete?.nombre}</strong> ({userToDelete?.email}).
                <br />
                <span style={{ fontSize: '0.825rem', display: 'block', marginTop: '10px', color: 'var(--text-muted)', backgroundColor: 'rgba(0, 0, 0, 0.03)', padding: '8px 12px', borderRadius: '8px', borderLeft: '3px solid var(--primary)' }}>
                  ℹ️ Sus documentos y catálogo asociados quedarán a salvo de forma segura en el sistema.
                </span>
              </p>
              <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                <button
                  onClick={() => { setShowDeleteModal(false); setUserToDelete(null); }}
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '12px', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteUser}
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '12px', backgroundColor: 'var(--red)', color: 'white', border: 'none', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <Trash2 size={16} />
                  Eliminar Cuenta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Panel Contenedor de la Tabla */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }}>
        {/* Barra de Filtros */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: 'rgba(0,0,0,0.01)' }}>
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
          <button onClick={fetchUsers} className="btn btn-secondary" style={{ padding: '10px 12px', borderRadius: '10px' }} title="Refrescar lista">
            <RefreshCw size={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center' }}><RefreshCw className="lucide-spin" size={32} color="var(--primary)" /></div>
        ) : error ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--red)' }}>{error}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', verticalAlign: 'middle' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)', borderBottom: '1px solid var(--card-border)' }}>
                  <th style={{ padding: '18px 24px', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.5px', textTransform: 'uppercase', width: '25%' }}>Usuario</th>
                  <th style={{ padding: '18px 24px', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.5px', textTransform: 'uppercase', width: '30%' }}>Email</th>
                  <th style={{ padding: '18px 24px', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.5px', textTransform: 'uppercase', width: '20%' }}>Rol de Acceso</th>
                  <th style={{ padding: '18px 24px', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.5px', textTransform: 'uppercase', width: '12%' }}>Estado</th>
                  <th style={{ padding: '18px 24px', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.5px', textTransform: 'uppercase', width: '13%', textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--card-border)', transition: 'background-color 0.2s', verticalAlign: 'middle' }} className="table-row-hover">
                    {/* Celda: Usuario */}
                    <td style={{ padding: '16px 24px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 700, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                          {u.nombre.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 650, color: 'var(--text-main)', fontSize: '0.95rem' }}>{u.nombre}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>ID: #{u.id}</div>
                        </div>
                      </div>
                    </td>

                    {/* Celda: Email */}
                    <td style={{ padding: '16px 24px', color: 'var(--text-muted)', fontSize: '0.9rem', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Mail size={15} color="var(--text-muted)" style={{ opacity: 0.7 }} />
                        <span style={{ fontWeight: 500 }}>{u.email}</span>
                      </div>
                    </td>

                    {/* Celda: Rol */}
                    <td style={{ padding: '16px 24px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)', backgroundColor: 'var(--primary-light)', padding: '6px 12px', borderRadius: '8px' }}>
                        <Shield size={13} color="var(--primary)" />
                        {u.rol_nombre}
                      </div>
                    </td>

                    {/* Celda: Estado */}
                    <td style={{ padding: '16px 24px', verticalAlign: 'middle' }}>
                      {u.online ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--green)', fontSize: '0.8rem', fontWeight: 700, background: 'rgba(34, 197, 94, 0.1)', padding: '5px 12px', borderRadius: '20px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--green)', display: 'inline-block' }}></span>
                          Activo
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, background: 'rgba(0, 0, 0, 0.05)', padding: '5px 12px', borderRadius: '20px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--text-muted)', display: 'inline-block' }}></span>
                          Ausente
                        </span>
                      )}
                    </td>

                    {/* Celda: Acciones */}
                    <td style={{ padding: '16px 24px', verticalAlign: 'middle', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button
                          onClick={() => { setShowRoleModal(true); setUserToEdit(u); }}
                          className="btn btn-secondary"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            fontSize: '0.8rem',
                            fontWeight: 650,
                            borderRadius: '8px',
                            transition: 'all 0.2s',
                            cursor: 'pointer',
                            border: '1px solid var(--card-border)'
                          }}
                        >
                          <Shield size={14} className="shield-icon" />
                          Modificar
                        </button>

                        <button
                          onClick={() => toggleUserStatus(u.id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            fontSize: '0.8rem',
                            fontWeight: 650,
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: u.activo ? 'rgba(239, 68, 68, 0.08)' : 'rgba(34, 197, 94, 0.08)',
                            color: u.activo ? 'var(--red)' : 'var(--green)',
                            transition: 'all 0.2s',
                            cursor: 'pointer'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = u.activo ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = u.activo ? 'rgba(239, 68, 68, 0.08)' : 'rgba(34, 197, 94, 0.08)';
                          }}
                        >
                          {u.activo ? <UserX size={14} /> : <UserCheck size={14} />}
                          {u.activo ? 'Bloquear' : 'Activar'}
                        </button>

                        <button
                          onClick={() => { setUserToDelete(u); setShowDeleteModal(true); }}
                          title="Eliminar Personal"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '10px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: 'rgba(239, 68, 68, 0.05)',
                            color: 'var(--red)',
                            transition: 'all 0.2s',
                            cursor: 'pointer'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.05)';
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
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

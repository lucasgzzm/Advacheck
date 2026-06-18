// Gestion de usuarios con CRUD, roles y busqueda
import React, { useState, useEffect } from 'react';
import { API_BASE } from '../servicios/api';
import { Users, UserX, UserCheck, Shield, Search, RefreshCw, Mail, X, Check, Trash2, UserPlus, Plus } from 'lucide-react';

import styles from '../../css/GestionUsuarios.module.css';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState({ nombre: '', email: '', password: '', rol_id: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

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

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    fetch(`${API_BASE}/api/admin/users`, { headers, signal })
      .then(r => { if (!r.ok) throw new Error('Error al obtener la lista de usuarios'); return r.json(); })
      .then(setUsers)
      .catch(err => { if (err.name !== 'AbortError') setError(err.message); });

    fetch(`${API_BASE}/api/admin/roles`, { headers, signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setRoles)
      .catch(() => {});

    return () => controller.abort();
  }, []);

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
        setError(err.detail || "Error al cambiar estado");
      }
    } catch (_error) {
      setError("Error de conexión");
    }
  };

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
        setError(err.detail || "Error al eliminar usuario");
      }
    } catch (_error) {
      setError("Error de conexión al eliminar");
    }
  };

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
        setError(err.detail || "No se pudo actualizar el rol");
      }
    } catch (_error) {
      setError("Error en la comunicación con el servidor");
    } finally {
      setIsUpdating(false);
    }
  };

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
    } catch (_error) {
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
    <div className={`fade-in ${styles.pageContainer}`}>
      <header className={styles.headerSection}>
        <div>
          <h1 className={styles.pageTitle}>
            <div className={styles.headerTitleGroup}>
              <div className={styles.headerIconBox}>
                <Users size={20} color="var(--primary)" />
              </div>
              Gestión de Personal
            </div>
          </h1>
          <p className={styles.pageSubtitle}>Administración de accesos, roles y seguridad de cuentas.</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className={`btn btn-primary ${styles.newUserBtn}`}
        >
          <UserPlus size={18} />
          Nuevo Usuario
        </button>
      </header>

      {showCreateForm && (
        <div className={styles.modalOverlay}>
          <div className={`glass-panel ${styles.createModalPanel}`}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                <UserPlus size={20} color="var(--primary)" /> Nuevo Usuario
              </h3>
              <button onClick={() => { setShowCreateForm(false); setCreateError(''); }} className={styles.modalCloseBtn}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className={styles.formField}>
                <label>Nombre completo</label>
                <input type="text" required placeholder="Ej: Juan Pérez" value={newUser.nombre} onChange={(e) => setNewUser({ ...newUser, nombre: e.target.value })}
                  className="form-input" />
              </div>
              <div className={styles.formField}>
                <label>Email</label>
                <input type="email" required placeholder="correo@webcheck.com" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="form-input" />
              </div>
              <div className={styles.formField}>
                <label>Contraseña</label>
                <input type="password" required placeholder="Mín. 6 caracteres" minLength={6} value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="form-input" />
              </div>
              <div className={styles.formField}>
                <label>Rol</label>
                <select required value={newUser.rol_id} onChange={(e) => setNewUser({ ...newUser, rol_id: parseInt(e.target.value) })}
                  className="form-input">
                  <option value="">Seleccionar...</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
              </div>
              {createError && <span className={styles.errorMsg}>{createError}</span>}
              <div className={styles.createModalActions}>
                <button type="submit" disabled={creating} className={`btn btn-primary ${styles.submitBtn}`}>
                  {creating ? <RefreshCw size={16} className="spin" /> : <Plus size={16} />}
                  {creating ? 'Creando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRoleModal && (
        <div className={styles.modalOverlay}>
          <div className={`glass-panel ${styles.modalPanel}`}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Modificar Privilegios</h2>
              <button onClick={() => setShowRoleModal(false)} className={styles.modalCloseBtn}><X size={20} /></button>
            </div>
            <p className={styles.modalDesc}>
              Selecciona el nuevo rol para <strong>{userToEdit?.nombre}</strong>. Esto cambiará sus permisos de acceso inmediatamente.
            </p>
            <div className={styles.roleList}>
              {roles.map(rol => {
                const isActive = userToEdit?.rol_nombre === rol.nombre;
                return (
                  <button
                    key={rol.id}
                    onClick={() => handleUpdateRole(rol.id)}
                    disabled={isUpdating}
                    className={`${styles.roleOption} ${isActive ? styles.roleOptionActive : styles.roleOptionInactive}`}
                  >
                    <div>
                      <div className={`${styles.roleName} ${isActive ? styles.roleNameActive : styles.roleNameInactive}`}>{rol.nombre}</div>
                      <div className={styles.roleDesc}>{rol.descripcion}</div>
                    </div>
                    {isActive && <Check size={18} color="var(--primary)" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className={styles.modalOverlay}>
          <div className={`glass-panel ${styles.deleteModalPanel}`}>
            <div className={styles.deleteModalBody}>
              <div className={styles.deleteIconCircle}>
                <Trash2 size={28} color="var(--red)" />
              </div>
              <h2 className={styles.deleteModalTitle}>
                ¿Eliminar Personal?
              </h2>
              <p className={styles.deleteModalDesc}>
                Estás a punto de eliminar permanentemente a <strong>{userToDelete?.nombre}</strong> ({userToDelete?.email}).
                <br />
                <span className={styles.deleteNoteBox}>
                  ℹ️ Sus documentos y catálogo asociados quedarán a salvo de forma segura en el sistema.
                </span>
              </p>
              <div className={styles.deleteActions}>
                <button
                  onClick={() => { setShowDeleteModal(false); setUserToDelete(null); }}
                  className={`btn btn-secondary ${styles.deleteCancelBtn}`}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteUser}
                  className={`btn btn-primary ${styles.deleteConfirmBtn}`}
                >
                  <Trash2 size={16} />
                  Eliminar Cuenta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }}>
        
        <div className={styles.filterBar}>
          <div className={styles.searchWrapper}>
            <Search size={18} color="var(--text-muted)" className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              className={`form-input ${styles.searchInput}`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <span className={styles.resultCount}>
            {filteredUsers.length} de {users.length}
          </span>
          <button onClick={fetchUsers} className={`btn btn-secondary ${styles.refreshBtn}`} title="Refrescar lista">
            <RefreshCw size={18} />
          </button>
        </div>

        {loading ? (
          <div className={styles.loadingState}><RefreshCw className="lucide-spin" size={32} color="var(--primary)" /></div>
        ) : error ? (
          <div className={styles.errorState}>{error}</div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead className={styles.tableHead}>
                <tr>
                  <th className={styles.tableHeaderCell}>Usuario</th>
                  <th className={styles.tableHeaderCell}>Email</th>
                  <th className={styles.tableHeaderCell}>Rol de Acceso</th>
                  <th className={styles.tableHeaderCell}>Estado</th>
                  <th className={styles.tableHeaderCell} style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u, i) => (
                  <tr key={u.id} className={styles.tableRow} style={{
                    borderBottom: '1px solid var(--card-border)',
                    background: i % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent',
                  }}>
                    
                    <td className={styles.tableCell}>
                      <div className={styles.userCell}>
                        <div className={styles.userAvatar}>
                          {u.nombre.substring(0, 2).toUpperCase()}
                        </div>
                        <div className={styles.userInfo}>
                          <div className={styles.userName}>{u.nombre}</div>
                          <div className={styles.userId}>ID: #{u.id}</div>
                        </div>
                      </div>
                    </td>

                    <td className={styles.tableCell} style={{ color: 'var(--text-muted)' }}>
                      <div className={styles.emailCell}>
                        <Mail size={15} color="var(--text-muted)" className={styles.emailIcon} />
                        <span className={styles.emailText}>{u.email}</span>
                      </div>
                    </td>

                    <td className={styles.tableCell}>
                      <div className={styles.roleBadge}>
                        <Shield size={13} color="var(--primary)" />
                        {u.rol_nombre}
                      </div>
                    </td>

                    <td className={styles.tableCell}>
                      {u.online ? (
                        <span className={styles.statusBadge} style={{ color: 'var(--green)', background: 'rgba(34, 197, 94, 0.1)' }}>
                          <span className={styles.statusDot} style={{ backgroundColor: 'var(--green)' }}></span>
                          Activo
                        </span>
                      ) : (
                        <span className={styles.statusBadge} style={{ color: 'var(--text-muted)', background: 'rgba(0, 0, 0, 0.05)' }}>
                          <span className={styles.statusDot} style={{ backgroundColor: 'var(--text-muted)' }}></span>
                          Ausente
                        </span>
                      )}
                    </td>

                    <td className={styles.actionsCell}>
                      <div className={styles.actionsGroup}>
                        <button
                          onClick={() => { setShowRoleModal(true); setUserToEdit(u); }}
                          className={`btn btn-secondary ${styles.actionBtnShield}`}
                        >
                          <Shield size={14} className="shield-icon" />
                          Modificar
                        </button>

                        <button
                          onClick={() => toggleUserStatus(u.id)}
                          className={styles.actionBtnShield}
                          style={{
                            border: 'none',
                            backgroundColor: u.activo ? 'rgba(239, 68, 68, 0.08)' : 'rgba(34, 197, 94, 0.08)',
                            color: u.activo ? 'var(--red)' : 'var(--green)',
                          }}
                        >
                          {u.activo ? <UserX size={14} /> : <UserCheck size={14} />}
                          {u.activo ? 'Bloquear' : 'Activar'}
                        </button>

                        <button
                          onClick={() => { setUserToDelete(u); setShowDeleteModal(true); }}
                          className={styles.actionBtnIcon}
                          style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', color: 'var(--red)' }}
                          title="Eliminar Personal"
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

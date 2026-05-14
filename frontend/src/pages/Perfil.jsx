import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/ContextoAuth';
import { User, Shield, Lock, Save, AlertCircle, CheckCircle2 } from 'lucide-react';

const Profile = () => {
  const { user } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Estados para cambio de contraseña
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch('http://127.0.0.1:8000/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setProfileData(data);
      }
    } catch (error) {
      console.error("Error al cargar perfil:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Las nuevas contraseñas no coinciden' });
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch('http://127.0.0.1:8000/api/auth/change-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword
        })
      });

      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: 'Contraseña actualizada correctamente' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setMessage({ type: 'error', text: data.detail || 'Error al cambiar contraseña' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión con el servidor' });
    } finally {
      setSubmitting(false);
    }
  };

  // Usamos los datos del contexto como respaldo inmediato
  const displayData = {
    nombre: profileData?.nombre || user?.name || '...',
    email: profileData?.email || user?.email || '...',
    rol_nombre: profileData?.rol_nombre || user?.role || '...',
    activo: profileData !== null ? profileData.activo : true 
  };

  // Mapeo amigable de roles solicitado por el usuario
  const getFriendlyRole = (role) => {
    if (!role) return 'Usuario';
    const r = role.toLowerCase();
    if (r === 'administrador' || r === 'admin') return 'Admin';
    return 'Usuario';
  };

  if (loading && !profileData && !user) return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Cargando datos del perfil...</div>;

  return (
    <div style={{ padding: '32px', maxWidth: '900px', margin: '0 auto', animation: 'fadeIn 0.5s ease-out' }}>
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>Mi Perfil</h1>
        <p style={{ color: 'var(--text-muted)' }}>Gestiona tu información personal y los parámetros de seguridad de tu cuenta.</p>
      </header>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        
        {/* Columna 1: Información Personal (Read-only) */}
        <section className="glass-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--card-border)' }}>
            <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: 'var(--primary-light)' }}>
              <User size={24} color="var(--primary)" />
            </div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>Información Personal</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>Nombre Completo</label>
              <div style={{ padding: '12px', backgroundColor: 'var(--bg-color)', borderRadius: '8px', color: 'var(--text-main)', fontWeight: 500, border: '1px solid var(--card-border)' }}>
                {displayData.nombre}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>Email Corporativo</label>
              <div style={{ padding: '12px', backgroundColor: 'var(--bg-color)', borderRadius: '8px', color: 'var(--text-main)', border: '1px solid var(--card-border)' }}>
                {displayData.email}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>Rol en Plataforma</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ 
                  padding: '6px 14px', 
                  backgroundColor: 'var(--primary)', 
                  color: 'white', 
                  borderRadius: '20px', 
                  fontSize: '0.85rem', 
                  fontWeight: 700,
                  boxShadow: '0 4px 10px rgba(59, 130, 246, 0.2)'
                }}>
                  {getFriendlyRole(displayData.rol_nombre)}
                </span>
                <span style={{ 
                  padding: '5px 12px', 
                  backgroundColor: displayData.activo ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                  color: displayData.activo ? 'var(--green)' : 'var(--red)', 
                  borderRadius: '20px', 
                  fontSize: '0.8rem', 
                  fontWeight: 600,
                  border: `1px solid ${displayData.activo ? 'var(--green)' : 'var(--red)'}40`
                }}>
                  {displayData.activo ? '● Activo' : '● Inactivo'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Columna 2: Seguridad / Cambio de Contraseña */}
        <section className="glass-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--card-border)' }}>
            <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: 'rgba(245, 158, 11, 0.1)' }}>
              <Shield size={24} color="#f59e0b" />
            </div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>Seguridad y Contraseña</h2>
          </div>

          <form onSubmit={handlePasswordChange}>
            {message.type && (
              <div style={{ 
                padding: '12px', 
                borderRadius: '8px', 
                backgroundColor: message.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: message.type === 'success' ? 'var(--green)' : 'var(--red)',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '0.9rem'
              }}>
                {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                {message.text}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '8px', fontWeight: 600 }}>Contraseña Actual</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="password" 
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  style={{ width: '100%', padding: '12px 12px 12px 38px', borderRadius: '8px', border: '1px solid var(--card-border)', outline: 'none' }} 
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '8px', fontWeight: 600 }}>Nueva Contraseña</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ width: '100%', padding: '12px 12px 12px 38px', borderRadius: '8px', border: '1px solid var(--card-border)', outline: 'none' }} 
                  placeholder="Mínimo 6 caracteres"
                  minLength="6"
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '8px', fontWeight: 600 }}>Confirmar Contraseña</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{ width: '100%', padding: '12px 12px 12px 38px', borderRadius: '8px', border: '1px solid var(--card-border)', outline: 'none' }} 
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={submitting}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              <Save size={18} /> {submitting ? 'Guardando...' : 'Actualizar Contraseña'}
            </button>
          </form>
        </section>

      </div>
    </div>
  );
};

export default Profile;


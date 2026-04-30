import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, Mail, Lock, ShieldCheck, AlertCircle } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password, remember);
    
    if (result.success) {
      navigate('/');
    } else {
      setError(result.message || 'Error al iniciar sesión. Verifica tus credenciales.');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--bg-color)',
      padding: '24px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '440px',
        padding: '48px',
        animation: 'fadeIn 0.5s ease-out',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        {/* Logo Section */}
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <img src="/logo-completo.png" alt="AdvaCheck" style={{ height: '64px', marginBottom: '16px' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)', margin: '0' }}>
            Bienvenido de nuevo
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '8px' }}>
            Ingresa tus credenciales para acceder
          </p>
        </div>

        {error && (
          <div style={{
            width: '100%',
            padding: '12px 16px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--red)',
            borderRadius: '8px',
            color: 'var(--red)',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '24px'
          }}>
            <AlertCircle size={18} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>Email corporativo</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="email"
                required
                placeholder="ejemplo@webcheck.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '14px 14px 14px 44px',
                  borderRadius: '10px',
                  border: '1px solid var(--card-border)',
                  backgroundColor: 'white',
                  fontSize: '0.95rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>Contraseña</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '14px 14px 14px 44px',
                  borderRadius: '10px',
                  border: '1px solid var(--card-border)',
                  backgroundColor: 'white',
                  fontSize: '0.95rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <input 
                type="checkbox" 
                checked={remember} 
                onChange={() => setRemember(!remember)}
                style={{ cursor: 'pointer' }} 
              /> Recordarme
            </label>
            <a href="#" style={{ fontSize: '0.85rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>¿Olvidaste tu contraseña?</a>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: 'var(--primary)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Verificando...' : <><LogIn size={20} /> Iniciar Sesión</>}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <Link 
            to="/registrar"
            style={{ 
              color: 'var(--text-muted)', 
              fontSize: '0.85rem', textDecoration: 'underline' 
            }}
          >
            ¿No tienes cuenta? Regístrate gratis
          </Link>
        </div>

        <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid var(--card-border)', width: '100%', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            <ShieldCheck size={16} color="var(--green)" /> Conexión segura y encriptada (AES-256)
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexto/ContextoAuth';
import { AlertCircle, ShieldCheck, LogIn } from 'lucide-react';

// Componente de input reutilizable para el formulario de login
const AppInput = ({ label, placeholder, icon, value, onChange, type, required }) => {
  return (
    <div className="w-full" style={{ minWidth: '200px', position: 'relative' }}>
      <div style={{ position: 'relative', width: '100%' }}>
        <input
          type={type || 'text'}
          required={required}
          value={value}
          onChange={onChange}
          style={{
            position: 'relative',
            zIndex: 10,
            border: '2px solid var(--login-border)',
            height: '52px',
            width: '100%',
            borderRadius: '6px',
            background: 'var(--login-surface)',
            padding: '0 16px',
            fontWeight: 400,
            outline: 'none',
            color: 'var(--login-text-primary)',
            fontSize: '0.95rem',
            transition: 'all 0.2s ease-in-out',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}
          placeholder={placeholder}
        />
        {icon && (
          <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', zIndex: 20 }}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

// Componente principal: formulario de inicio de sesión
const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Maneja el envío del formulario de login
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
      height: '100vh',
      width: '100%',
      background: 'var(--login-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{
        width: '80%',
        maxWidth: '1100px',
        display: 'flex',
        height: '600px',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid var(--login-border)',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05)',
      }}>
        {/* Left Panel - Form */}
        <div
          style={{
            width: '100%',
            flex: '1 1 50%',
            padding: '0 4rem',
            position: 'relative',
            background: 'var(--login-bg)',
          }}
        >
          {/* Form Content */}
          <div style={{ position: 'relative', zIndex: 10, height: '100%' }}>
            <form
              onSubmit={handleSubmit}
              style={{
                textAlign: 'center',
                padding: '40px 0',
                display: 'grid',
                gap: '8px',
                height: '100%',
                alignContent: 'center',
              }}
            >
              {/* Logo */}
              <div style={{ marginBottom: '8px' }}>
                <img src="/logo-completo.png" alt="WebCheck" style={{ height: '48px' }} />
              </div>

              <div style={{ display: 'grid', gap: '16px', marginBottom: '8px' }}>
                <h1 style={{
                  fontSize: '2.25rem',
                  fontWeight: 800,
                  color: 'var(--login-heading)',
                  margin: 0,
                  letterSpacing: '-0.02em',
                }}>
                  Iniciar Sesi&oacute;n
                </h1>
                <span style={{
                  fontSize: '0.875rem',
                  color: 'var(--login-text-secondary)',
                }}>
                  Ingresa tus credenciales para acceder
                </span>
              </div>

              {error && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: '8px',
                  color: '#ef4444',
                  fontSize: '0.85rem',
                  textAlign: 'left',
                }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              <div style={{ display: 'grid', gap: '16px', marginTop: '8px' }}>
                <AppInput
                  placeholder="Email corporativo"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <AppInput
                  placeholder="Contrase&ntilde;a"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '4px',
              }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  color: 'var(--login-text-secondary)',
                }}>
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={() => setRemember(!remember)}
                    style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                  />
                  Recordarme
                </label>
                <a href="#" style={{
                  fontSize: '0.85rem',
                  color: 'var(--login-text-primary)',
                  textDecoration: 'none',
                  fontWeight: 300,
                }}>
                  &iquest;Olvidaste tu contrase&ntilde;a?
                </a>
              </div>

              <div style={{ marginTop: '8px', textAlign: 'center' }}>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                  style={{
                    padding: '10px 32px',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    opacity: loading ? 0.7 : 1,
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? 'Verificando...' : <><LogIn size={20} /> Iniciar Sesi&oacute;n</>}
                </button>
              </div>

              <div style={{
                marginTop: '24px',
                paddingTop: '16px',
                borderTop: '1px solid var(--login-border)',
                textAlign: 'center',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  color: 'var(--login-text-secondary)',
                  fontSize: '0.8rem',
                }}>
                  <ShieldCheck size={16} color="var(--green)" />
                  Conexi&oacute;n segura y encriptada (AES-256)
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Right Panel - Image */}
        <div style={{
          display: 'none',
          flex: '1 1 50%',
          overflow: 'hidden',
        }} className="login-right-panel">
          <img
            src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1000&h=1000&fit=crop"
            alt="Logistics"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 1,
            }}
          />
        </div>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .login-right-panel {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Login;

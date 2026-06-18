// Pagina de inicio de sesion con formulario de email y contrasena
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexto/ContextoAuth';
import { AlertCircle, ShieldCheck, LogIn, Eye, EyeOff } from 'lucide-react';
import styles from '../../css/InicioSesion.module.css';

const AppInput = ({ label, placeholder, icon, value, onChange, type, required }) => {
  return (
    <div className={styles.inputWrapper}>
      <div className={styles.inputInner}>
        <input
          type={type || 'text'}
          required={required}
          value={value}
          onChange={onChange}
          className={`${styles.input} ${icon ? styles.inputConIcono : ''}`}
          placeholder={placeholder}
        />
        {icon && (
          <div className={styles.inputIcon}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
    <div className={styles.container}>
      <div className={styles.card}>
        
        <div className={styles.leftPanel}>
          <div className={styles.formWrapper}>
            <form onSubmit={handleSubmit} className={styles.form}>
              
              <div className={styles.logoWrapper}>
                <img src="/logo-completo.png" alt="WebCheck" className={styles.logoImg} />
              </div>

              <div className={styles.formHeader}>
                <h1 className={styles.title}>Iniciar Sesi&oacute;n</h1>
                <span className={styles.subtitle}>Ingresa tus credenciales para acceder</span>
              </div>

              {error && (
                <div className={styles.errorBox}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              <div className={styles.inputGroup}>
                <AppInput
                  placeholder="Email corporativo"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <AppInput
                  placeholder="Contrase&ntilde;a"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  icon={
                    <button type="button" onClick={() => setShowPassword(p => !p)}
                      className={styles.eyeButton}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  }
                />
              </div>

              <div className={styles.rememberRow}>
                <label className={styles.rememberLabel}>
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={() => setRemember(!remember)}
                    className={styles.checkbox}
                  />
                  Recordarme
                </label>
                <a href="#" className={styles.forgotLink}>
                  &iquest;Olvidaste tu contrase&ntilde;a?
                </a>
              </div>

              <div className={styles.submitWrapper}>
                <button
                  type="submit"
                  disabled={loading}
                  className={`btn btn-primary ${styles.submitBtn}`}
                  style={{
                    opacity: loading ? 0.7 : 1,
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? 'Verificando...' : <><LogIn size={20} /> Iniciar Sesi&oacute;n</>}
                </button>
              </div>

              <div className={styles.footer}>
                <div className={styles.securityBadge}>
                  <ShieldCheck size={16} color="var(--green)" />
                  Conexi&oacute;n segura y encriptada (AES-256)
                </div>
              </div>
            </form>
          </div>
        </div>

        <div className={`login-right-panel ${styles.rightPanel}`}>
          <img
            src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1000&h=1000&fit=crop"
            alt="Logistics"
            className={styles.image}
          />
        </div>
      </div>
    </div>
  );
};

export default Login;

// Limite de error boundary para capturar errores de React
import React from 'react';

export default class LimiteDeError extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Error capturado por LimiteDeError:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '60vh', padding: '2rem',
          color: '#721c24', backgroundColor: '#f8d7da', borderRadius: '8px',
          margin: '1rem', textAlign: 'center',
        }}>
          <h2>Ocurri&oacute; un error inesperado</h2>
          <p style={{ margin: '1rem 0', color: '#856404' }}>
            {this.state.error.message}
          </p>
          <button
            className="btn btn-secondary"
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
          >
            Recargar p&aacute;gina
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

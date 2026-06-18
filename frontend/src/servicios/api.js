// Cliente HTTP con refresh token automatico y sanitizacion de errores
const API_BASE = import.meta.env.VITE_API_URL || '';

let refrescando = false;
let colaReintentos = [];

function obtenerToken() {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}

function obtenerRefreshToken() {
  return localStorage.getItem('refresh_token') || sessionStorage.getItem('refresh_token');
}

function guardarTokens(access, refresh) {
  const storage = localStorage.getItem('token') ? localStorage : sessionStorage;
  storage.setItem('token', access);
  if (refresh) storage.setItem('refresh_token', refresh);
}

function limpiarTokens() {
  localStorage.removeItem('token');
  localStorage.removeItem('refresh_token');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('refresh_token');
}

function sanitizarError(mensaje) {
  if (!mensaje || typeof mensaje !== 'string') return 'Error inesperado. Intenta de nuevo.';
  const patrones = [
    { re: /NoneType.*has no attribute/i, reemplazo: 'Error interno: el sistema recibió datos inesperados. Revisa el archivo e inténtalo de nuevo.' },
    { re: /list.*object.*has no attribute/i, reemplazo: 'Error interno de formato. Verifica que el archivo sea una factura válida.' },
    { re: /string.*indices must be integers/i, reemplazo: 'Error interno al procesar los datos del documento.' },
    { re: /cannot unpack non-iterable/i, reemplazo: 'Error interno: datos incompletos en el archivo.' },
    { re: /'[^']*'.*is not defined|NameError/i, reemplazo: 'Error interno del sistema. Contacta al administrador.' },
  ];
  for (const p of patrones) {
    if (p.re.test(mensaje)) return p.reemplazo;
  }
  return mensaje;
}

function construirHeaders(extra = {}) {
  const cabeceras = { ...extra };
  const token = obtenerToken();
  if (token) {
    cabeceras['Authorization'] = `Bearer ${token}`;
  }
  return cabeceras;
}

async function peticionConReintento(ruta, opciones) {
  let respuesta = await fetch(`${API_BASE}${ruta}`, opciones);

  if (respuesta.status === 401 && obtenerRefreshToken()) {
    if (!refrescando) {
      refrescando = true;
      try {
        const ref = await fetch(`${API_BASE}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: obtenerRefreshToken() }),
        });
        if (ref.ok) {
          const data = await ref.json();
          guardarTokens(data.access_token, data.refresh_token);
          opciones.headers = construirHeaders(opciones.headers['Content-Type'] ? { 'Content-Type': opciones.headers['Content-Type'] } : {});
          respuesta = await fetch(`${API_BASE}${ruta}`, opciones);
        } else {
          limpiarTokens();
          window.location.href = '/login';
          throw new Error('Sesion expirada');
        }
      } catch (e) {
        limpiarTokens();
        window.location.href = '/login';
        throw e;
      } finally {
        refrescando = false;
      }
    } else {
      await new Promise(resolve => setTimeout(resolve, 300));
      respuesta = await fetch(`${API_BASE}${ruta}`, opciones);
    }
  }

  if (!respuesta.ok) {
    const error = await respuesta.json().catch(() => ({}));
    throw new Error(sanitizarError(error.detail) || `Error ${respuesta.status}`);
  }
  return respuesta.json();
}

export async function peticionGet(ruta) {
  return peticionConReintento(ruta, { headers: construirHeaders() });
}

export async function peticionPost(ruta, cuerpo = null) {
  const opciones = {
    method: 'POST',
    headers: construirHeaders(),
  };
  if (cuerpo && !(cuerpo instanceof FormData)) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(cuerpo);
  } else if (cuerpo instanceof FormData) {
    delete opciones.headers['Content-Type'];
    opciones.body = cuerpo;
  }
  return peticionConReintento(ruta, opciones);
}

export async function peticionPut(ruta, cuerpo = {}) {
  return peticionConReintento(ruta, {
    method: 'PUT',
    headers: construirHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(cuerpo),
  });
}

export async function peticionPatch(ruta, cuerpo = {}) {
  return peticionConReintento(ruta, {
    method: 'PATCH',
    headers: construirHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(cuerpo),
  });
}

export async function peticionDelete(ruta) {
  const respuesta = await fetch(`${API_BASE}${ruta}`, {
    method: 'DELETE',
    headers: construirHeaders(),
  });
  if (!respuesta.ok) {
    const error = await respuesta.json().catch(() => ({}));
    throw new Error(sanitizarError(error.detail) || `Error ${respuesta.status}`);
  }
  return respuesta;
}

export async function obtenerCatalogoArancelario() {
  return peticionGet('/api/catalogo/arancel');
}

export { API_BASE, obtenerToken, guardarTokens, limpiarTokens };

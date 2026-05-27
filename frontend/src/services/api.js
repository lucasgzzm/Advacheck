const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

function obtenerToken() {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}

function construirHeaders(extra = {}) {
  const cabeceras = { ...extra };
  const token = obtenerToken();
  if (token) {
    cabeceras['Authorization'] = `Bearer ${token}`;
  }
  return cabeceras;
}

export async function peticionGet(ruta) {
  const respuesta = await fetch(`${API_BASE}${ruta}`, {
    headers: construirHeaders(),
  });
  if (!respuesta.ok) {
    const error = await respuesta.json().catch(() => ({}));
    throw new Error(error.detail || `Error ${respuesta.status}`);
  }
  return respuesta.json();
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
  const respuesta = await fetch(`${API_BASE}${ruta}`, opciones);
  if (!respuesta.ok) {
    const error = await respuesta.json().catch(() => ({}));
    throw new Error(error.detail || `Error ${respuesta.status}`);
  }
  return respuesta.json();
}

export async function peticionPut(ruta, cuerpo = {}) {
  const respuesta = await fetch(`${API_BASE}${ruta}`, {
    method: 'PUT',
    headers: construirHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(cuerpo),
  });
  if (!respuesta.ok) {
    const error = await respuesta.json().catch(() => ({}));
    throw new Error(error.detail || `Error ${respuesta.status}`);
  }
  return respuesta.json();
}

export async function peticionPatch(ruta, cuerpo = {}) {
  const respuesta = await fetch(`${API_BASE}${ruta}`, {
    method: 'PATCH',
    headers: construirHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(cuerpo),
  });
  if (!respuesta.ok) {
    const error = await respuesta.json().catch(() => ({}));
    throw new Error(error.detail || `Error ${respuesta.status}`);
  }
  return respuesta.json();
}

export async function peticionDelete(ruta) {
  const respuesta = await fetch(`${API_BASE}${ruta}`, {
    method: 'DELETE',
    headers: construirHeaders(),
  });
  if (!respuesta.ok) {
    const error = await respuesta.json().catch(() => ({}));
    throw new Error(error.detail || `Error ${respuesta.status}`);
  }
  return respuesta;
}

export { API_BASE, obtenerToken };

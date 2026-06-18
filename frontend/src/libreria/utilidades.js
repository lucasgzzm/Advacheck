// Utilidades de clases condicionales y variables CSS
export function cn(...inputs) {
  return inputs.filter(Boolean).join(' ');
}

export function cssVar(name) {
  return `var(--${name})`;
}

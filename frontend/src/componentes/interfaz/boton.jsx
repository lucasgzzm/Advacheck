import * as React from "react"
import { cn } from "../../libreria/utilidades"

const variantStyles = {
  default: {
    background: 'var(--primary)',
    color: 'white',
    border: '1px solid var(--primary)',
    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
  },
  destructive: {
    background: 'rgba(239, 68, 68, 0.1)',
    color: 'var(--red)',
    border: '1px solid transparent',
  },
  outline: {
    background: 'transparent',
    color: 'var(--text-main)',
    border: '1px solid var(--card-border)',
  },
  secondary: {
    background: 'var(--card-bg)',
    color: 'var(--text-main)',
    border: '1px solid var(--card-border)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-main)',
    border: 'none',
  },
  link: {
    background: 'transparent',
    color: 'var(--primary)',
    border: 'none',
    textDecoration: 'underline',
    textUnderlineOffset: '4px',
  },
}

const sizeStyles = {
  default: { height: '40px', padding: '8px 16px' },
  sm: { height: '36px', padding: '4px 12px' },
  lg: { height: '44px', padding: '10px 32px' },
  icon: { height: '40px', width: '40px', padding: '0' },
}

const Button = React.forwardRef(
  ({ className, variant = "default", size = "default", style, ...props }, ref) => {
    const baseStyles = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      whiteSpace: 'nowrap',
      borderRadius: '10px',
      fontSize: '0.9rem',
      fontWeight: 600,
      fontFamily: 'inherit',
      cursor: 'pointer',
      transition: 'all 0.2s',
      outline: 'none',
    }

    return (
      <button
        className={cn("btn", className)}
        style={{
          ...baseStyles,
          ...variantStyles[variant],
          ...sizeStyles[size],
          ...style,
        }}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }

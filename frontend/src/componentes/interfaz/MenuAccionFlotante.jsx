// Menu de accion flotante con animacion de apertura
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./boton";
import { User, X } from "lucide-react";
import { cn } from "../../libreria/utilidades";

const FloatingActionMenu = ({
  options,
  className,
  title,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const getInitials = (name) => {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div ref={menuRef} className={cn("z-[1100]", className)} style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95, filter: "blur(2px)", x: "-50%" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)", x: "-50%" }}
            exit={{ opacity: 0, y: 15, scale: 0.95, filter: "blur(2px)", x: "-50%" }}
            transition={{
              duration: 0.25,
              type: "spring",
              stiffness: 400,
              damping: 30,
            }}
            style={{ 
              position: 'absolute', 
              bottom: '70px', 
              left: '50%', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '4px', 
              alignItems: 'flex-start', 
              width: '200px',
              zIndex: 10,
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: '14px',
              padding: '6px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
            }}
          >
            {options.map((option, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                transition={{
                  duration: 0.2,
                  delay: index * 0.04,
                }}
                style={{ width: '100%' }}
              >
                <Button
                  onClick={option.onClick}
                  className="flex items-center justify-start gap-3 w-full"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: '12px',
                    color: 'var(--text-main)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    transition: 'all 0.2s',
                    width: '100%',
                    background: 'transparent',
                    border: 'none'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--primary-light)';
                    e.currentTarget.style.color = 'var(--primary)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-main)';
                  }}
                >
                  {option.Icon}
                  <span>{option.label}</span>
                </Button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        onClick={toggleMenu}
        whileHover={{ scale: 1.02, y: -1 }}
        whileTap={{ scale: 0.98 }}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          cursor: 'pointer', 
          padding: '6px 16px 6px 6px', 
          borderRadius: '30px',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--card-border)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
          backdropFilter: 'blur(8px)',
          transition: 'all 0.3s ease',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
          e.currentTarget.style.borderColor = 'rgba(124, 58, 237, 0.2)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
          e.currentTarget.style.borderColor = 'var(--card-border)';
        }}
      >
        <div
          style={{ 
            width: '42px', 
            height: '42px', 
            background: isOpen 
              ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)' 
              : 'linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%)', 
            color: '#fff', 
            borderRadius: '50%', 
            boxShadow: isOpen 
              ? '0 0 12px rgba(239, 68, 68, 0.4)' 
              : '0 4px 12px rgba(124, 58, 237, 0.3)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' 
          }}
        >
          <motion.div
            animate={{ 
              rotate: isOpen ? 180 : 0,
              scale: isOpen ? 0.95 : 1
            }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 20
            }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {isOpen ? <X size={18} /> : <span style={{ fontSize: '0.95rem', fontWeight: 800, letterSpacing: '0.5px' }}>{getInitials(title)}</span>}
          </motion.div>
        </div>
        
        {title && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.85rem', whiteSpace: 'nowrap', userSelect: 'none', lineHeight: 1.1 }}>
              {title}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1.1 }}>
              Sesión Activa
            </span>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default FloatingActionMenu;

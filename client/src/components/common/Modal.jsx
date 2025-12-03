import React, { useEffect } from 'react';
import './modal.css';

export default function Modal({ isOpen, onClose, title, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div className="modal-overlay safe-area-x" onClick={onClose}>
      <div className="modal-card" onClick={(e)=>e.stopPropagation()}>
        {title && <h3 className="modal-title">{title}</h3>}
        <div className="modal-body safe-area-y">{children}</div>
      </div>
    </div>
  );
}

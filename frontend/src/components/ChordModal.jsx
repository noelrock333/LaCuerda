import React, { useEffect } from 'react';
import GuitarChord from './GuitarChord';

export default function ChordModal({ chordName, onClose }) {
  // Escuchar tecla escape para cerrar el modal
  useEffect(() => {
    if (!chordName) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [chordName, onClose]);

  if (!chordName) return null;

  const handleBackdropClick = (e) => {
    if (e.target.classList.contains('chord-modal')) {
      onClose();
    }
  };

  return (
    <div className="chord-modal" onClick={handleBackdropClick}>
      <div className="chord-modal-content">
        <header className="chord-modal-header">
          <span id="chord-modal-title">{chordName}</span>
          <button onClick={onClose} className="chord-close-btn">&times;</button>
        </header>
        <div className="chord-modal-body">
          <GuitarChord chordName={chordName} />
        </div>
      </div>
    </div>
  );
}

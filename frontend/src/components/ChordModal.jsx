import React, { useEffect, useState } from 'react';
import GuitarChord from './GuitarChord';
import { getChordFingerings } from '../utils/chords';
import useUIStore from '../store/useUIStore.js';

export default function ChordModal() {
  const chordName = useUIStore((state) => state.activeChord);
  const onClose = useUIStore((state) => state.closeChordModal);

  const [currentIndex, setCurrentIndex] = useState(0);
  const fingerings = getChordFingerings(chordName);

  // Reiniciar el índice cuando cambia el acorde
  useEffect(() => {
    setCurrentIndex(0);
  }, [chordName]);

  // Escuchar teclado para cerrar y navegar por el carrusel
  useEffect(() => {
    if (!chordName) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && fingerings.length > 1) {
        setCurrentIndex((prev) => (prev === 0 ? fingerings.length - 1 : prev - 1));
      } else if (e.key === 'ArrowRight' && fingerings.length > 1) {
        setCurrentIndex((prev) => (prev === fingerings.length - 1 ? 0 : prev + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [chordName, onClose, fingerings.length]);

  if (!chordName) return null;

  const handleBackdropClick = (e) => {
    if (e.target.classList.contains('chord-modal')) {
      onClose();
    }
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? fingerings.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === fingerings.length - 1 ? 0 : prev + 1));
  };

  const currentFingering = fingerings[currentIndex];

  return (
    <div className="chord-modal" onClick={handleBackdropClick}>
      <div className="chord-modal-content">
        <header className="chord-modal-header">
          <span id="chord-modal-title">{chordName}</span>
          <button onClick={onClose} className="chord-close-btn">&times;</button>
        </header>
        <div className="chord-modal-body">
          <GuitarChord fingering={currentFingering} />
          
          {fingerings.length > 1 && (
            <div className="chord-carousel-controls">
              <button onClick={handlePrev} className="chord-carousel-arrow" aria-label="Anterior">&lt;</button>
              <div className="chord-carousel-dots">
                {fingerings.map((_, index) => (
                  <span
                    key={index}
                    className={`chord-carousel-dot ${index === currentIndex ? 'active' : ''}`}
                    onClick={() => setCurrentIndex(index)}
                    title={`Variación ${index + 1}`}
                  />
                ))}
              </div>
              <button onClick={handleNext} className="chord-carousel-arrow" aria-label="Siguiente">&gt;</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useRef } from 'react';
import { ChordBox } from 'vexchords';
import { getChordFingering } from '../utils/chords';

export default function GuitarChord({ chordName, fingering: propFingering }) {
  const containerRef = useRef(null);
  const fingering = propFingering || getChordFingering(chordName);

  useEffect(() => {
    if (!containerRef.current || !fingering) return;

    // Clear previous SVG content
    containerRef.current.innerHTML = '';

    const { frets, baseFret } = fingering;

    // Convert frets array ['x', 3, 2, 0, 1, 0] to VexChords format
    // index 0 is string 6 (low E), index 5 is string 1 (high E)
    const vexChords = frets.map((fretVal, index) => {
      const stringNum = 6 - index;
      
      if (fretVal === 'x' || fretVal === 'X') {
        return [stringNum, 'x'];
      }
      if (fretVal === 0) {
        return [stringNum, 0];
      }
      
      // Calculate relative fret to the baseFret position
      const relativeFret = fretVal - baseFret + 1;
      return [stringNum, relativeFret];
    });

    // Barre chord detection heuristic:
    // If there are 2 or more strings pressed at the lowest fret (> 0), we can draw a barre
    const activeFretsMap = frets
      .map((f, i) => ({ fret: f, string: 6 - i }))
      .filter(item => typeof item.fret === 'number' && item.fret > 0);

    const barreList = [];
    if (activeFretsMap.length > 0) {
      const lowestFret = Math.min(...activeFretsMap.map(x => x.fret));
      const stringsAtLowestFret = activeFretsMap.filter(x => x.fret === lowestFret);

      if (stringsAtLowestFret.length >= 2) {
        const stringNums = stringsAtLowestFret.map(x => x.string);
        const maxString = Math.max(...stringNums);
        const minString = Math.min(...stringNums);
        
        if (maxString - minString >= 4) {
          barreList.push({
            fromString: maxString,
            toString: minString,
            fret: lowestFret - baseFret + 1
          });
        }
      }
    }

    try {
      const chordBox = new ChordBox(containerRef.current, {
        width: 150,
        height: 180,
      });

      chordBox.draw({
        chord: vexChords,
        position: baseFret,
        barres: barreList,
      });
    } catch (err) {
      console.error('Failed to draw VexChords:', err);
    }
  }, [fingering]);

  if (!fingering) {
    return (
      <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
        <p style={{ fontSize: '14px', fontWeight: 'bold' }}>{chordName}</p>
        <p style={{ fontSize: '12px' }}>Diagrama no disponible</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className="vexchord-container" 
      style={{ display: 'flex', justifyContent: 'center', margin: '0 auto' }} 
    />
  );
}

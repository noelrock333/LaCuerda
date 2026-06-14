import React, { useState, useEffect } from 'react';
import HomeView from './components/HomeView';
import AlphabetView from './components/AlphabetView';
import ArtistView from './components/ArtistView';
import SongView from './components/SongView';
import VersionView from './components/VersionView';
import ChordModal from './components/ChordModal';

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [searchParams, setSearchParams] = useState(window.location.search);
  const [activeChord, setActiveChord] = useState(null);
  const [headerQuery, setHeaderQuery] = useState('');

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
      setSearchParams(window.location.search);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Intercept local link clicks globally for SPA routing
  useEffect(() => {
    const handleGlobalClick = (e) => {
      const link = e.target.closest('a');
      if (link) {
        const href = link.getAttribute('href');
        const target = link.getAttribute('target');

        // Check if it's an internal link
        if (href && href.startsWith('/') && !href.startsWith('//') && target !== '_blank') {
          e.preventDefault();
          window.history.pushState(null, '', href);
          setCurrentPath(window.location.pathname);
          setSearchParams(window.location.search);
          window.scrollTo(0, 0);
        }
      }
    };

    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);

  const navigateToHome = () => {
    window.history.pushState(null, '', '/');
    setCurrentPath('/');
    setSearchParams('');
    setHeaderQuery('');
  };

  const handleHeaderSearchInput = (e) => {
    const value = e.target.value;
    setHeaderQuery(value);
    
    // Redirect to home with search query parameter
    const searchStr = value.trim() ? `?q=${encodeURIComponent(value.trim())}` : '';
    window.history.pushState(null, '', `/${searchStr}`);
    setCurrentPath('/');
    setSearchParams(searchStr);
  };

  // Synchronize header query input with URL parameter
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const q = params.get('q') || '';
    if (currentPath === '/') {
      setHeaderQuery(q);
    }
  }, [currentPath, searchParams]);

  // Routing Logic
  const cleanPath = currentPath.replace(/^\/+/, '').replace(/\/+$/, '');
  const queryParams = new URLSearchParams(searchParams);

  let viewComponent = null;
  let showHeaderSearch = true;

  if (cleanPath === '') {
    // Portada / Home
    showHeaderSearch = false;
    const q = queryParams.get('q') || '';
    viewComponent = <HomeView initialQuery={q} />;
  } else {
    const parts = cleanPath.split('/');
    if (parts.length === 2 && parts[0] === 'letter') {
      const letter = parts[1];
      const page = parseInt(queryParams.get('page') || '1', 10);
      viewComponent = <AlphabetView letter={letter} page={page} />;
    } else if (parts.length === 1) {
      const artistSlug = parts[0];
      viewComponent = <ArtistView artistSlug={artistSlug} />;
    } else if (parts.length === 2) {
      const artistSlug = parts[0];
      const songOrVersionSlug = parts[1];
      
      const isVersion = songOrVersionSlug.endsWith('.shtml') || songOrVersionSlug.match(/-\d+$/);
      if (isVersion) {
        viewComponent = (
          <VersionView
            artistSlug={artistSlug}
            versionSlug={songOrVersionSlug}
            onChordClick={(chord) => setActiveChord(chord)}
          />
        );
      } else {
        viewComponent = <SongView artistSlug={artistSlug} songSlug={songOrVersionSlug} />;
      }
    } else {
      // 404 / Unknown route -> redirect to home
      setTimeout(() => navigateToHome(), 0);
    }
  }

  return (
    <>
      {/* Cabecera de Navegación Fija */}
      <header className="app-header">
        <div className="header-logo" onClick={navigateToHome} style={{ cursor: 'pointer' }}>
          <span className="logo-icon">🎸</span>
          <h1>LaCuerda <span>Offline</span></h1>
        </div>
        {/* Buscador de Cabecera (oculto en la Portada) */}
        <div className={`header-search-container ${showHeaderSearch ? '' : 'hidden'}`}>
          <input
            type="text"
            placeholder="Buscar artista o canción..."
            autoComplete="off"
            value={headerQuery}
            onChange={handleHeaderSearchInput}
          />
          <span className="search-icon">🔍</span>
        </div>
      </header>

      {/* Contenedor Principal de Vistas */}
      <main className="main-content">
        {viewComponent}
      </main>

      {/* Modal de visualización de acorde */}
      <ChordModal
        chordName={activeChord}
        onClose={() => setActiveChord(null)}
      />
    </>
  );
}

export default App;

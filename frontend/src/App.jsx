import React, { useState, useEffect } from 'react';
import Header from './components/layout/Header.jsx';
import HomeView from './views/HomeView.jsx';
import AlphabetView from './views/AlphabetView.jsx';
import ArtistView from './views/ArtistView.jsx';
import SongView from './views/SongView.jsx';
import VersionView from './views/VersionView.jsx';
import CatalogView from './views/CatalogView.jsx';
import FavoritesView from './views/FavoritesView.jsx';
import ChordModal from './components/ChordModal.jsx';
import AuthModal from './components/AuthModal.jsx';
import { useMeQuery } from './hooks/useAuth.js';

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [searchParams, setSearchParams] = useState(window.location.search);

  // Valida e inicializa la sesión activa del usuario al arrancar (si existe token)
  useMeQuery();

  // Escucha cambios de historial (botones de atrás/adelante)
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
      setSearchParams(window.location.search);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Intercepta clicks globales en etiquetas <a> para enrutamiento SPA silencioso
  useEffect(() => {
    const handleGlobalClick = (e) => {
      const link = e.target.closest('a');
      if (link) {
        const href = link.getAttribute('href');
        const target = link.getAttribute('target');

        // Solo intercepta links internos relativos
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

  // Callback para navegación forzada (ej. logo, buscador)
  const handleNavigate = (path, search = '') => {
    setCurrentPath(path);
    setSearchParams(search);
  };

  // Lógica de enrutamiento básica
  const cleanPath = currentPath.replace(/^\/+/, '').replace(/\/+$/, '');
  const queryParams = new URLSearchParams(searchParams);

  let viewComponent = null;
  let showHeaderSearch = true;

  if (cleanPath === '') {
    // Portada / Home
    showHeaderSearch = false;
    const q = queryParams.get('q') || '';
    viewComponent = <HomeView initialQuery={q} />;
  } else if (cleanPath === 'catalog') {
    // Catálogo agrupado por artista
    viewComponent = <CatalogView />;
  } else if (cleanPath === 'favorites') {
    // Favoritos del usuario
    viewComponent = <FavoritesView />;
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
          />
        );
      } else {
        viewComponent = <SongView artistSlug={artistSlug} songSlug={songOrVersionSlug} />;
      }
    } else {
      // 404 / Ruta desconocida -> Redirigir a portada
      setTimeout(() => {
        window.history.pushState(null, '', '/');
        handleNavigate('/', '');
      }, 0);
    }
  }

  // Sincronizar el buscador del header con el parámetro ?q= del URL
  const initialSearchQuery = cleanPath === '' ? queryParams.get('q') || '' : '';

  return (
    <>
      {/* Cabecera de Navegación Fija */}
      <Header
        cleanPath={cleanPath}
        showHeaderSearch={showHeaderSearch}
        initialQuery={initialSearchQuery}
        onNavigate={handleNavigate}
      />

      {/* Contenedor Principal de Vistas */}
      <main className="main-content">
        {viewComponent}
      </main>

      {/* Modal global de visualización de acorde */}
      <ChordModal />

      {/* Modal global de Autenticación */}
      <AuthModal />
    </>
  );
}

export default App;

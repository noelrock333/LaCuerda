import React from 'react';
import { Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import Header from './components/layout/Header.jsx';
import HomeView from './views/HomeView.jsx';
import AlphabetView from './views/AlphabetView.jsx';
import ArtistView from './views/ArtistView.jsx';
import SongView from './views/SongView.jsx';
import VersionView from './views/VersionView.jsx';
import CatalogView from './views/CatalogView.jsx';
import FavoritesView from './views/FavoritesView.jsx';
import ImportFavoritesView from './views/ImportFavoritesView.jsx';
import ChordModal from './components/ChordModal.jsx';
import AuthModal from './components/AuthModal.jsx';
import ImportSongModal from './components/ImportSongModal.jsx';
import { useMeQuery } from './hooks/useAuth.js';

/**
 * Componente intermediario que decide si renderizar VersionView o SongView
 * a partir del segundo segmento de la URL. Necesario porque React Router
 * no hace matching nativo de segmentos con puntos (ej. .shtml).
 */
function ArtistOrSongRoute() {
  const { artistSlug, '*': splat } = useParams();

  // Sin segmento adicional → página del artista
  if (!splat) {
    return <ArtistView artistSlug={artistSlug} />;
  }

  // Con extensión .shtml o sufijo numérico (-N) → versión de la canción
  const isVersion = splat.endsWith('.shtml') || /^.+-\d+$/.test(splat);
  if (isVersion) {
    return <VersionView artistSlug={artistSlug} versionSlug={splat} />;
  }

  // Sin extensión ni sufijo numérico → página de la canción (lista de versiones)
  return <SongView artistSlug={artistSlug} songSlug={splat} />;
}

function App() {
  const location = useLocation();

  // Valida e inicializa la sesión activa del usuario al arrancar (si existe token)
  useMeQuery();

  // Derivar cleanPath desde React Router para el Header
  const cleanPath = location.pathname.replace(/^\/+/, '').replace(/\/+$/, '');

  // Home no muestra el buscador del header
  const showHeaderSearch = cleanPath !== '';

  return (
    <>
      {/* Cabecera de Navegación Fija */}
      <Header
        cleanPath={cleanPath}
        showHeaderSearch={showHeaderSearch}
      />

      {/* Contenedor Principal de Vistas */}
      <main id="main-scroll" className="main-content">
        <Routes>
          {/* Portada */}
          <Route path="/" element={<HomeView />} />

          {/* Catálogo de artistas */}
          <Route path="/catalog" element={<CatalogView />} />

          {/* Favoritos del usuario */}
          <Route path="/favorites" element={<FavoritesView />} />
          <Route path="/favorites/import" element={<ImportFavoritesView />} />

          {/* Índice alfabético: /letter/A, /letter/B, etc. */}
          <Route path="/letter/:letter" element={<AlphabetView />} />

          {/*
           * Ruta catch-all para artista + canción/versión.
           * El wildcard (*) captura todo lo que venga después de /:artistSlug/
           * incluyendo segmentos con puntos (.shtml) que React Router no matchea
           * de forma nativa en rutas con path fijo.
           */}
          <Route path="/:artistSlug/*" element={<ArtistOrSongRoute />} />

          {/* Cualquier ruta desconocida → portada */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Modal global de visualización de acorde */}
      <ChordModal />

      {/* Modal global de Autenticación */}
      <AuthModal />

      {/* Modal global de importación (admin/moderador) */}
      <ImportSongModal />
    </>
  );
}

export default App;

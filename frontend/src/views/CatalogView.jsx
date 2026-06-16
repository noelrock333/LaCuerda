import React, { useState } from 'react';
import { useCatalogQuery } from '../hooks/useSongs.js';

export default function CatalogView() {
  const { data: catalog = [], isLoading, error } = useCatalogQuery();
  const [filterQuery, setFilterQuery] = useState('');

  if (isLoading) {
    return (
      <div className="catalog-loading-container">
        <div className="catalog-loading-spinner"></div>
        <p>Cargando biblioteca local...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="catalog-error-container">
        <span className="catalog-error-icon">⚠️</span>
        <h3>Error al cargar catálogo</h3>
        <p>{error.message}</p>
      </div>
    );
  }

  // Lógica de filtrado local en tiempo real
  const filteredCatalog = catalog.map(artistGroup => {
    const matchedSongs = artistGroup.songs.filter(song =>
      song.title.toLowerCase().includes(filterQuery.toLowerCase())
    );
    
    const isArtistMatch = artistGroup.artist.toLowerCase().includes(filterQuery.toLowerCase());
    
    if (isArtistMatch || matchedSongs.length > 0) {
      return {
        ...artistGroup,
        songs: isArtistMatch ? artistGroup.songs : matchedSongs
      };
    }
    return null;
  }).filter(Boolean);

  const totalArtists = catalog.length;
  const totalSongs = catalog.reduce((acc, curr) => acc + curr.songs.length, 0);

  return (
    <section id="view-catalog" className="view-section">
      <div className="catalog-header">
        <div className="catalog-title-section">
          <h2>Biblioteca <span>Local</span></h2>
          <p>Explora y administra todas tus tablaturas descargadas offline.</p>
        </div>
        
        {/* Tarjetas de estadísticas */}
        <div className="catalog-stats">
          <div className="stat-card">
            <span className="stat-num">{totalArtists}</span>
            <span className="stat-label">Artistas</span>
          </div>
          <div className="stat-card">
            <span className="stat-num">{totalSongs}</span>
            <span className="stat-label">Canciones</span>
          </div>
        </div>
      </div>

      {/* Caja de filtrado */}
      <div className="catalog-filter-box">
        <span className="filter-search-icon">🔍</span>
        <input
          type="text"
          placeholder="Filtrar biblioteca por artista o canción..."
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
        />
        {filterQuery && (
          <button className="clear-filter-btn" onClick={() => setFilterQuery('')}>
            &times;
          </button>
        )}
      </div>

      {filteredCatalog.length === 0 ? (
        <div className="catalog-empty">
          <span className="empty-icon">📂</span>
          <h3>Biblioteca vacía o sin coincidencias</h3>
          <p>Prueba buscando con otros términos o descarga canciones primero.</p>
        </div>
      ) : (
        <div className="catalog-grid">
          {filteredCatalog.map(group => (
            <div key={group.artistSlug} className="artist-catalog-card">
              <header className="artist-catalog-header">
                <h3>{group.artist}</h3>
                <span className="artist-song-count">
                  {group.songs.length} {group.songs.length === 1 ? 'canción' : 'canciones'}
                </span>
              </header>
              <div className="artist-songs-list">
                {group.songs.map(song => (
                  <a
                    key={song.songSlug}
                    href={`/${group.artistSlug}/${song.songSlug}`}
                    className="catalog-song-item"
                  >
                    <div className="song-item-info">
                      <span className="song-item-icon">🎵</span>
                      <span className="song-item-title">{song.title}</span>
                    </div>
                    <span className="song-versions-badge">
                      {song.versionsCount} {song.versionsCount === 1 ? 'ver' : 'vers'}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

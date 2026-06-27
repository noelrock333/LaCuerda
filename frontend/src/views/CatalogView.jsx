import { useState } from 'react';
import { useCatalogQuery } from '../hooks/useSongs.js';

export default function CatalogView() {
  const { data: catalog = [], isLoading, error } = useCatalogQuery();
  const [filterQuery, setFilterQuery] = useState('');

  if (isLoading) {
    return (
      <div className="catalog-loading-container">
        <div className="catalog-loading-spinner" />
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

  const filteredCatalog = catalog.map((artistGroup) => {
    const matchedSongs = artistGroup.songs.filter((song) =>
      song.title.toLowerCase().includes(filterQuery.toLowerCase()),
    );

    const isArtistMatch = artistGroup.artist.toLowerCase().includes(filterQuery.toLowerCase());

    if (isArtistMatch || matchedSongs.length > 0) {
      return {
        ...artistGroup,
        songs: isArtistMatch ? artistGroup.songs : matchedSongs,
      };
    }
    return null;
  }).filter(Boolean);

  const totalArtists = catalog.length;
  const totalSongs = catalog.reduce((acc, curr) => acc + curr.songs.length, 0);

  return (
    <section id="view-catalog" className="view-section view-section--wide">
      <div className="catalog-header">
        <div className="catalog-title-section">
          <h2>Biblioteca <span>Local</span></h2>
          <p>Explora y administra todas tus tablaturas descargadas offline.</p>
          <p className="browse-list-meta">
            {totalArtists} artista{totalArtists !== 1 ? 's' : ''} · {totalSongs} canción{totalSongs !== 1 ? 'es' : ''}
          </p>
        </div>

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

      <div className="catalog-filter-box">
        <span className="filter-search-icon">🔍</span>
        <input
          type="text"
          placeholder="Filtrar biblioteca por artista o canción..."
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
        />
        {filterQuery && (
          <button type="button" className="clear-filter-btn" onClick={() => setFilterQuery('')}>
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
        <div className="catalog-list">
          {filteredCatalog.map((group) => (
            <section key={group.artistSlug} className="catalog-artist-block">
              <header className="catalog-artist-header">
                <a href={`/${group.artistSlug}`} className="catalog-artist-name">
                  {group.artist}
                </a>
                <span className="catalog-artist-count">
                  {group.songs.length} {group.songs.length === 1 ? 'canción' : 'canciones'}
                </span>
              </header>
              <div className="catalog-artist-songs">
                {group.songs.map((song, index) => (
                  <a
                    key={song.songSlug}
                    href={`/${group.artistSlug}/${song.songSlug}`}
                    className="catalog-song-row"
                  >
                    <span className="catalog-song-row-index">{index + 1}</span>
                    <span className="catalog-song-row-title">{song.title}</span>
                    <span className="catalog-song-row-badge">
                      {song.versionsCount} ver.
                    </span>
                    <span className="catalog-song-row-arrow" aria-hidden="true">›</span>
                  </a>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

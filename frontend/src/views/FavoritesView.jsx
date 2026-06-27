import { useState } from 'react';
import useAuthStore from '../store/useAuthStore.js';
import { useFavoritesQuery } from '../hooks/useFavorites.js';

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getTypeMeta(type) {
  if (type === 'tab') return { label: 'Tab', className: 'song-type-tag--tab' };
  if (type === 'bass') return { label: 'Bajo', className: 'song-type-tag--bass' };
  return { label: 'Acordes', className: 'song-type-tag--acordes' };
}

export default function FavoritesView() {
  const token = useAuthStore((state) => state.token);
  const { data: favorites = [], isLoading, error } = useFavoritesQuery();
  const [filterQuery, setFilterQuery] = useState('');
  const [onlyAwesome, setOnlyAwesome] = useState(false);

  if (!token) {
    return (
      <section id="view-favorites" className="view-section view-section--wide">
        <div className="catalog-empty catalog-empty--auth">
          <span className="empty-icon">🔒</span>
          <h3>Acceso restringido</h3>
          <p>Inicia sesión o regístrate para guardar y ver tus versiones favoritas.</p>
        </div>
      </section>
    );
  }

  if (isLoading) {
    return (
      <div className="catalog-loading-container">
        <div className="catalog-loading-spinner" />
        <p>Cargando tus favoritos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="catalog-error-container">
        <span className="catalog-error-icon">⚠️</span>
        <h3>Error al cargar tus favoritos</h3>
        <p>{error.message}</p>
      </div>
    );
  }

  const grouped = {};
  favorites.forEach((ver) => {
    const artistName = ver.artist;
    const artistSlug = slugify(artistName);
    const parts = ver.source_url.split('/');
    const versionSlug = parts[parts.length - 1];

    if (!grouped[artistSlug]) {
      grouped[artistSlug] = {
        artist: artistName,
        artistSlug,
        versions: [],
      };
    }

    grouped[artistSlug].versions.push({
      id: ver.id,
      title: ver.title,
      version_number: ver.version_number,
      type: ver.type,
      versionSlug,
      is_awesome: ver.is_awesome,
    });
  });

  const catalog = Object.values(grouped)
    .map((group) => {
      group.versions.sort((a, b) => a.title.localeCompare(b.title));
      return group;
    })
    .sort((a, b) => a.artist.localeCompare(b.artist));

  const filteredCatalog = catalog
    .map((artistGroup) => {
      const matchedVersions = artistGroup.versions.filter((ver) => {
        const matchesQuery = ver.title.toLowerCase().includes(filterQuery.toLowerCase())
          || artistGroup.artist.toLowerCase().includes(filterQuery.toLowerCase());
        const matchesAwesome = !onlyAwesome || ver.is_awesome;
        return matchesQuery && matchesAwesome;
      });

      if (matchedVersions.length > 0) {
        return { ...artistGroup, versions: matchedVersions };
      }
      return null;
    })
    .filter(Boolean);

  const totalArtists = catalog.length;
  const totalFavorites = favorites.length;

  return (
    <section id="view-favorites" className="view-section view-section--wide">
      <div className="catalog-header">
        <div className="catalog-title-section">
          <h2>Tus Versiones <span>Favoritas</span></h2>
          <p>Tus tablaturas y acordes preferidos guardados para acceso rápido.</p>
          <p className="browse-list-meta">
            {totalArtists} artista{totalArtists !== 1 ? 's' : ''} · {totalFavorites} favorito{totalFavorites !== 1 ? 's' : ''}
          </p>
          <a href="/favorites/import" className="import-fav-from-list-link">
            Importar desde links de lacuerda.net →
          </a>
        </div>

        <div className="catalog-stats">
          <div className="stat-card">
            <span className="stat-num">{totalArtists}</span>
            <span className="stat-label">Artistas</span>
          </div>
          <div className="stat-card">
            <span className="stat-num">{totalFavorites}</span>
            <span className="stat-label">Favoritos</span>
          </div>
        </div>
      </div>

      <div className="catalog-filters-row">
        <div className="catalog-filter-box catalog-filter-box--inline">
          <span className="filter-search-icon">🔍</span>
          <input
            type="text"
            placeholder="Filtrar tus favoritos por artista o canción..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
          {filterQuery && (
            <button type="button" className="clear-filter-btn" onClick={() => setFilterQuery('')}>
              &times;
            </button>
          )}
        </div>

        <label className="catalog-chida-toggle">
          <input
            type="checkbox"
            checked={onlyAwesome}
            onChange={(e) => setOnlyAwesome(e.target.checked)}
          />
          <span>Mostrar solo chidas 🔥</span>
        </label>
      </div>

      {filteredCatalog.length === 0 ? (
        <div className="catalog-empty">
          <span className="empty-icon">❤️</span>
          <h3>No tienes favoritos guardados</h3>
          <p>{filterQuery ? 'Prueba con otros términos.' : 'Explora la biblioteca y presiona el corazón en cualquier tablatura para guardarla.'}</p>
        </div>
      ) : (
        <div className="catalog-list">
          {filteredCatalog.map((group) => (
            <section key={group.artistSlug} className="catalog-artist-block catalog-artist-block--favorites">
              <header className="catalog-artist-header">
                <a href={`/${group.artistSlug}`} className="catalog-artist-name">
                  {group.artist}
                </a>
                <span className="catalog-artist-count">
                  {group.versions.length} {group.versions.length === 1 ? 'favorito' : 'favoritos'}
                </span>
              </header>
              <div className="catalog-artist-songs">
                {group.versions.map((ver, index) => {
                  const typeMeta = getTypeMeta(ver.type);
                  return (
                    <a
                      key={ver.id}
                      href={`/${group.artistSlug}/${ver.versionSlug}`}
                      className="catalog-song-row catalog-song-row--favorites"
                    >
                      <span className="catalog-song-row-index">{index + 1}</span>
                      <span className="catalog-song-row-title">
                        {ver.title}
                        {ver.is_awesome && (
                          <span className="chida-badge-fav" title="Chida (mejor calidad)">🔥 Chida</span>
                        )}
                      </span>
                      <span className={`song-type-tag ${typeMeta.className}`}>{typeMeta.label}</span>
                      <span className="catalog-song-row-badge">v{ver.version_number}</span>
                      <span className="catalog-song-row-arrow" aria-hidden="true">›</span>
                    </a>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

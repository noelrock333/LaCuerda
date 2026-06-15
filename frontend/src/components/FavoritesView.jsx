import React, { useState, useEffect } from 'react';

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export default function FavoritesView() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterQuery, setFilterQuery] = useState('');

  const token = localStorage.getItem('token');

  useEffect(() => {
    async function fetchFavorites() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/favorites', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!res.ok) throw new Error('Error al cargar favoritos');
        const data = await res.json();
        setFavorites(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchFavorites();
  }, [token]);

  if (!token) {
    return (
      <div className="catalog-empty max-w-[500px] mx-auto mt-20 text-center p-8 bg-white rounded-xl shadow-lg border border-gray-100">
        <span className="empty-icon text-5xl">🔒</span>
        <h3 className="text-xl font-bold mt-4 text-gray-900">Acceso Restringido</h3>
        <p className="text-gray-500 mt-2">Inicia sesión o regístrate para poder guardar y ver tus versiones favoritas.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="catalog-loading-container">
        <div className="catalog-loading-spinner"></div>
        <p>Cargando tus favoritos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="catalog-error-container">
        <span className="catalog-error-icon">⚠️</span>
        <h3>Error al cargar tus favoritos</h3>
        <p>{error}</p>
      </div>
    );
  }

  // Agrupar los favoritos por artista en el cliente
  const grouped = {};
  favorites.forEach(ver => {
    const artistName = ver.artist;
    const artistSlug = slugify(artistName);
    const songTitle = ver.title;
    
    const parts = ver.source_url.split('/');
    const lastPart = parts[parts.length - 1];
    const versionSlug = lastPart; // ej. "tu_falta_de_querer-5.shtml"
    
    if (!grouped[artistSlug]) {
      grouped[artistSlug] = {
        artist: artistName,
        artistSlug: artistSlug,
        versions: []
      };
    }

    grouped[artistSlug].versions.push({
      id: ver.id,
      title: songTitle,
      version_number: ver.version_number,
      type: ver.type,
      contributor: ver.contributor,
      versionSlug: versionSlug
    });
  });

  const catalog = Object.values(grouped).map(group => {
    // Ordenar favoritos por título
    group.versions.sort((a, b) => a.title.localeCompare(b.title));
    return group;
  }).sort((a, b) => a.artist.localeCompare(b.artist));

  // Filtrado local
  const filteredCatalog = catalog.map(artistGroup => {
    const matchedVersions = artistGroup.versions.filter(ver =>
      ver.title.toLowerCase().includes(filterQuery.toLowerCase())
    );
    
    const isArtistMatch = artistGroup.artist.toLowerCase().includes(filterQuery.toLowerCase());
    
    if (isArtistMatch || matchedVersions.length > 0) {
      return {
        ...artistGroup,
        versions: isArtistMatch ? artistGroup.versions : matchedVersions
      };
    }
    return null;
  }).filter(Boolean);

  const totalArtists = catalog.length;
  const totalFavorites = favorites.length;

  return (
    <section id="view-catalog" className="view-section">
      <div className="catalog-header">
        <div className="catalog-title-section">
          <h2>Tus Versiones <span>Favoritas</span></h2>
          <p>Tus tablaturas y acordes preferidos guardados para acceso rápido.</p>
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

      <div className="catalog-filter-box">
        <span className="filter-search-icon">🔍</span>
        <input
          type="text"
          placeholder="Filtrar tus favoritos por artista o canción..."
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
          <span className="empty-icon">❤️</span>
          <h3>No tienes favoritos guardados</h3>
          <p>{filterQuery ? 'Prueba con otros términos.' : 'Explora la biblioteca y presiona el corazón en cualquier tablatura para guardarla.'}</p>
        </div>
      ) : (
        <div className="catalog-grid">
          {filteredCatalog.map(group => (
            <div key={group.artistSlug} className="artist-catalog-card border-pink-100 hover:border-pink-300">
              <header className="artist-catalog-header">
                <h3>{group.artist}</h3>
                <span className="artist-song-count text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full text-xs font-semibold">
                  {group.versions.length} {group.versions.length === 1 ? 'favorito' : 'favoritos'}
                </span>
              </header>
              <div className="artist-songs-list">
                {group.versions.map(ver => {
                  let typeIcon = '🎼';
                  let typeLabel = 'Acordes';
                  if (ver.type === 'tab') {
                    typeIcon = '🎸';
                    typeLabel = 'Tab';
                  } else if (ver.type === 'bass') {
                    typeIcon = '🎻';
                    typeLabel = 'Bajo';
                  }

                  return (
                    <a
                      key={ver.id}
                      href={`/${group.artistSlug}/${ver.versionSlug}`}
                      className="catalog-song-item hover:bg-pink-50/30 transition-colors"
                    >
                      <div className="song-item-info">
                        <span className="song-item-icon">{typeIcon}</span>
                        <span className="song-item-title">{ver.title}</span>
                      </div>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-medium">
                        v{ver.version_number}
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

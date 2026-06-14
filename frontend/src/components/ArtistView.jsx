import React, { useState, useEffect } from 'react';

export default function ArtistView({ artistSlug }) {
  const [data, setData] = useState({ artist: '', slug: '', songs: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);

    const fetchArtist = async () => {
      try {
        const response = await fetch(`/api/artists/${artistSlug}`);
        if (!response.ok) throw new Error('Artist not found');
        const json = await response.json();
        
        if (active) {
          setData(json);
          setLoading(false);
          document.title = `Acordes de ${json.artist} - LaCuerda Offline`;
        }
      } catch (err) {
        console.error(err);
        if (active) {
          setError(true);
          setLoading(false);
        }
      }
    };

    fetchArtist();
    return () => { active = false; };
  }, [artistSlug]);

  if (loading) {
    return (
      <section id="view-artist" className="view-section">
        <header className="view-header">
          <div className="breadcrumbs">
            <a href="/">Portada</a> &raquo; <span>Artista</span>
          </div>
          <h2 className="view-title">Cargando Artista...</h2>
        </header>
        <div className="list-loading">Cargando catálogo del artista...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section id="view-artist" className="view-section">
        <header className="view-header">
          <div className="breadcrumbs">
            <a href="/">Portada</a> &raquo; <span>Error</span>
          </div>
          <h2 className="view-title">Error al cargar artista</h2>
        </header>
        <div className="list-empty">No se pudo encontrar el artista en la base de datos local.</div>
      </section>
    );
  }

  const topSongs = data.songs.slice(0, 5);

  return (
    <section id="view-artist" className="view-section">
      <header className="view-header">
        <div className="breadcrumbs">
          <a href="/">Portada</a> &raquo; <span id="artist-breadcrumb-name">{data.artist}</span>
        </div>
        <h2 className="view-title" id="artist-title-name">{data.artist}</h2>
      </header>

      <div className="artist-layout">
        {/* Columna Izquierda: Panel Informativo / Top Canciones */}
        <aside className="artist-sidebar">
          <div className="artist-card-info">
            <div className="artist-avatar">🎵</div>
            <h4 id="artist-card-name">{data.artist}</h4>
            <p>Catálogo local archivado</p>
          </div>
          <div className="artist-top-box">
            <h4>TOP CANCIONES</h4>
            <ul className="artist-top-list" id="artist-top-songs">
              {topSongs.map((song) => (
                <li key={song.slug}>
                  <a href={`/${data.slug}/${song.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    {song.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Columna Derecha: Catálogo de Canciones */}
        <div className="artist-songs-content">
          <h3>Listado de Canciones</h3>
          <div className="songs-grid" id="artist-songs-grid">
            {data.songs.length === 0 ? (
              <div className="list-empty">El catálogo del artista está vacío</div>
            ) : (
              data.songs.map((song) => {
                const firstVersionType = song.versions && song.versions[0] ? song.versions[0].type : 'acordes';
                const typeLabel = firstVersionType === 'tab' ? 'Tablatura' : firstVersionType === 'bass' ? 'Bajo' : 'Acordes';
                return (
                  <a key={song.slug} href={`/${data.slug}/${song.slug}`} className="artist-song-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '16px' }}>🎵</span>
                      <span className="song-card-title">{song.title}</span>
                    </div>
                    <div className="song-card-meta" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span className="tag type-tag">{typeLabel}</span>
                      <span className="version-badges-count">{song.versions.length} versiones</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>➔</span>
                    </div>
                  </a>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

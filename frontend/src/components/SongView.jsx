import React, { useState, useEffect } from 'react';

export default function SongView({ artistSlug, songSlug }) {
  const [data, setData] = useState({ title: '', artist: '', versions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);

    const fetchSong = async () => {
      try {
        const response = await fetch(`/api/songs/${artistSlug}/${songSlug}`);
        if (!response.ok) throw new Error('Song not found');
        const json = await response.json();
        
        if (active) {
          setData(json);
          setLoading(false);
          document.title = `${json.title} de ${json.artist} - LaCuerda Offline`;
        }
      } catch (err) {
        console.error(err);
        if (active) {
          setError(true);
          setLoading(false);
        }
      }
    };

    fetchSong();
    return () => { active = false; };
  }, [artistSlug, songSlug]);

  if (loading) {
    return (
      <section id="view-song" className="view-section">
        <header className="view-header">
          <div className="breadcrumbs">
            <a href="/">Portada</a> &raquo; <a href={`/${artistSlug}`}>Artista</a> &raquo; <span>Canción</span>
          </div>
          <h2 className="view-title">Cargando Canción...</h2>
        </header>
        <div className="list-loading">Cargando versiones disponibles...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section id="view-song" className="view-section">
        <header className="view-header">
          <div className="breadcrumbs">
            <a href="/">Portada</a> &raquo; <a href={`/${artistSlug}`}>Artista</a> &raquo; <span>Error</span>
          </div>
          <h2 className="view-title">Error al cargar canción</h2>
        </header>
        <div className="list-empty">No se pudo encontrar el catálogo de la canción.</div>
      </section>
    );
  }

  return (
    <section id="view-song" className="view-section">
      <header className="view-header">
        <div className="breadcrumbs">
          <a href="/">Portada</a> &raquo;{' '}
          <a href={`/${artistSlug}`}>{data.artist}</a> &raquo;{' '}
          <span>{data.title}</span>
        </div>
        <h2 className="view-title" id="song-view-title">{data.title}</h2>
        <h3 className="view-subtitle" id="song-view-artist">
          por <a href={`/${artistSlug}`}>{data.artist}</a>
        </h3>
      </header>

      <div className="versions-grid-container">
        <h3>Versiones disponibles en el catálogo local:</h3>
        <div className="versions-preview-grid" id="song-versions-grid">
          {data.versions.length === 0 ? (
            <div className="list-empty">No hay versiones locales guardadas</div>
          ) : (
            data.versions.map((ver) => {
              // Obtener nombre del archivo de la versión para el link
              const urlParts = ver.source_url.split('/');
              const filename = urlParts[urlParts.length - 1];

              // Determinar icono y título legible según tipo
              let typeLabel = 'Letra y Acordes';
              let typeIcon = '🎼';
              if (ver.type === 'tab') {
                typeLabel = 'Tablatura';
                typeIcon = '🎸';
              } else if (ver.type === 'bass') {
                typeLabel = 'Tab p/Bajo';
                typeIcon = '🎻';
              }

              // Simular calidad de 3 a 5 estrellas para barras
              const numBars = 3 + (ver.id % 3);
              const bars = Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={i}
                  className={`rating-bar ${i < numBars ? 'active' : ''}`}
                />
              ));

              return (
                <a
                  key={ver.id}
                  href={`/${artistSlug}/${filename}`}
                  className="version-preview-card"
                >
                  <div className="version-card-header">
                    <div className="version-card-title-container">
                      <span className="version-card-icon">{typeIcon}</span>
                      <span className="version-card-title">{typeLabel}</span>
                    </div>
                    <div className="version-card-badge-container">
                      {ver.is_best ? (
                        <span className="best-version-badge">mejor versión ✓</span>
                      ) : (
                        <div className="rating-bars">{bars}</div>
                      )}
                    </div>
                  </div>
                  <div className="version-card-body">
                    <pre className="version-card-preview-text">
                      {ver.content || 'Sin vista previa disponible.'}
                    </pre>
                  </div>
                  <div className="version-card-footer">
                    <span className="version-card-contributor">
                      Colaborador: <strong>{ver.contributor || 'Colaborador'}</strong>
                    </span>
                    <span className="version-card-number">Versión {ver.version_number}</span>
                  </div>
                </a>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

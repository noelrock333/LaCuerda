import React, { useEffect } from 'react';
import { useSongDetailQuery } from '../hooks/useSongs.js';

export default function SongView({ artistSlug, songSlug }) {
  const { data = { title: '', artist: '', versions: [] }, isLoading, error } = useSongDetailQuery(artistSlug, songSlug);

  useEffect(() => {
    if (data.title && data.artist) {
      document.title = `${data.title} de ${data.artist} - LaCuerda Offline`;
    }
  }, [data.title, data.artist]);

  if (isLoading) {
    return (
      <section id="view-song" className="view-section">
        <header className="view-header">
          <div className="breadcrumbs">
            <a href="/">Portada</a> &raquo; <a href={`/${artistSlug}`}>Artista</a> &raquo; <span>Canción</span>
          </div>
          <h2 className="view-title">Cargando canción...</h2>
        </header>
        <div className="list-loading auto-import-loading">
          No está en el catálogo local. Buscando en LaCuerda.net...
        </div>
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
          <h2 className="view-title">Canción no disponible</h2>
        </header>
        <div className="list-empty">{error.message || 'No se pudo encontrar el catálogo de la canción.'}</div>
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
              const urlParts = ver.source_url.split('/');
              const filename = urlParts[urlParts.length - 1];

              let typeLabel = 'Letra y Acordes';
              let typeIcon = '🎼';
              if (ver.type === 'tab') {
                typeLabel = 'Tablatura';
                typeIcon = '🎸';
              } else if (ver.type === 'bass') {
                typeLabel = 'Tab p/Bajo';
                typeIcon = '🎻';
              }

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

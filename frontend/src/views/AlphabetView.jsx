import React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useArtistsByLetterQuery } from '../hooks/useSongs.js';

export default function AlphabetView() {
  const { letter } = useParams();
  const [searchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1', 10);

  const { data = { artists: [], page: 1, total: 0, totalPages: 0 }, isLoading, error } = useArtistsByLetterQuery(letter, page);

  if (isLoading) {
    return (
      <section id="view-alphabet" className="view-section">
        <header className="view-header">
          <div className="breadcrumbs">
            <a href="/">Portada</a> &raquo; Artistas empezando con <span>{letter}</span>
          </div>
          <h2 className="view-title">Artistas: <span>{letter}</span></h2>
        </header>
        <div className="list-loading">Cargando artistas...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section id="view-alphabet" className="view-section">
        <header className="view-header">
          <div className="breadcrumbs">
            <a href="/">Portada</a> &raquo; Artistas empezando con <span>{letter}</span>
          </div>
          <h2 className="view-title">Artistas: <span>{letter}</span></h2>
        </header>
        <div className="list-empty">Error al cargar la lista de artistas. {error.message}</div>
      </section>
    );
  }

  return (
    <section id="view-alphabet" className="view-section">
      <header className="view-header">
        <div className="breadcrumbs">
          <a href="/">Portada</a> &raquo; Artistas empezando con <span>{letter}</span>
        </div>
        <h2 className="view-title">Artistas: <span>{letter}</span></h2>
      </header>

      <div className="alphabet-layout">
        <div className="artists-index-container">
          <div className="artists-index-grid" id="alphabet-artists-grid">
            {data.artists.length === 0 ? (
              <div className="list-empty">No se encontraron artistas con esta letra</div>
            ) : (
              data.artists.map(art => (
                <a key={art.slug} href={`/${art.slug}`} className="artist-index-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className="artist-index-icon">👤</span>
                    <span className="artist-index-name">{art.name}</span>
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>➔</span>
                </a>
              ))
            )}
          </div>
        </div>

        {data.totalPages > 1 && (
          <div className="pagination-container" id="alphabet-pagination">
            <a
              href={`/letter/${letter}?page=${page - 1}`}
              className={`pagination-btn ${page <= 1 ? 'disabled' : ''}`}
            >
              &laquo; Anterior
            </a>
            
            <span className="pagination-info">
              Página {data.page} de {data.totalPages}
            </span>
            
            <a
              href={`/letter/${letter}?page=${page + 1}`}
              className={`pagination-btn ${page >= data.totalPages ? 'disabled' : ''}`}
            >
              Siguiente &raquo;
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

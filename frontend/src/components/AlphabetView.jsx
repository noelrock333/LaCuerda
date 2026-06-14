import React, { useState, useEffect } from 'react';

export default function AlphabetView({ letter, page }) {
  const [data, setData] = useState({ artists: [], page: 1, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);

    const fetchData = async () => {
      try {
        const response = await fetch(`/api/artists/by-letter/${letter}?page=${page}`);
        if (!response.ok) throw new Error('Failed to load alphabetical artists');
        const json = await response.json();
        
        if (active) {
          setData(json);
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        if (active) {
          setError(true);
          setLoading(false);
        }
      }
    };

    fetchData();
    return () => { active = false; };
  }, [letter, page]);

  if (loading) {
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
        <div className="list-empty">Error al cargar la lista de artistas.</div>
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

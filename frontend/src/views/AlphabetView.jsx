import { useParams, useSearchParams } from 'react-router-dom';
import { useArtistsByLetterQuery } from '../hooks/useSongs.js';

const ALPHABET_LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'Ñ', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '0-9'
];

function AlphabetSidebar({ letter, total }) {
  return (
    <aside className="alphabet-sidebar">
      <div className="alphabet-sidebar-header">
        <span className="alphabet-sidebar-title">Índice</span>
        {total != null && (
          <span className="alphabet-sidebar-count">{total} artistas</span>
        )}
      </div>
      <nav className="alphabet-sidebar-links" aria-label="Índice alfabético">
        {ALPHABET_LETTERS.map((item) => (
          <a
            key={item}
            href={`/letter/${item}`}
            className={item === letter ? 'active' : ''}
            aria-current={item === letter ? 'page' : undefined}
          >
            {item}
          </a>
        ))}
      </nav>
    </aside>
  );
}

function AlphabetViewShell({ letter, total, children }) {
  return (
    <section id="view-alphabet" className="view-section view-section--wide">
      <header className="view-header">
        <div className="breadcrumbs">
          <a href="/">Portada</a> &raquo; Artistas empezando con <span>{letter}</span>
        </div>
        <h2 className="view-title">Artistas: <span>{letter}</span></h2>
      </header>

      <div className="alphabet-layout">
        <AlphabetSidebar letter={letter} total={total} />
        <div className="alphabet-main">{children}</div>
      </div>
    </section>
  );
}

export default function AlphabetView() {
  const { letter } = useParams();
  const [searchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1', 10);

  const { data = { artists: [], page: 1, limit: 50, total: 0, totalPages: 0 }, isLoading, error } = useArtistsByLetterQuery(letter, page);

  if (isLoading) {
    return (
      <AlphabetViewShell letter={letter}>
        <div className="list-loading">Cargando artistas...</div>
      </AlphabetViewShell>
    );
  }

  if (error) {
    return (
      <AlphabetViewShell letter={letter}>
        <div className="list-empty">Error al cargar la lista de artistas. {error.message}</div>
      </AlphabetViewShell>
    );
  }

  return (
    <AlphabetViewShell letter={letter} total={data.total}>
      <div className="artists-index-container">
        {data.artists.length === 0 ? (
          <div className="list-empty">No se encontraron artistas con esta letra</div>
        ) : (
          <div className="artists-index-table" id="alphabet-artists-grid">
            <div className="artists-index-table-header">
              <span className="artists-index-col-name">Artista</span>
              <span className="artists-index-col-meta">
                Página {data.page} de {data.totalPages || 1}
              </span>
            </div>
            <div className="artists-index-table-body">
              {data.artists.map((art, index) => (
                <a
                  key={art.slug}
                  href={`/${art.slug}`}
                  className="artists-index-row"
                >
                  <span className="artists-index-row-index">
                    {(page - 1) * data.limit + index + 1}
                  </span>
                  <span className="artist-index-name">{art.name}</span>
                  <span className="artists-index-row-arrow" aria-hidden="true">›</span>
                </a>
              ))}
            </div>
          </div>
        )}
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
    </AlphabetViewShell>
  );
}

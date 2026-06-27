import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore.js';
import { useImportFavoritesMutation } from '../hooks/useFavorites.js';

const STATUS_LABELS = {
  added: { label: 'Agregado', icon: '✅' },
  already_exists: { label: 'Ya existía', icon: '♻️' },
  skipped: { label: 'Omitido', icon: '⏭️' },
  not_found: { label: 'No encontrado', icon: '❌' },
  error: { label: 'Error', icon: '⚠️' }
};

function SummaryCard({ label, value, highlight }) {
  return (
    <div className={`import-fav-stat-card ${highlight ? 'highlight' : ''}`}>
      <span className="import-fav-stat-num">{value}</span>
      <span className="import-fav-stat-label">{label}</span>
    </div>
  );
}

export default function ImportFavoritesView() {
  const token = useAuthStore((state) => state.token);
  const importMutation = useImportFavoritesMutation();

  const [text, setText] = useState('');
  const [result, setResult] = useState(null);

  if (!token) {
    return (
      <div className="catalog-empty max-w-[500px] mx-auto mt-20 text-center p-8 bg-white rounded-xl shadow-lg border border-gray-100">
        <span className="empty-icon text-5xl">🔒</span>
        <h3 className="text-xl font-bold mt-4 text-gray-900">Acceso Restringido</h3>
        <p className="text-gray-500 mt-2">Inicia sesión para importar tus favoritos desde links de la página antigua.</p>
      </div>
    );
  }

  const handleImport = () => {
    if (!text.trim()) return;

    setResult(null);
    importMutation.mutate(text, {
      onSuccess: (data) => setResult(data)
    });
  };

  return (
    <section id="view-import-favorites" className="view-section import-favorites-view">
      <div className="catalog-header">
        <div className="catalog-title-section">
          <h2>Importar <span>Favoritos</span></h2>
          <p>
            Pega tu lista de enlaces de <code>acordes.lacuerda.net</code> (terminando en <code>.shtml</code>).
            Las líneas con <code>(chida)</code> se marcarán como chidas 🔥.
          </p>
        </div>
        <div className="import-fav-nav">
          <Link to="/favorites" className="import-fav-back-link">← Volver a favoritos</Link>
        </div>
      </div>

      <div className="import-fav-input-card">
        <textarea
          className="import-fav-textarea"
          placeholder={`Pega aquí tus links...\nhttps://acordes.lacuerda.net/artista/cancion-1.shtml\nhttps://acordes.lacuerda.net/artista/otra.shtml (chida)`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={14}
          disabled={importMutation.isPending}
        />
      </div>

      <div className="import-fav-actions">
        <button
          type="button"
          className="import-fav-submit-btn"
          onClick={handleImport}
          disabled={importMutation.isPending || !text.trim()}
        >
          {importMutation.isPending ? 'Importando favoritos…' : 'Importar favoritos'}
        </button>
      </div>

      {importMutation.isPending && (
        <div className="catalog-loading-container">
          <div className="catalog-loading-spinner"></div>
          <p>Esto puede tardar si hay canciones que descargar.</p>
        </div>
      )}

      {importMutation.isError && (
        <div className="catalog-error-container">
          <span className="catalog-error-icon">⚠️</span>
          <h3>Error al importar</h3>
          <p>{importMutation.error?.message || 'Ocurrió un error inesperado'}</p>
        </div>
      )}

      {result && !importMutation.isPending && (
        <div className="import-fav-results">
          <h3 className="import-fav-results-title">Resultado de la importación</h3>

          <div className="import-fav-summary-grid">
            <SummaryCard label="Total" value={result.summary.total} />
            <SummaryCard label="Agregados" value={result.summary.added} highlight />
            <SummaryCard label="Ya existían" value={result.summary.already_exists} />
            <SummaryCard label="Omitidos" value={result.summary.skipped} />
            <SummaryCard label="No encontrados" value={result.summary.not_found} />
            <SummaryCard label="Chidas 🔥" value={result.summary.chidas} highlight />
          </div>

          <div className="import-fav-results-table-wrap">
            <table className="import-fav-results-table">
              <thead>
                <tr>
                  <th>Línea</th>
                  <th>Estado</th>
                  <th>URL / Canción</th>
                </tr>
              </thead>
              <tbody>
                {result.results?.map((row, idx) => {
                  const statusInfo = STATUS_LABELS[row.status] || STATUS_LABELS.error;
                  return (
                    <tr key={`${row.line}-${idx}`} className={`import-fav-row-${row.status}`}>
                      <td>{row.line}</td>
                      <td>
                        <span className="import-fav-status-badge">
                          {statusInfo.icon} {statusInfo.label}
                          {row.is_chida && <span className="chida-badge-fav">🔥</span>}
                        </span>
                      </td>
                      <td>
                        {row.song ? (
                          <a href={`/${row.song.artistSlug}/${row.song.versionSlug}`}>
                            {row.song.artist} — {row.song.title} (v{row.song.version_number})
                          </a>
                        ) : (
                          <span className="import-fav-url-cell" title={row.message}>
                            {row.url || '—'}
                            {row.message && <small>{row.message}</small>}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

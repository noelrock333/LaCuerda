import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import useUIStore from '../store/useUIStore.js';
import { useImportSongMutation } from '../hooks/useSongs.js';

export default function ImportSongModal() {
  const isOpen = useUIStore((state) => state.isImportModalOpen);
  const setImportModalOpen = useUIStore((state) => state.setImportModalOpen);
  const importMutation = useImportSongMutation();

  const [url, setUrl] = useState('');
  const [downloadAllVersions, setDownloadAllVersions] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const handleClose = () => {
    setImportModalOpen(false);
    setUrl('');
    setDownloadAllVersions(false);
    setError('');
    setResult(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setResult(null);

    importMutation.mutate(
      { url: url.trim(), downloadAllVersions },
      {
        onSuccess: (data) => {
          setResult(data);
        },
        onError: (err) => {
          setError(err.message || 'No se pudo importar la canción');
        }
      }
    );
  };

  const loading = importMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="auth-modal-content">
        <DialogHeader className="auth-modal-header">
          <DialogTitle className="auth-modal-title">
            Importar canción
          </DialogTitle>
          <DialogDescription className="auth-modal-description">
            Pega un enlace de LaCuerda.net para agregar o actualizar en la biblioteca
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="auth-modal-error">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="import-modal-result">
            <p className="import-modal-summary">
              {result.summary.created > 0 && `${result.summary.created} nueva(s)`}
              {result.summary.created > 0 && result.summary.updated > 0 && ', '}
              {result.summary.updated > 0 && `${result.summary.updated} actualizada(s)`}
              {result.summary.failed > 0 && ` · ${result.summary.failed} error(es)`}
            </p>
            {result.imported.length > 0 && (
              <ul className="import-modal-links">
                {result.imported.map((item) => (
                  <li key={item.source_url}>
                    <a href={`/${item.artistSlug}/${item.versionSlug}`}>
                      {item.artist} — {item.title} (v{item.version_number})
                      {item.action === 'updated' ? ' · actualizada' : ''}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-modal-form">
          <div className="auth-input-group">
            <label className="auth-input-label">URL de LaCuerda.net</label>
            <input
              type="url"
              required
              disabled={loading}
              placeholder="https://acordes.lacuerda.net/artista/cancion.shtml"
              className="auth-input-field"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>

          <label className="import-modal-checkbox">
            <input
              type="checkbox"
              checked={downloadAllVersions}
              onChange={(e) => setDownloadAllVersions(e.target.checked)}
              disabled={loading}
            />
            <span>Descargar todas las versiones</span>
          </label>

          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="auth-submit-btn"
          >
            {loading ? (
              <span className="auth-spinner"></span>
            ) : (
              'Importar'
            )}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

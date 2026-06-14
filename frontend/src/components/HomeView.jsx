import React, { useState, useEffect, useRef } from 'react';

const ALPHABET_LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'Ñ', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '0-9'
];

export default function HomeView({ initialQuery = '' }) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState({ artists: [], songs: [] });
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef(null);

  const performSearch = async (val) => {
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(val.trim())}`);
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      setResults(data);
      setShowResults(true);
    } catch (err) {
      console.error("Search query error:", err);
    }
  };

  // React to initialQuery updates from parent/URL
  useEffect(() => {
    setQuery(initialQuery);
    if (initialQuery.trim().length >= 2) {
      performSearch(initialQuery);
    } else {
      setShowResults(false);
    }
  }, [initialQuery]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setQuery(val);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (val.trim().length < 2) {
      setShowResults(false);
      window.history.replaceState(null, '', '/');
      return;
    }

    // Update search parameter silently
    window.history.replaceState(null, '', `/?q=${encodeURIComponent(val.trim())}`);

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(val);
    }, 250);
  };

  // Helper to get slugify client side
  const getArtistSlug = (artistName) => {
    return artistName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  };

  // Helper to extract song slug from url
  const getSongSlugFromUrl = (url) => {
    const parts = url.split('/');
    const lastPart = parts[parts.length - 1];
    return lastPart.replace(/-\d+\.shtml$/, '').replace(/\.shtml$/, '');
  };

  return (
    <section id="view-home" className="view-section">
      <div className="home-hero">
        <div className="hero-logo">🎸</div>
        <h2>LaCuerda <span>Offline Archive</span></h2>
        <p>Busca acordes y tablaturas archivadas de tus artistas favoritos en español.</p>
        
        <div className="hero-search-box">
          <input
            type="text"
            id="home-search-input"
            placeholder="Escribe un artista o canción..."
            autoComplete="off"
            autoFocus
            value={query}
            onChange={handleSearchChange}
          />
          <span className="search-btn-icon">🔍</span>
        </div>

        <div className="alphabet-nav">
          <span className="alphabet-nav-title">Índice Alfabético</span>
          <div className="alphabet-links">
            {ALPHABET_LETTERS.map(letter => (
              <a key={letter} href={`/letter/${letter}`}>
                {letter}
              </a>
            ))}
          </div>
        </div>
      </div>

      {showResults && (
        <div className="home-search-results" id="home-search-results">
          {/* Columna de Artistas */}
          <div className="results-column">
            <h3>Artistas Coincidentes</h3>
            <div className="results-list" id="home-artists-list">
              {results.artists.length === 0 ? (
                <div className="list-empty">Sin artistas coincidentes</div>
              ) : (
                results.artists.map(art => (
                  <a key={art.slug} href={`/${art.slug}`} className="result-item">
                    <span>{art.name}</span>
                    <span className="result-item-sub">Artista ➔</span>
                  </a>
                ))
              )}
            </div>
          </div>

          {/* Columna de Canciones */}
          <div className="results-column">
            <h3>Canciones Coincidentes</h3>
            <div className="results-list" id="home-songs-list">
              {results.songs.length === 0 ? (
                <div className="list-empty">Sin canciones coincidentes</div>
              ) : (
                results.songs.map(song => {
                  const artistSlug = getArtistSlug(song.artist);
                  const songSlug = getSongSlugFromUrl(song.source_url);
                  return (
                    <a key={song.id} href={`/${artistSlug}/${songSlug}`} className="result-item">
                      <div>
                        <strong>{song.title}</strong>
                        <div className="result-item-sub">{song.artist}</div>
                      </div>
                      <span className="result-item-sub">➔</span>
                    </a>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

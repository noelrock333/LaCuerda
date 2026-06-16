import React, { useState, useEffect, useRef } from 'react';
import GuitarChord from './GuitarChord';
import { Maximize2, Minimize2, Printer, FileText, Heart, Pencil } from 'lucide-react';

const HISTORY_KEY = 'lacuerda_view_history';

function getHistory() {
  try {
    const data = localStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function addToHistory(item) {
  try {
    let history = getHistory();
    history = history.filter((h) => h.id !== item.id);
    history.unshift(item);
    if (history.length > 20) {
      history = history.slice(0, 20);
    }
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.error('Failed to save history', e);
  }
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function highlightChords(content, chordsStr) {
  if (!chordsStr) return escapeHtml(content);

  const chordList = chordsStr.split(/\s+/).filter((c) => c.length > 0);
  if (chordList.length === 0) return escapeHtml(content);

  // Sort by length descending to avoid partial matches
  chordList.sort((a, b) => b.length - a.length);

  const escapedChords = chordList.map((c) =>
    c.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
  );

  const lines = content.split('\n');
  const highlightedLines = lines.map((line) => {
    // lines representing strings/tabs: contains | or --
    if (line.includes('|') || line.includes('--')) {
      return `<em>${escapeHtml(line)}</em>`;
    }

    let escapedLine = escapeHtml(line);
    const pattern = new RegExp(
      `(?<=^|\\s|[-|/])(${escapedChords.join('|')})(?=$|\\s|[-|/])`,
      'g'
    );
    return escapedLine.replace(pattern, '<a>$1</a>');
  });

  return highlightedLines.join('\n');
}

export default function VersionView({ artistSlug, versionSlug, onChordClick, onAuthRequired, currentUser }) {
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Estados para modo edición
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editComposers, setEditComposers] = useState('');
  const [editAlbum, setEditAlbum] = useState('');
  const [editYear, setEditYear] = useState('');
  const [editChords, setEditChords] = useState('');
  const [editContent, setEditContent] = useState('');

  // Sidebar states
  const [versionsList, setVersionsList] = useState([]);
  const [artistSongs, setArtistSongs] = useState([]);
  const [historyList, setHistoryList] = useState([]);
  const [activeTab, setActiveTab] = useState('versions'); // 'versions' | 'artist' | 'history'
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Autoscroll states
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(3);
  const scrollIntervalRef = useRef(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    setIsScrolling(false);

    const fetchVersion = async () => {
      try {
        const response = await fetch(`/api/version/${artistSlug}/${versionSlug}`);
        if (!response.ok) throw new Error('Version not found');
        const json = await response.json();

        if (active) {
          setSong(json);
          setLoading(false);
          document.title = `${json.title} (v${json.version_number}) - ${json.artist}`;

          // Consultar estado de favorito si está autenticado
          const token = localStorage.getItem('token');
          if (token && json.id) {
            fetch(`/api/favorites/status/${json.id}`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            })
              .then(res => res.ok ? res.json() : { isFavorite: false })
              .then(data => {
                if (active) setIsFavorite(data.isFavorite);
              })
              .catch(err => console.error(err));
          }

          const songBaseSlug = getSongSlugFromUrl(json.source_url);

          // Add to history
          addToHistory({
            id: `${artistSlug}-${songBaseSlug}-${json.version_number}`,
            artist: json.artist,
            title: json.title,
            version_number: json.version_number,
            type: json.type,
            artistSlug,
            versionSlug
          });
          setHistoryList(getHistory());

          // Fetch other versions
          fetch(`/api/songs/${artistSlug}/${songBaseSlug}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (data && active) {
                setVersionsList(data.versions || []);
              }
            })
            .catch((err) => console.error('Error fetching alternative versions:', err));

          // Fetch artist's other songs
          fetch(`/api/artists/${artistSlug}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (data && active) {
                setArtistSongs(data.songs || []);
              }
            })
            .catch((err) => console.error('Error fetching artist songs:', err));
        }
      } catch (err) {
        console.error(err);
        if (active) {
          setError(true);
          setLoading(false);
        }
      }
    };

    fetchVersion();
    return () => {
      active = false;
    };
  }, [artistSlug, versionSlug]);

  // Autoscroll animation effect
  useEffect(() => {
    if (!isScrolling) return;

    let active = true;
    const scrollContainer = document.querySelector('.main-content');
    if (!scrollContainer) return;

    // Use a float accumulator initialized to the current scroll position
    let scrollAccumulator = scrollContainer.scrollTop;

    const scrollStep = () => {
      if (!active) return;

      // Sync accumulator if manual scrolling happened during autoscroll
      if (Math.abs(scrollContainer.scrollTop - Math.round(scrollAccumulator)) > 1) {
        scrollAccumulator = scrollContainer.scrollTop;
      }

      const pxPerFrame = scrollSpeed * 0.08;
      scrollAccumulator += pxPerFrame;
      scrollContainer.scrollTop = Math.round(scrollAccumulator);

      const reachedBottom =
        scrollContainer.scrollHeight - scrollContainer.clientHeight <=
        scrollContainer.scrollTop + 1;

      if (reachedBottom) {
        setIsScrolling(false);
        return;
      }

      scrollIntervalRef.current = requestAnimationFrame(scrollStep);
    };

    scrollIntervalRef.current = requestAnimationFrame(scrollStep);

    return () => {
      active = false;
      if (scrollIntervalRef.current) {
        cancelAnimationFrame(scrollIntervalRef.current);
      }
    };
  }, [isScrolling, scrollSpeed]);

  const toggleAutoscroll = () => {
    setIsScrolling((prev) => !prev);
  };

  useEffect(() => {
    if (song) {
      setEditTitle(song.title || '');
      setEditArtist(song.artist || '');
      setEditComposers(song.composers || '');
      setEditAlbum(song.album || '');
      setEditYear(song.year || '');
      setEditChords(song.chords || '');
      setEditContent(song.content || '');
    }
  }, [song]);

  const handleSaveChanges = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`/api/version/${song.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: editTitle,
          artist: editArtist,
          composers: editComposers,
          album: editAlbum,
          year: editYear ? parseInt(editYear, 10) : null,
          chords: editChords,
          content: editContent
        })
      });

      if (res.ok) {
        setSong(prev => ({
          ...prev,
          title: editTitle,
          artist: editArtist,
          composers: editComposers,
          album: editAlbum,
          year: editYear ? parseInt(editYear, 10) : null,
          chords: editChords,
          content: editContent
        }));
        setIsEditing(false);
      } else {
        const errorData = await res.json();
        alert(`Error al guardar: ${errorData.error || 'Intenta de nuevo'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión al guardar los cambios.');
    }
  };

  const handleTabClick = (e) => {
    if (e.target.tagName === 'A') {
      e.preventDefault();
      if (onChordClick) {
        onChordClick(e.target.textContent);
      }
    }
  };

  // Helper to extract song slug from url for the breadcrumb
  const getSongSlugFromUrl = (url) => {
    if (!url) return '';
    const parts = url.split('/');
    const lastPart = parts[parts.length - 1];
    return lastPart.replace(/-\d+\.shtml$/, '').replace(/\.shtml$/, '');
  };

  if (loading) {
    return (
      <section id="view-version" className="view-section">
        <header className="view-header">
          <div className="breadcrumbs">
            <a href="/">Portada</a> &raquo; <span>Cargando...</span>
          </div>
          <h2 className="view-title">Cargando Acordes...</h2>
        </header>
        <div className="list-loading">Cargando tablatura...</div>
      </section>
    );
  }

  if (error || !song) {
    return (
      <section id="view-version" className="view-section">
        <header className="view-header">
          <div className="breadcrumbs">
            <a href="/">Portada</a> &raquo; <span>Error</span>
          </div>
          <h2 className="view-title">Error al cargar tablatura</h2>
        </header>
        <div className="list-empty">No se pudo descargar o localizar la versión clásica especificada.</div>
      </section>
    );
  }

  const toggleFavorite = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      if (onAuthRequired) {
        onAuthRequired();
      }
      return;
    }
    if (!song) return;

    const method = isFavorite ? 'DELETE' : 'POST';
    const url = isFavorite ? `/api/favorites/${song.id}` : '/api/favorites';

    const headers = {
      'Authorization': `Bearer ${token}`
    };

    let body;
    if (!isFavorite) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({ song_id: song.id });
    }

    try {
      const res = await fetch(url, {
        method,
        headers,
        body
      });

      if (res.ok) {
        setIsFavorite(!isFavorite);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const songBaseSlug = getSongSlugFromUrl(song.source_url);
  const chordList = song.chords
    ? song.chords.split(/\s+/).filter((c) => c.length > 0)
    : [];

  const highlightedHtml = highlightChords(song.content, song.chords);

  return (
    <div className={`version-page-layout ${isExpanded ? 'expanded' : ''}`}>
      {/* Botón de toggle para móviles */}
      <button
        className="sidebar-toggle-btn"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        <span>📂</span> {isSidebarOpen ? 'Ocultar Menú' : 'Mostrar Menú / Versiones'}
      </button>

      {/* Barra lateral izquierda */}
      <aside className={`version-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <nav className="sidebar-tabs">
          <button
            className={`sidebar-tab-btn ${activeTab === 'versions' ? 'active' : ''}`}
            onClick={() => setActiveTab('versions')}
          >
            Versiones
          </button>
          <button
            className={`sidebar-tab-btn ${activeTab === 'artist' ? 'active' : ''}`}
            onClick={() => setActiveTab('artist')}
          >
            del Artista
          </button>
          <button
            className={`sidebar-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            Historial
          </button>
        </nav>

        <div className="sidebar-content">
          {activeTab === 'versions' && (
            <ul className="sidebar-list">
              {versionsList.map((ver) => {
                const urlParts = ver.source_url.split('/');
                const filename = urlParts[urlParts.length - 1];
                const isActive = filename === versionSlug;

                let typeIcon = '🎼';
                let typeLabel = 'Acordes';
                if (ver.type === 'tab') {
                  typeIcon = '🎸';
                  typeLabel = 'Tablatura';
                } else if (ver.type === 'bass') {
                  typeIcon = '🎻';
                  typeLabel = 'Bajo';
                }

                // Rating bars
                const numBars = 3 + (ver.id % 3);
                const bars = Array.from({ length: 5 }).map((_, i) => (
                  <span
                    key={i}
                    className={`sidebar-rating-bar ${i < numBars ? 'active' : ''} ${ver.is_best ? 'best' : ''}`}
                  />
                ));

                return (
                  <li key={ver.id}>
                    <a
                      href={`/${artistSlug}/${filename}`}
                      className={`sidebar-item-link ${isActive ? 'active' : ''}`}
                      onClick={() => setIsSidebarOpen(false)}
                    >
                      <div className="sidebar-item-left">
                        <span className="sidebar-item-icon">{typeIcon}</span>
                        <div className="sidebar-item-text">
                          <div>v{ver.version_number} - {typeLabel}</div>
                          <div className="sidebar-item-meta">{ver.contributor || 'Colaborador'}</div>
                        </div>
                      </div>
                      <div className="sidebar-item-rating">
                        {bars}
                      </div>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}

          {activeTab === 'artist' && (
            <ul className="sidebar-list">
              {artistSongs.map((songItem) => {
                const isCurrent = songItem.slug === songBaseSlug;
                return (
                  <li key={songItem.slug}>
                    <a
                      href={`/${artistSlug}/${songItem.slug}`}
                      className={`sidebar-item-link ${isCurrent ? 'active' : ''}`}
                      onClick={() => setIsSidebarOpen(false)}
                    >
                      <div className="sidebar-item-left">
                        <span className="sidebar-item-icon">🎵</span>
                        <div className="sidebar-item-text" title={songItem.title}>
                          {songItem.title}
                        </div>
                      </div>
                      <span className="version-badges-count">
                        {songItem.versions ? songItem.versions.length : 1}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}

          {activeTab === 'history' && (
            <ul className="sidebar-list">
              {historyList.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>
                  Sin historial reciente
                </div>
              ) : (
                historyList.map((hist) => {
                  const isActive = hist.versionSlug === versionSlug;
                  let typeIcon = '🎼';
                  if (hist.type === 'tab') typeIcon = '🎸';
                  else if (hist.type === 'bass') typeIcon = '🎻';

                  return (
                    <li key={hist.id}>
                      <a
                        href={`/${hist.artistSlug}/${hist.versionSlug}`}
                        className={`sidebar-item-link ${isActive ? 'active' : ''}`}
                        onClick={() => setIsSidebarOpen(false)}
                      >
                        <div className="sidebar-item-left">
                          <span className="sidebar-item-icon">{typeIcon}</span>
                          <div className="sidebar-item-text">
                            <div>{hist.title}</div>
                            <div className="sidebar-item-meta">{hist.artist} (v{hist.version_number})</div>
                          </div>
                        </div>
                      </a>
                    </li>
                  );
                })
              )}
            </ul>
          )}
        </div>
      </aside>

      {/* Contenido principal de la canción */}
      <div className="version-main-content">
        <section id="view-version" className="view-section" style={{ padding: 0, margin: 0, maxWidth: 'none' }}>
          <header className="view-header version-header-layout">
            <div className="version-header-left">
              <div className="breadcrumbs">
                <a href="/">Portada</a> &raquo;{' '}
                <a href={`/${artistSlug}`}>{song.artist}</a> &raquo;{' '}
                <a href={`/${artistSlug}/${songBaseSlug}`}>{song.title}</a> &raquo;{' '}
                <span>Versión {song.version_number}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h2 className="view-title" id="version-view-title">{song.title}</h2>
              </div>
              <h3 className="view-subtitle" id="version-view-artist">
                por <a href={`/${artistSlug}`}>{song.artist}</a>
              </h3>

              {/* Metadatos adicionales */}
              {(song.composers || song.album) && (
                <div className="version-meta-details">
                  {song.composers && (
                    <div className="meta-detail-item composers">
                      <span className="meta-icon">✍️</span>
                      <span className="meta-value">{song.composers}</span>
                    </div>
                  )}
                  {song.album && (
                    <div className="meta-detail-item album">
                      <span className="meta-icon">💿</span>
                      <span className="meta-value">
                        {song.album} {song.year ? `[${song.year}]` : ''}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="version-header-right">
              {song.song_code && (
                <div className="song-code-box">
                  <pre id="tCode">{song.song_code}</pre>
                </div>
              )}
              <div className="contributor-info-box">
                <span>Enviado por </span>
                {song.contributor_id ? (
                  <a href="javascript:void(0)" className="contributor-link" title={`ID: ${song.contributor_id}`}>
                    {song.contributor}
                  </a>
                ) : (
                  <strong>{song.contributor}</strong>
                )}
              </div>
              <div className="external-links">
                {song.source_url && (
                  <a id="version-link-original" href={song.source_url} target="_blank" rel="noopener noreferrer">
                    Original ↗
                  </a>
                )}
                {song.archive_url && (
                  <a id="version-link-wayback" href={song.archive_url} target="_blank" rel="noopener noreferrer">
                    Wayback ↗
                  </a>
                )}
              </div>
            </div>
          </header>

          {/* Divisor con controles integrados (Expandir, Imprimir, Texto Plano, Favoritos y Editar) */}
          <div className="controls-divider-container">
            <div className="controls-divider-line"></div>
            <div className="controls-divider-buttons">
              <button
                className={`control-circle-btn ${isExpanded ? 'active' : ''}`}
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? "Contraer área de tablatura" : "Expandir área de tablatura"}
              >
                {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
              <button
                className="control-circle-btn"
                onClick={() => window.print()}
                title="Vista de impresión"
              >
                <Printer size={18} />
              </button>
              <button
                className="control-circle-btn"
                onClick={() => {
                  const txtSlug = versionSlug.replace(/\.shtml$/, '') + '.txt';
                  window.open(`/TXT/${artistSlug}/${txtSlug}`, '_blank');
                }}
                title="Ver contenido en texto plano (.txt)"
              >
                <FileText size={18} />
              </button>
              <button
                className={`control-circle-btn favorite-heart-btn ${isFavorite ? 'is-fav' : ''}`}
                onClick={toggleFavorite}
                title={isFavorite ? "Quitar de favoritos" : "Marcar como favorito"}
              >
                <Heart size={18} fill={isFavorite ? "var(--chord-color, #e11d48)" : "none"} />
              </button>
              {currentUser && (currentUser.role === 'admin' || currentUser.role === 'moderator') && (
                <button
                  className={`control-circle-btn edit-version-btn ${isEditing ? 'active' : ''}`}
                  onClick={() => setIsEditing(!isEditing)}
                  title={isEditing ? "Cancelar edición" : "Editar versión"}
                  style={{ color: 'var(--accent-light)' }}
                >
                  <Pencil size={18} />
                </button>
              )}
            </div>
          </div>

          {isEditing ? (
            <div className="version-edit-form">
              <div className="edit-form-header">
                <h3>Modo Edición</h3>
                <p>Estás editando los detalles de esta versión ({song.type.toUpperCase()} - v{song.version_number}).</p>
              </div>
              
              <div className="edit-form-grid">
                <div className="edit-form-group">
                  <label>Título de la Canción</label>
                  <input 
                    type="text" 
                    value={editTitle} 
                    onChange={(e) => setEditTitle(e.target.value)} 
                    placeholder="Título..."
                  />
                </div>
                <div className="edit-form-group">
                  <label>Artista / Banda</label>
                  <input 
                    type="text" 
                    value={editArtist} 
                    onChange={(e) => setEditArtist(e.target.value)} 
                    placeholder="Artista..."
                  />
                </div>
                <div className="edit-form-group">
                  <label>Compositores</label>
                  <input 
                    type="text" 
                    value={editComposers} 
                    onChange={(e) => setEditComposers(e.target.value)} 
                    placeholder="Compositores..."
                  />
                </div>
                <div className="edit-form-group">
                  <label>Álbum</label>
                  <input 
                    type="text" 
                    value={editAlbum} 
                    onChange={(e) => setEditAlbum(e.target.value)} 
                    placeholder="Nombre del disco..."
                  />
                </div>
                <div className="edit-form-group">
                  <label>Año de lanzamiento</label>
                  <input 
                    type="number" 
                    value={editYear} 
                    onChange={(e) => setEditYear(e.target.value)} 
                    placeholder="Año..."
                  />
                </div>
                <div className="edit-form-group">
                  <label>Acordes (Separados por espacios)</label>
                  <input 
                    type="text" 
                    value={editChords} 
                    onChange={(e) => setEditChords(e.target.value)} 
                    placeholder="Bb G Eb F..."
                  />
                </div>
              </div>
              
              <div className="edit-form-group content-group" style={{ marginTop: '20px' }}>
                <label>Contenido de la Tablatura / Acordes</label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={24}
                  style={{ fontSize: `${fontSize}px` }}
                  className="edit-tab-textarea"
                  placeholder="Escribe aquí los acordes y la letra..."
                />
              </div>
              
              <div className="edit-form-actions">
                <button className="btn btn-save" onClick={handleSaveChanges}>
                  Guardar Cambios
                </button>
                <button className="btn btn-cancel" onClick={() => setIsEditing(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Barra de herramientas superior */}
              <div className="toolbar">
                {/* Control de Tamaño de Letra */}
                <div className="tool-group">
                  <label htmlFor="font-size-slider">
                    Tamaño letra: <span id="font-size-label">{fontSize}px</span>
                  </label>
                  <input
                    type="range"
                    id="font-size-slider"
                    min="12"
                    max="28"
                    value={fontSize}
                    step="1"
                    onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                  />
                </div>

                {/* Control de Autoscroll */}
                <div className="tool-group autoscroll-controls">
                  <button
                    id="btn-autoscroll"
                    className={`btn btn-primary ${isScrolling ? 'active' : ''}`}
                    onClick={toggleAutoscroll}
                  >
                    <span className="btn-icon">{isScrolling ? '■' : '▶'}</span>
                    <span className="btn-text">{isScrolling ? 'Pausar' : 'Autoscroll'}</span>
                  </button>
                  <div className="scroll-speed-group">
                    <label htmlFor="scroll-speed-slider">Velocidad:</label>
                    <input
                      type="range"
                      id="scroll-speed-slider"
                      min="1"
                      max="10"
                      value={scrollSpeed}
                      step="1"
                      onChange={(e) => setScrollSpeed(parseInt(e.target.value, 10))}
                    />
                    <span id="scroll-speed-label">x{scrollSpeed}</span>
                  </div>
                </div>
              </div>

              {/* Diagramas de acordes recomendados */}
              {chordList.length > 0 && (
                <div id="version-chords-box" className="version-chords-diagrams-container">
                  <h4>Acordes recomendados en esta versión:</h4>
                  <div id="version-chords-list" className="chords-diagrams-list">
                    {chordList.map((chord, index) => (
                      <div
                        key={`${chord}-${index}`}
                        className="chord-diagram-card"
                        onClick={() => onChordClick && onChordClick(chord)}
                        title={`Ver variaciones de ${chord}`}
                      >
                        <span className="chord-diagram-name">{chord}</span>
                        <div className="chord-diagram-svg-wrap">
                          <GuitarChord chordName={chord} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Panel de la tablatura preformateada */}
              <div className="tab-content-container">
                <pre
                  id="version-tab-content"
                  className="tab-content"
                  style={{ fontSize: `${fontSize}px` }}
                  onClick={handleTabClick}
                  dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                />
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

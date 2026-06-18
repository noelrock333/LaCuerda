import React, { useState, useEffect, useRef } from 'react';
import GuitarChord from '../components/GuitarChord';
import { Maximize2, Minimize2, Printer, FileText, Heart, Pencil, Play, Pause, Type, Sliders, ChevronRight, ArrowUp, Flame } from 'lucide-react';
import useAuthStore from '../store/useAuthStore.js';
import useUIStore from '../store/useUIStore.js';
import { useVersionDetailQuery, useSongDetailQuery, useArtistDetailQuery, useUpdateVersionMutation } from '../hooks/useSongs.js';
import { useFavoriteStatusQuery, useToggleFavoriteMutation, useAwesomeMutation } from '../hooks/useFavorites.js';

function getScrollContainer() {
  return document.getElementById('main-scroll');
}

const HISTORY_KEY = 'lacuerda_view_history';
const MOBILE_BREAKPOINT = '(max-width: 900px)';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_BREAKPOINT).matches);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_BREAKPOINT);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isMobile;
}

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

  chordList.sort((a, b) => b.length - a.length);

  const escapedChords = chordList.map((c) =>
    c.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
  );

  const lines = content.split('\n');
  const highlightedLines = lines.map((line) => {
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

export default function VersionView({ artistSlug, versionSlug }) {
  const isMobile = useIsMobile();
  const currentUser = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const setActiveChord = useUIStore((state) => state.setActiveChord);
  const setAuthModalOpen = useUIStore((state) => state.setAuthModalOpen);

  // 1. Queries de TanStack Query
  const { data: song, isLoading: isLoadingSong, error: songError } = useVersionDetailQuery(artistSlug, versionSlug);

  // ID de la canción actual para las peticiones de favoritos y subconsultas
  const songId = song?.id;
  const songBaseSlug = song ? song.source_url.split('/').pop().replace(/-\d+\.shtml$/, '').replace(/\.shtml$/, '') : '';

  // Consultas del sidebar habilitadas cuando el objeto principal está cargado
  const { data: songDetail } = useSongDetailQuery(artistSlug, songBaseSlug);
  const versionsList = songDetail?.versions || [];

  const { data: artistDetail } = useArtistDetailQuery(artistSlug);
  const artistSongs = artistDetail?.songs || [];

  const { data: favStatus = { isFavorite: false, isAwesome: false } } = useFavoriteStatusQuery(songId);
  const isFavorite = favStatus.isFavorite;
  const isAwesome = favStatus.isAwesome;

  // 2. Mutations
  const updateVersionMutation = useUpdateVersionMutation();
  const toggleFavoriteMutation = useToggleFavoriteMutation();
  const awesomeMutation = useAwesomeMutation();

  // 3. Estados Locales
  const [fontSize, setFontSize] = useState(() => (window.innerWidth <= 900 ? 12 : 16));
  const [isExpanded, setIsExpanded] = useState(false);
  const [chordsExpanded, setChordsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Estados para modo edición
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editComposers, setEditComposers] = useState('');
  const [editAlbum, setEditAlbum] = useState('');
  const [editYear, setEditYear] = useState('');
  const [editChords, setEditChords] = useState('');
  const [editContent, setEditContent] = useState('');

  // Sidebar states
  const [historyList, setHistoryList] = useState(getHistory());
  const [activeTab, setActiveTab] = useState('versions'); // 'versions' | 'artist' | 'history'
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Autoscroll states
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(3);
  const scrollIntervalRef = useRef(null);

  // Floating panel states
  const [isFloatingExpanded, setIsFloatingExpanded] = useState(() => {
    const saved = localStorage.getItem('lacuerda_floating_expanded');
    if (saved !== null) return saved === 'true';
    return window.innerWidth > 900;
  });

  useEffect(() => {
    localStorage.setItem('lacuerda_floating_expanded', isFloatingExpanded);
  }, [isFloatingExpanded]);

  // Modo pantalla completa en mobile: oculta header y UI secundaria
  useEffect(() => {
    if (isExpanded && isMobile) {
      document.body.classList.add('version-focus-mode');
    } else {
      document.body.classList.remove('version-focus-mode');
    }
    return () => document.body.classList.remove('version-focus-mode');
  }, [isExpanded, isMobile]);

  // Sincronizar título del documento e Historial
  useEffect(() => {
    if (song) {
      document.title = `${song.title} (v${song.version_number}) - ${song.artist}`;
      
      const currentBaseSlug = song.source_url.split('/').pop().replace(/-\d+\.shtml$/, '').replace(/\.shtml$/, '');
      addToHistory({
        id: `${artistSlug}-${currentBaseSlug}-${song.version_number}`,
        artist: song.artist,
        title: song.title,
        version_number: song.version_number,
        type: song.type,
        artistSlug,
        versionSlug
      });
      setHistoryList(getHistory());

      // Sincronizar los campos de edición
      setEditTitle(song.title || '');
      setEditArtist(song.artist || '');
      setEditComposers(song.composers || '');
      setEditAlbum(song.album || '');
      setEditYear(song.year || '');
      setEditChords(song.chords || '');
      setEditContent(song.content || '');
    }
  }, [song, artistSlug, versionSlug]);

  const scrollToTop = () => {
    const scrollContainer = getScrollContainer();
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Autoscroll: incremento directo sin listener de scroll (iOS/Chrome mobile
  // disparan scroll async y reseteaban la posición acumulada).
  useEffect(() => {
    if (!isScrolling) return;

    const scrollContainer = getScrollContainer();
    if (!scrollContainer) return;

    let active = true;
    let touchStartY = null;
    const ignoreUntil = performance.now() + 350;

    const onTouchStart = (e) => {
      touchStartY = e.touches[0]?.clientY ?? null;
    };

    const onTouchMove = (e) => {
      if (performance.now() < ignoreUntil || touchStartY === null) return;
      const y = e.touches[0]?.clientY;
      if (y != null && Math.abs(y - touchStartY) > 12) {
        setIsScrolling(false);
      }
    };

    const onWheel = () => {
      if (performance.now() < ignoreUntil) return;
      setIsScrolling(false);
    };

    scrollContainer.addEventListener('touchstart', onTouchStart, { passive: true });
    scrollContainer.addEventListener('touchmove', onTouchMove, { passive: true });
    scrollContainer.addEventListener('wheel', onWheel, { passive: true });

    let scrollAccumulator = scrollContainer.scrollTop;

    const scrollStep = () => {
      if (!active) return;

      const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
      if (maxScroll <= 0) {
        setIsScrolling(false);
        return;
      }

      scrollAccumulator = Math.min(scrollAccumulator + scrollSpeed * 0.08, maxScroll);
      scrollContainer.scrollTop = Math.round(scrollAccumulator);

      if (scrollAccumulator >= maxScroll - 0.5) {
        setIsScrolling(false);
        return;
      }

      scrollIntervalRef.current = requestAnimationFrame(scrollStep);
    };

    scrollIntervalRef.current = requestAnimationFrame(scrollStep);

    return () => {
      active = false;
      scrollContainer.removeEventListener('touchstart', onTouchStart);
      scrollContainer.removeEventListener('touchmove', onTouchMove);
      scrollContainer.removeEventListener('wheel', onWheel);
      if (scrollIntervalRef.current) {
        cancelAnimationFrame(scrollIntervalRef.current);
      }
    };
  }, [isScrolling, scrollSpeed]);

  const toggleAutoscroll = () => {
    setIsScrolling((prev) => !prev);
  };

  const handleSaveChanges = () => {
    updateVersionMutation.mutate({
      id: song.id,
      data: {
        title: editTitle,
        artist: editArtist,
        composers: editComposers,
        album: editAlbum,
        year: editYear ? parseInt(editYear, 10) : null,
        chords: editChords,
        content: editContent
      }
    }, {
      onSuccess: () => {
        setIsEditing(false);
      },
      onError: (err) => {
        alert(`Error al guardar: ${err.message || 'Intenta de nuevo'}`);
      }
    });
  };

  const handleTabClick = (e) => {
    if (e.target.tagName === 'A') {
      e.preventDefault();
      setActiveChord(e.target.textContent);
    }
  };

  const toggleFavorite = () => {
    if (!token) {
      setAuthModalOpen(true);
      return;
    }
    toggleFavoriteMutation.mutate({ songId, isFavorite });
  };

  const toggleAwesome = () => {
    if (!token) return;
    awesomeMutation.mutate({ songId, isAwesome: !isAwesome });
  };

  if (isLoadingSong) {
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

  if (songError || !song) {
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

          {/* Divisor con controles integrados */}
          <div className="controls-divider-container">
            <div className="controls-divider-line"></div>
            <div className="controls-divider-buttons">
              <button
                className={`control-circle-btn ${isExpanded ? 'active' : ''}`}
                onClick={() => setIsExpanded(!isExpanded)}
                data-tooltip={isExpanded ? "Contraer pantalla" : "Pantalla completa"}
                title={isExpanded ? "Contraer área de tablatura" : "Expandir área de tablatura"}
              >
                {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
              <button
                className="control-circle-btn"
                onClick={() => window.print()}
                data-tooltip="Imprimir versión"
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
                data-tooltip="Ver texto plano (.txt)"
                title="Ver contenido en texto plano (.txt)"
              >
                <FileText size={18} />
              </button>
              <button
                className={`control-circle-btn favorite-heart-btn ${isFavorite ? 'is-fav' : ''}`}
                onClick={toggleFavorite}
                data-tooltip={isFavorite ? "Quitar de favoritos" : "Marcar favorito"}
                title={isFavorite ? "Quitar de favoritos" : "Marcar como favorito"}
                disabled={toggleFavoriteMutation.isPending}
              >
                <Heart size={18} fill={isFavorite ? "var(--chord-color, #e11d48)" : "none"} />
              </button>
              {isFavorite && (
                <button
                  className={`control-circle-btn chida-fire-btn ${isAwesome ? 'is-awesome' : ''}`}
                  onClick={toggleAwesome}
                  data-tooltip={isAwesome ? "Quitar de chidas" : "Marcar como chida 🔥"}
                  title={isAwesome ? "Quitar marca chida (mejor calidad)" : "Marcar como chida (mejor calidad / interpretación)"}
                  style={{ color: isAwesome ? '#f97316' : 'var(--text-muted)' }}
                  disabled={awesomeMutation.isPending}
                >
                  <Flame size={18} fill={isAwesome ? "#f97316" : "none"} />
                </button>
              )}
              {currentUser && (currentUser.role === 'admin' || currentUser.role === 'moderator') && (
                <button
                  className={`control-circle-btn edit-version-btn ${isEditing ? 'active' : ''}`}
                  onClick={() => setIsEditing(!isEditing)}
                  data-tooltip={isEditing ? "Cancelar edición" : "Editar versión"}
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
                <button 
                  className="btn btn-save" 
                  onClick={handleSaveChanges}
                  disabled={updateVersionMutation.isPending}
                >
                  {updateVersionMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
                </button>
                <button className="btn btn-cancel" onClick={() => setIsEditing(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Botón flotante para salir de pantalla completa (solo mobile) */}
              {isExpanded && isMobile && (
                <button
                  className="version-focus-exit-btn"
                  onClick={() => setIsExpanded(false)}
                  title="Contraer pantalla"
                  aria-label="Contraer pantalla"
                >
                  <Minimize2 size={20} />
                </button>
              )}

              {/* Barra de herramientas flotante del lado derecho */}
              <div className="floating-toolbar-container">
                {!isFloatingExpanded ? (
                  <div className="floating-toolbar-collapsed">
                    <button
                      className="floating-fab-btn"
                      onClick={() => setIsFloatingExpanded(true)}
                      title="Abrir ajustes de lectura"
                    >
                      <Sliders size={18} />
                    </button>
                    <button
                      className={`floating-fab-btn ${isScrolling ? 'active' : ''}`}
                      onClick={toggleAutoscroll}
                      title={isScrolling ? "Pausar autoscroll" : "Iniciar autoscroll"}
                    >
                      {isScrolling ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <button
                      className="floating-fab-btn"
                      onClick={scrollToTop}
                      title="Subir al inicio"
                    >
                      <ArrowUp size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="floating-toolbar-expanded">
                    <div className="floating-toolbar-header">
                      <span className="floating-toolbar-title">Ajustes de Lectura</span>
                      <button
                        className="floating-toolbar-close-btn"
                        onClick={() => setIsFloatingExpanded(false)}
                        title="Minimizar panel"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>

                    {/* Control de Autoscroll */}
                    <div className="floating-toolbar-section">
                      <button
                        className={`floating-autoscroll-toggle ${isScrolling ? 'active' : ''}`}
                        onClick={toggleAutoscroll}
                      >
                        {isScrolling ? <Pause size={16} /> : <Play size={16} />}
                        <span>{isScrolling ? 'Pausar Scroll' : 'Autoscroll'}</span>
                      </button>

                      <div className="floating-toolbar-label">
                        <span className="floating-toolbar-label-left">
                          <Sliders size={13} style={{ transform: 'rotate(90deg)' }} /> Velocidad
                        </span>
                        <span className="floating-toolbar-value">x{scrollSpeed}</span>
                      </div>
                      <div className="floating-toolbar-controls">
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={scrollSpeed}
                          step="1"
                          onChange={(e) => setScrollSpeed(parseInt(e.target.value, 10))}
                        />
                        <div className="floating-toolbar-btn-group">
                          <button
                            className="floating-toolbar-adjust-btn"
                            onClick={() => setScrollSpeed(prev => Math.max(1, prev - 1))}
                            title="Reducir velocidad"
                          >
                            -
                          </button>
                          <button
                            className="floating-toolbar-adjust-btn"
                            onClick={() => setScrollSpeed(prev => Math.min(10, prev + 1))}
                            title="Aumentar velocidad"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="floating-toolbar-divider" />

                    {/* Control de Tamaño de Letra */}
                    <div className="floating-toolbar-section">
                      <div className="floating-toolbar-label">
                        <span className="floating-toolbar-label-left">
                          <Type size={14} /> Tamaño Letra
                        </span>
                        <span className="floating-toolbar-value">{fontSize}px</span>
                      </div>
                      <div className="floating-toolbar-controls">
                        <input
                          type="range"
                          min="12"
                          max="28"
                          value={fontSize}
                          step="1"
                          onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                        />
                        <div className="floating-toolbar-btn-group">
                          <button
                            className="floating-toolbar-adjust-btn"
                            onClick={() => setFontSize(prev => Math.max(12, prev - 1))}
                            title="Reducir letra"
                          >
                            -
                          </button>
                          <button
                            className="floating-toolbar-adjust-btn"
                            onClick={() => setFontSize(prev => Math.min(28, prev + 1))}
                            title="Aumentar letra"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="floating-toolbar-divider" />

                    {/* Botón rápido para subir al inicio */}
                    <button
                      className="floating-toolbar-top-btn"
                      onClick={scrollToTop}
                    >
                      <ArrowUp size={14} />
                      <span>Subir al inicio</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Acordes recomendados: colapsables en mobile, diagramas en desktop */}
              {chordList.length > 0 && (
                <>
                  <div className="version-chords-mobile">
                    <button
                      type="button"
                      className="version-chords-mobile-toggle"
                      onClick={() => setChordsExpanded((v) => !v)}
                      aria-expanded={chordsExpanded}
                    >
                      Acordes recomendados ({chordList.length})
                      <ChevronRight
                        size={16}
                        className={`version-chords-chevron ${chordsExpanded ? 'open' : ''}`}
                      />
                    </button>
                    {chordsExpanded && (
                      <div className="chords-list version-chords-mobile-list">
                        {chordList.map((chord, index) => (
                          <span
                            key={`${chord}-${index}`}
                            className="chord-badge"
                            role="button"
                            tabIndex={0}
                            onClick={() => setActiveChord(chord)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setActiveChord(chord);
                              }
                            }}
                            title={`Ver variaciones de ${chord}`}
                          >
                            {chord}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div id="version-chords-box" className="version-chords-diagrams-container">
                    <h4>Acordes recomendados en esta versión:</h4>
                    <div id="version-chords-list" className="chords-diagrams-list">
                      {chordList.map((chord, index) => (
                        <div
                          key={`${chord}-${index}`}
                          className="chord-diagram-card"
                          onClick={() => setActiveChord(chord)}
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
                </>
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

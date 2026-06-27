import React, { useState, useEffect, useRef } from 'react';
import GuitarChord from '../components/GuitarChord';
import { Maximize2, Minimize2, Printer, FileText, Heart, Pencil, Play, Pause, ChevronRight, ArrowUp, Flame } from 'lucide-react';
import useAuthStore from '../store/useAuthStore.js';
import useUIStore from '../store/useUIStore.js';
import { useVersionDetailQuery, useSongDetailQuery, useArtistDetailQuery, useUpdateVersionMutation } from '../hooks/useSongs.js';
import { useFavoriteStatusQuery, useToggleFavoriteMutation, useAwesomeMutation } from '../hooks/useFavorites.js';

function getScrollContainer() {
  return document.getElementById('main-scroll');
}

const HISTORY_KEY = 'lacuerda_view_history';
const SCROLL_SPEED_KEY = 'lacuerda_scroll_speed';
const DEFAULT_SCROLL_SPEED = 4;
const SCROLL_SPEED_LEVELS = [8, 7, 6, 5, 4, 3, 2, 1];
const MOBILE_BREAKPOINT = '(max-width: 900px)';

function getStoredScrollSpeed() {
  try {
    const saved = localStorage.getItem(SCROLL_SPEED_KEY);
    if (saved !== null) {
      const value = parseInt(saved, 10);
      if (value >= 1 && value <= 8) return value;
    }
  } catch {
    // ignore
  }
  return DEFAULT_SCROLL_SPEED;
}

function storeScrollSpeed(speed) {
  try {
    localStorage.setItem(SCROLL_SPEED_KEY, String(speed));
  } catch {
    // ignore
  }
}

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

function getVersionTypeMeta(type) {
  if (type === 'tab') return { label: 'Tablatura', className: 'version-command-type--tab' };
  if (type === 'bass') return { label: 'Bajo', className: 'version-command-type--bass' };
  return { label: 'Acordes', className: 'version-command-type--acordes' };
}

function VersionCommandBar({
  song,
  artistSlug,
  songBaseSlug,
  versionSlug,
  isExpanded,
  isFavorite,
  isAwesome,
  isEditing,
  currentUser,
  onToggleExpand,
  onToggleFavorite,
  onToggleAwesome,
  onToggleEdit,
  favoritePending,
  awesomePending,
}) {
  const typeMeta = getVersionTypeMeta(song.type);

  return (
    <header className="version-command-bar">
      <div className="version-command-info">
        <nav className="version-command-crumbs" aria-label="Ruta de navegación">
          <a href="/">Portada</a>
          <span className="version-command-crumbs-sep" aria-hidden="true">›</span>
          <a href={`/${artistSlug}`}>{song.artist}</a>
          <span className="version-command-crumbs-sep" aria-hidden="true">›</span>
          <a href={`/${artistSlug}/${songBaseSlug}`}>{song.title}</a>
          <span className="version-command-crumbs-sep" aria-hidden="true">›</span>
          <span className="version-command-crumbs-current">v{song.version_number}</span>
        </nav>

        <div className="version-command-headline">
          <h1 className="version-command-title" id="version-view-title">{song.title}</h1>
          <span className={`version-command-type ${typeMeta.className}`}>{typeMeta.label}</span>
          <span className="version-command-ver">v{song.version_number}</span>
        </div>

        <p className="version-command-byline">
          <a href={`/${artistSlug}`} id="version-view-artist">{song.artist}</a>
        </p>

        <div className="version-command-details">
          <span className="version-command-detail">
            Colab.{' '}
            {song.contributor_id ? (
              <a
                href="javascript:void(0)"
                className="version-command-detail-strong"
                title={`ID: ${song.contributor_id}`}
              >
                {song.contributor}
              </a>
            ) : (
              <strong className="version-command-detail-strong">{song.contributor}</strong>
            )}
          </span>

          {song.song_code && (
            <>
              <span className="version-command-detail-sep" aria-hidden="true">·</span>
              <span className="version-command-detail">
                <code className="version-command-code" id="tCode">{song.song_code}</code>
              </span>
            </>
          )}

          {song.composers && (
            <>
              <span className="version-command-detail-sep" aria-hidden="true">·</span>
              <span className="version-command-detail">{song.composers}</span>
            </>
          )}

          {song.album && (
            <>
              <span className="version-command-detail-sep" aria-hidden="true">·</span>
              <span className="version-command-detail">
                {song.album}{song.year ? ` [${song.year}]` : ''}
              </span>
            </>
          )}

          {(song.source_url || song.archive_url) && (
            <>
              <span className="version-command-detail-sep" aria-hidden="true">·</span>
              <span className="version-command-links">
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
              </span>
            </>
          )}
        </div>
      </div>

      <div className="version-command-actions" role="toolbar" aria-label="Acciones de versión">
        <button
          type="button"
          className={`version-action-btn ${isExpanded ? 'active' : ''}`}
          onClick={onToggleExpand}
          data-tooltip={isExpanded ? 'Contraer pantalla' : 'Pantalla completa'}
          title={isExpanded ? 'Contraer área de tablatura' : 'Expandir área de tablatura'}
        >
          {isExpanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
        </button>
        <button
          type="button"
          className="version-action-btn"
          onClick={() => window.print()}
          data-tooltip="Imprimir versión"
          title="Vista de impresión"
        >
          <Printer size={17} />
        </button>
        <button
          type="button"
          className="version-action-btn"
          onClick={() => {
            const txtSlug = `${versionSlug.replace(/\.shtml$/, '')}.txt`;
            window.open(`/TXT/${artistSlug}/${txtSlug}`, '_blank');
          }}
          data-tooltip="Ver texto plano (.txt)"
          title="Ver contenido en texto plano (.txt)"
        >
          <FileText size={17} />
        </button>
        <button
          type="button"
          className={`version-action-btn favorite-heart-btn ${isFavorite ? 'is-fav' : ''}`}
          onClick={onToggleFavorite}
          data-tooltip={isFavorite ? 'Quitar de favoritos' : 'Marcar favorito'}
          title={isFavorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
          disabled={favoritePending}
        >
          <Heart size={17} fill={isFavorite ? 'var(--chord-color, #e11d48)' : 'none'} />
        </button>
        {isFavorite && (
          <button
            type="button"
            className={`version-action-btn chida-fire-btn ${isAwesome ? 'is-awesome' : ''}`}
            onClick={onToggleAwesome}
            data-tooltip={isAwesome ? 'Quitar de chidas' : 'Marcar como chida 🔥'}
            title={isAwesome ? 'Quitar marca chida' : 'Marcar como chida'}
            style={{ color: isAwesome ? '#f97316' : 'var(--text-muted)' }}
            disabled={awesomePending}
          >
            <Flame size={17} fill={isAwesome ? '#f97316' : 'none'} />
          </button>
        )}
        {currentUser && (currentUser.role === 'admin' || currentUser.role === 'moderator') && (
          <button
            type="button"
            className={`version-action-btn edit-version-btn ${isEditing ? 'active' : ''}`}
            onClick={onToggleEdit}
            data-tooltip={isEditing ? 'Cancelar edición' : 'Editar versión'}
            title={isEditing ? 'Cancelar edición' : 'Editar versión'}
          >
            <Pencil size={17} />
          </button>
        )}
      </div>
    </header>
  );
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
  const [scrollSpeed, setScrollSpeed] = useState(getStoredScrollSpeed);
  const [showSpeedPicker, setShowSpeedPicker] = useState(false);
  const scrollIntervalRef = useRef(null);

  useEffect(() => {
    storeScrollSpeed(scrollSpeed);
  }, [scrollSpeed]);

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
    if (isScrolling) {
      setIsScrolling(false);
      return;
    }
    setShowSpeedPicker(false);
    setIsScrolling(true);
  };

  const toggleSpeedPicker = () => {
    setShowSpeedPicker((prev) => !prev);
  };

  const selectScrollSpeed = (speed) => {
    setScrollSpeed(speed);
    setShowSpeedPicker(false);
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
          <h2 className="view-title">Cargando acordes...</h2>
        </header>
        <div className="list-loading auto-import-loading">
          No está en el catálogo local. Buscando en LaCuerda.net...
        </div>
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
          <h2 className="view-title">Tablatura no disponible</h2>
        </header>
        <div className="list-empty">
          {songError?.message || 'No se pudo descargar o localizar la versión especificada.'}
        </div>
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
          <VersionCommandBar
            song={song}
            artistSlug={artistSlug}
            songBaseSlug={songBaseSlug}
            versionSlug={versionSlug}
            isExpanded={isExpanded}
            isFavorite={isFavorite}
            isAwesome={isAwesome}
            isEditing={isEditing}
            currentUser={currentUser}
            onToggleExpand={() => setIsExpanded(!isExpanded)}
            onToggleFavorite={toggleFavorite}
            onToggleAwesome={toggleAwesome}
            onToggleEdit={() => setIsEditing(!isEditing)}
            favoritePending={toggleFavoriteMutation.isPending}
            awesomePending={awesomeMutation.isPending}
          />

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

              {/* Barra flotante estilo LaCuerda: play → números → scroll */}
              <div className="floating-toolbar-container">
                <div className={`floating-toolbar ${showSpeedPicker ? 'floating-toolbar--picking' : ''}`}>
                  {showSpeedPicker && (
                    <div className="floating-speed-picker" role="listbox" aria-label="Elegir velocidad de desfile">
                      {SCROLL_SPEED_LEVELS.map((level) => (
                        <button
                          key={level}
                          type="button"
                          role="option"
                          aria-selected={scrollSpeed === level}
                          className={`floating-speed-option ${scrollSpeed === level ? 'selected' : ''}`}
                          onClick={() => selectScrollSpeed(level)}
                        >
                          {level}x
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="floating-toolbar-actions">
                    <button
                      type="button"
                      className={`floating-toolbar-play ${isScrolling ? 'active' : ''}`}
                      onClick={toggleAutoscroll}
                      title={isScrolling ? 'Pausar autoscroll' : `Iniciar autoscroll (velocidad ${scrollSpeed})`}
                      aria-pressed={isScrolling}
                    >
                      {isScrolling ? <Pause size={18} /> : <Play size={18} />}
                    </button>

                    <button
                      type="button"
                      className={`floating-toolbar-speed-btn ${showSpeedPicker ? 'active' : ''}`}
                      onClick={toggleSpeedPicker}
                      title="Cambiar velocidad de desfile"
                      aria-expanded={showSpeedPicker}
                      aria-label={`Velocidad ${scrollSpeed}. Pulsa para cambiar`}
                    >
                      {scrollSpeed}x
                    </button>

                    <div className="floating-toolbar-font">
                      <button
                        type="button"
                        className="floating-toolbar-font-btn"
                        onClick={() => setFontSize((prev) => Math.max(12, prev - 1))}
                        title="Reducir letra"
                        aria-label="Reducir tamaño de letra"
                      >
                        A−
                      </button>
                      <button
                        type="button"
                        className="floating-toolbar-font-btn"
                        onClick={() => setFontSize((prev) => Math.min(28, prev + 1))}
                        title="Aumentar letra"
                        aria-label="Aumentar tamaño de letra"
                      >
                        A+
                      </button>
                    </div>

                    <button
                      type="button"
                      className="floating-toolbar-top-btn"
                      onClick={scrollToTop}
                      title="Subir al inicio"
                      aria-label="Subir al inicio"
                    >
                      <ArrowUp size={16} />
                    </button>
                  </div>
                </div>
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

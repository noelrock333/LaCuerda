import { useEffect, useMemo, useState } from 'react';
import { useArtistDetailQuery } from '../hooks/useSongs.js';

const HISTORY_KEY = 'lacuerda_view_history';

const TYPE_FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'acordes', label: 'Acordes' },
  { id: 'tab', label: 'Tablatura' },
  { id: 'bass', label: 'Bajo' },
];

function getHistory() {
  try {
    const data = localStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function getTypeMeta(type) {
  if (type === 'tab') return { label: 'Tablatura', className: 'song-type-tag--tab' };
  if (type === 'bass') return { label: 'Bajo', className: 'song-type-tag--bass' };
  return { label: 'Acordes', className: 'song-type-tag--acordes' };
}

function getArtistCoverHue(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

function getSongTypes(song) {
  const types = song.versions?.map((version) => version.type) ?? [];
  return types.length > 0 ? types : ['acordes'];
}

function songMatchesTypeFilter(song, filter) {
  if (filter === 'all') return true;
  return getSongTypes(song).includes(filter);
}

function SidebarTrack({ song, slug, coverHue, index, showRank = false }) {
  return (
    <li>
      <a href={`/${slug}/${song.slug}`} className="artist-top-track">
        {showRank ? (
          <span className="artist-top-rank">{index + 1}</span>
        ) : (
          <span className="artist-top-rank artist-top-rank--dot" aria-hidden="true">•</span>
        )}
        <span
          className="artist-top-art"
          style={{ '--track-hue': (coverHue + index * 37) % 360 }}
          aria-hidden="true"
        >
          ♪
        </span>
        <span className="artist-top-track-info">
          <span className="artist-top-track-title">{song.title}</span>
          <span className="artist-top-track-meta">
            {song.versions?.length ?? 0} versiones
          </span>
        </span>
        <span className="artist-top-play" aria-hidden="true">▶</span>
      </a>
    </li>
  );
}

function SidebarHistoryItem({ item, coverHue, index }) {
  const typeMeta = getTypeMeta(item.type);
  return (
    <li>
      <a href={`/${item.artistSlug}/${item.versionSlug}`} className="artist-top-track">
        <span className="artist-top-rank artist-top-rank--dot" aria-hidden="true">•</span>
        <span
          className="artist-top-art"
          style={{ '--track-hue': (coverHue + index * 37) % 360 }}
          aria-hidden="true"
        >
          ♪
        </span>
        <span className="artist-top-track-info">
          <span className="artist-top-track-title">{item.title}</span>
          <span className="artist-top-track-meta">
            v{item.version_number} · {typeMeta.label}
          </span>
        </span>
        <span className="artist-top-play" aria-hidden="true">▶</span>
      </a>
    </li>
  );
}

function ArtistSidebar({ artist, slug, songs, topSongs }) {
  const [activeTab, setActiveTab] = useState('popular');
  const coverHue = getArtistCoverHue(artist);
  const initials = artist
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  const artistHistory = useMemo(() => {
    if (activeTab !== 'history') return [];
    return getHistory().filter((item) => item.artistSlug === slug);
  }, [activeTab, slug]);

  const hero = (
    <div
      className="artist-sidebar-hero"
      style={{ '--artist-cover-hue': coverHue }}
    >
      <div className="artist-sidebar-cover" aria-hidden="true">
        <span className="artist-sidebar-cover-initials">{initials || '♪'}</span>
      </div>
      <div className="artist-sidebar-identity">
        <span className="artist-sidebar-eyebrow">Artista</span>
        <h3 className="artist-sidebar-name" id="artist-card-name">{artist}</h3>
        <div className="artist-sidebar-stats">
          <span>{songs.length} canciones</span>
          <span className="artist-sidebar-stat-dot" aria-hidden="true">·</span>
          <span>Catálogo local</span>
        </div>
      </div>
    </div>
  );

  return (
    <aside className="artist-sidebar">
      {hero}

      <nav className="artist-sidebar-tabs" aria-label="Secciones del artista">
        <button
          type="button"
          className={`artist-sidebar-tab ${activeTab === 'popular' ? 'active' : ''}`}
          onClick={() => setActiveTab('popular')}
        >
          Populares del artista
        </button>
        <button
          type="button"
          className={`artist-sidebar-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Historial
        </button>
      </nav>

      <div className="artist-sidebar-panel">
        {activeTab === 'popular' ? (
          topSongs.length === 0 ? (
            <div className="artist-sidebar-empty">Sin canciones populares en el catálogo local</div>
          ) : (
            <ul className="artist-top-list" id="artist-top-songs">
              {topSongs.map((song, index) => (
                <SidebarTrack
                  key={song.slug}
                  song={song}
                  slug={slug}
                  coverHue={coverHue}
                  index={index}
                  showRank
                />
              ))}
            </ul>
          )
        ) : artistHistory.length === 0 ? (
          <div className="artist-sidebar-empty">Sin historial reciente para este artista</div>
        ) : (
          <ul className="artist-top-list artist-top-list--catalog">
            {artistHistory.map((item, index) => (
              <SidebarHistoryItem
                key={item.id}
                item={item}
                coverHue={coverHue}
                index={index}
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function ArtistViewShell({ breadcrumbLabel, title, listMeta, sidebar, children }) {
  return (
    <section id="view-artist" className="view-section view-section--wide">
      <header className="view-header">
        <div className="breadcrumbs">
          <a href="/">Portada</a> &raquo; <span id="artist-breadcrumb-name">{breadcrumbLabel}</span>
        </div>
        <h2 className="view-title" id="artist-title-name">{title}</h2>
        {listMeta && <p className="browse-list-meta">{listMeta}</p>}
      </header>

      <div className="artist-layout">
        {sidebar}
        <div className="artist-main">{children}</div>
      </div>
    </section>
  );
}

export default function ArtistView({ artistSlug }) {
  const { data = { artist: '', slug: '', songs: [] }, isLoading, error } = useArtistDetailQuery(artistSlug);
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    if (data.artist) {
      document.title = `Acordes de ${data.artist} - LaCuerda Offline`;
    }
  }, [data.artist]);

  const filterCounts = useMemo(() => ({
    all: data.songs.length,
    acordes: data.songs.filter((song) => songMatchesTypeFilter(song, 'acordes')).length,
    tab: data.songs.filter((song) => songMatchesTypeFilter(song, 'tab')).length,
    bass: data.songs.filter((song) => songMatchesTypeFilter(song, 'bass')).length,
  }), [data.songs]);

  const filteredSongs = useMemo(
    () => data.songs.filter((song) => songMatchesTypeFilter(song, typeFilter)),
    [data.songs, typeFilter],
  );

  if (isLoading) {
    return (
      <ArtistViewShell breadcrumbLabel="Artista" title="Cargando artista...">
        <div className="list-loading">Cargando catálogo del artista...</div>
      </ArtistViewShell>
    );
  }

  if (error) {
    return (
      <ArtistViewShell breadcrumbLabel="Error" title="Error al cargar artista">
        <div className="list-empty">No se pudo encontrar el artista en la base de datos local.</div>
      </ArtistViewShell>
    );
  }

  const topSongs = data.songs.slice(0, 5);
  const sidebar = (
    <ArtistSidebar
      artist={data.artist}
      slug={data.slug}
      songs={data.songs}
      topSongs={topSongs}
    />
  );

  return (
    <ArtistViewShell
      breadcrumbLabel={data.artist}
      title={data.artist}
      listMeta={
        data.songs.length === 0
          ? null
          : `${filteredSongs.length} de ${data.songs.length} canciones`
      }
      sidebar={sidebar}
    >
      <div className="artist-songs-container">
        {data.songs.length === 0 ? (
          <div className="list-empty">El catálogo del artista está vacío</div>
        ) : (
          <div className="artist-songs-table" id="artist-songs-grid">
            <nav className="artist-songs-tabs" aria-label="Filtrar por tipo">
              {TYPE_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  className={`artist-songs-tab ${typeFilter === filter.id ? 'active' : ''}`}
                  onClick={() => setTypeFilter(filter.id)}
                >
                  <span>{filter.label}</span>
                  <span className="artist-songs-tab-count">{filterCounts[filter.id]}</span>
                </button>
              ))}
            </nav>

            <div className="artist-songs-table-body">
              {filteredSongs.length === 0 ? (
                <div className="artist-songs-empty-filter">
                  No hay canciones de este tipo en el catálogo local.
                </div>
              ) : (
                filteredSongs.map((song, index) => {
                  const firstVersionType = song.versions?.[0]?.type ?? 'acordes';
                  const typeMeta = getTypeMeta(firstVersionType);
                  return (
                    <a
                      key={song.slug}
                      href={`/${data.slug}/${song.slug}`}
                      className="artist-songs-row"
                    >
                      <span className="artist-songs-row-index">{index + 1}</span>
                      <span className="artist-songs-row-title">{song.title}</span>
                      <span className={`song-type-tag ${typeMeta.className}`}>{typeMeta.label}</span>
                      <span className="artist-songs-row-versions">{song.versions.length} ver.</span>
                      <span className="artist-songs-row-arrow" aria-hidden="true">›</span>
                    </a>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </ArtistViewShell>
  );
}

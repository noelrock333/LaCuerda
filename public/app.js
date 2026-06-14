document.addEventListener('DOMContentLoaded', () => {
  // --- Elementos del DOM ---
  const logoLink = document.getElementById('logo-link');
  const headerSearchContainer = document.getElementById('header-search-container');
  const headerSearchInput = document.getElementById('header-search-input');
  
  // Vistas
  const viewHome = document.getElementById('view-home');
  const viewArtist = document.getElementById('view-artist');
  const viewSong = document.getElementById('view-song');
  const viewVersion = document.getElementById('view-version');
  const viewAlphabet = document.getElementById('view-alphabet');
  
  // Vista Home
  const homeSearchInput = document.getElementById('home-search-input');
  const homeSearchResults = document.getElementById('home-search-results');
  const homeArtistsList = document.getElementById('home-artists-list');
  const homeSongsList = document.getElementById('home-songs-list');
  
  // Vista Artista
  const artistBreadcrumbName = document.getElementById('artist-breadcrumb-name');
  const artistTitleName = document.getElementById('artist-title-name');
  const artistCardName = document.getElementById('artist-card-name');
  const artistTopSongs = document.getElementById('artist-top-songs');
  const artistSongsGrid = document.getElementById('artist-songs-grid');
  
  // Vista Canción / Versiones
  const songBreadcrumbArtistLink = document.getElementById('song-breadcrumb-artist-link');
  const songBreadcrumbTitle = document.getElementById('song-breadcrumb-title');
  const songViewTitle = document.getElementById('song-view-title');
  const songViewArtist = document.getElementById('song-view-artist');
  const songVersionsTableBody = document.getElementById('song-versions-table-body');
  
  // Vista Versión / Tablatura
  const versionBreadcrumbArtistLink = document.getElementById('version-breadcrumb-artist-link');
  const versionBreadcrumbSongLink = document.getElementById('version-breadcrumb-song-link');
  const versionBreadcrumbNumber = document.getElementById('version-breadcrumb-number');
  const versionViewTitle = document.getElementById('version-view-title');
  const versionViewArtist = document.getElementById('version-view-artist');
  const versionTypeTag = document.getElementById('version-type-tag');
  const versionContributorTag = document.getElementById('version-contributor-tag');
  const versionLinkOriginal = document.getElementById('version-link-original');
  const versionLinkWayback = document.getElementById('version-link-wayback');
  
  const fontSizeSlider = document.getElementById('font-size-slider');
  const fontSizeLabel = document.getElementById('font-size-label');
  const btnAutoscroll = document.getElementById('btn-autoscroll');
  const scrollSpeedSlider = document.getElementById('scroll-speed-slider');
  const scrollSpeedLabel = document.getElementById('scroll-speed-label');
  
  const versionChordsBox = document.getElementById('version-chords-box');
  const versionChordsList = document.getElementById('version-chords-list');
  const versionTabContent = document.getElementById('version-tab-content');
  const mainContentContainer = document.querySelector('.main-content');

  // --- Estado de la aplicación ---
  let isScrolling = false;
  let scrollSpeed = 3;
  let searchTimeout = null;

  // --- Enrutador del Cliente (Client-side SPA Router) ---
  
  // Interceptar clicks locales para History API
  document.addEventListener('click', (e) => {
    const target = e.target.closest('a');
    if (target && target.getAttribute('href')) {
      const href = target.getAttribute('href');
      // Asegurarse de que sea una ruta interna (relativa)
      if (href.startsWith('/') && !href.startsWith('//') && !target.getAttribute('target')) {
        e.preventDefault();
        history.pushState(null, '', href);
        navigate();
      }
    }
  });

  // Retornar a la portada al hacer clic en el logo
  logoLink.addEventListener('click', () => {
    history.pushState(null, '', '/');
    navigate();
  });

  // Escuchar cambios de historial (popstate)
  window.addEventListener('popstate', navigate);

  // Función principal de enrutamiento
  function navigate() {
    // Detener autoscroll si está activo en una transición de vista
    if (isScrolling) stopAutoscroll();

    const path = window.location.pathname;
    
    // Normalizar ruta: remover barras inicial y final
    const cleanPath = path.replace(/^\/+/, '').replace(/\/+$/, '');
    
    if (cleanPath === '') {
      showView('home');
      initHome();
      return;
    }
    
    const parts = cleanPath.split('/');
    
    if (parts.length === 2 && parts[0] === 'letter') {
      // Vista Alfabética de Artistas: /letter/:letter
      const letter = parts[1];
      const params = new URLSearchParams(window.location.search);
      const page = parseInt(params.get('page') || 1, 10);
      showView('alphabet');
      initAlphabet(letter, page);
    } else if (parts.length === 1) {
      // 1. Vista de Artista: /:artistSlug
      showView('artist');
      initArtist(parts[0]);
    } else if (parts.length === 2) {
      const artistSlug = parts[0];
      const songOrVersionSlug = parts[1];
      
      // Determinar si es una versión específica (.shtml o termina en -<numero>)
      const isVersion = songOrVersionSlug.endsWith('.shtml') || songOrVersionSlug.match(/-\d+$/);
      if (isVersion) {
        // 3. Vista de Versión: /:artistSlug/:song_version
        showView('version');
        initVersion(artistSlug, songOrVersionSlug);
      } else {
        // 2. Vista de Canción (lista de versiones): /:artistSlug/:songSlug
        showView('song');
        initSong(artistSlug, songOrVersionSlug);
      }
    } else {
      // Ruta no reconocida -> redirigir a Home
      history.replaceState(null, '', '/');
      showView('home');
      initHome();
    }
  }

  // Activa la sección de la vista indicada y oculta las demás
  function showView(viewName) {
    // Ocultar todas las secciones
    viewHome.classList.add('hidden');
    viewArtist.classList.add('hidden');
    viewSong.classList.add('hidden');
    viewVersion.classList.add('hidden');
    if (viewAlphabet) viewAlphabet.classList.add('hidden');
    
    // Resetear scroll del viewport principal
    mainContentContainer.scrollTop = 0;

    // Mostrar cabecera de búsqueda en todas las vistas excepto Home
    if (viewName === 'home') {
      headerSearchContainer.classList.add('hidden');
      viewHome.classList.remove('hidden');
      document.title = "LaCuerda.net - Acordes, Letras y Tablaturas Offline";
    } else {
      headerSearchContainer.classList.remove('hidden');
      if (viewName === 'artist') viewArtist.classList.remove('hidden');
      if (viewName === 'song') viewSong.classList.remove('hidden');
      if (viewName === 'version') viewVersion.classList.remove('hidden');
      if (viewName === 'alphabet' && viewAlphabet) viewAlphabet.classList.remove('hidden');
    }
  }

  // ==========================================================================
  // INICIALIZADORES & RENDERIZADORES DE VISTA
  // ==========================================================================

  // --- Vista 1: Portada (Home) ---
  function initHome() {
    homeSearchInput.value = '';
    homeSearchInput.focus();
    homeSearchResults.classList.add('hidden');
    homeArtistsList.innerHTML = '';
    homeSongsList.innerHTML = '';

    // Manejar búsquedas en tiempo real
    homeSearchInput.removeEventListener('input', handleHomeSearch);
    homeSearchInput.addEventListener('input', handleHomeSearch);
  }

  function handleHomeSearch(e) {
    const query = e.target.value.trim();
    clearTimeout(searchTimeout);
    
    if (query.length < 2) {
      homeSearchResults.classList.add('hidden');
      return;
    }

    searchTimeout = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error('Error de búsqueda');
        const data = await response.json();
        
        homeSearchResults.classList.remove('hidden');
        
        // Renderizar columna de artistas
        if (data.artists.length === 0) {
          homeArtistsList.innerHTML = '<div class="list-empty">Sin artistas coincidentes</div>';
        } else {
          homeArtistsList.innerHTML = data.artists.map(art => `
            <a href="/${art.slug}" class="result-item">
              <span>${art.name}</span>
              <span class="result-item-sub">Artista ➔</span>
            </a>
          `).join('');
        }

        // Renderizar columna de canciones
        if (data.songs.length === 0) {
          homeSongsList.innerHTML = '<div class="list-empty">Sin canciones coincidentes</div>';
        } else {
          homeSongsList.innerHTML = data.songs.map(song => {
            const artistSlug = slugify(song.artist);
            const songSlug = getSongSlugFromUrl(song.source_url);
            return `
              <a href="/${artistSlug}/${songSlug}" class="result-item">
                <div>
                  <strong>${song.title}</strong>
                  <div class="result-item-sub">${song.artist}</div>
                </div>
                <span class="result-item-sub">➔</span>
              </a>
            `;
          }).join('');
        }
      } catch (error) {
        console.error(error);
      }
    }, 250);
  }

  // --- Vista 5: Índice Alfabético de Artistas (Alphabet) ---
  async function initAlphabet(letter, page) {
    const alphabetBreadcrumbLetter = document.getElementById('alphabet-breadcrumb-letter');
    const alphabetTitleLetter = document.getElementById('alphabet-title-letter');
    const alphabetArtistsGrid = document.getElementById('alphabet-artists-grid');
    const alphabetPagination = document.getElementById('alphabet-pagination');

    alphabetBreadcrumbLetter.textContent = letter;
    alphabetTitleLetter.textContent = letter;
    alphabetArtistsGrid.innerHTML = '<div class="list-loading">Cargando artistas...</div>';
    alphabetPagination.innerHTML = '';

    // Resaltar letra activa en la portada (si volvemos a la portada, esto ayuda a mantener sincronía)
    document.querySelectorAll('.alphabet-links a').forEach(a => {
      if (a.getAttribute('href') === `/letter/${letter}`) {
        a.classList.add('active');
      } else {
        a.classList.remove('active');
      }
    });

    try {
      const response = await fetch(`/api/artists/by-letter/${letter}?page=${page}`);
      if (!response.ok) throw new Error('Error al cargar artistas por letra');
      const data = await response.json();

      document.title = `Artistas con la letra ${letter} - LaCuerda Offline`;

      if (data.artists.length === 0) {
        alphabetArtistsGrid.innerHTML = '<div class="list-empty">No se encontraron artistas con esta letra</div>';
      } else {
        alphabetArtistsGrid.innerHTML = data.artists.map(art => `
          <a href="/${art.slug}" class="artist-index-card">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span class="artist-index-icon">👤</span>
              <span class="artist-index-name">${art.name}</span>
            </div>
            <span style="color: var(--text-muted); font-size: 14px;">➔</span>
          </a>
        `).join('');

        // Renderizar controles de paginación
        let paginationHtml = '';
        
        // Botón Anterior
        const prevPage = page - 1;
        const prevDisabled = page <= 1 ? 'disabled' : '';
        paginationHtml += `
          <a href="/letter/${letter}?page=${prevPage}" class="pagination-btn ${prevDisabled}" data-page="${prevPage}">
            &laquo; Anterior
          </a>
        `;

        // Info de página
        paginationHtml += `
          <span class="pagination-info">Página ${data.page} de ${data.totalPages}</span>
        `;

        // Botón Siguiente
        const nextPage = page + 1;
        const nextDisabled = page >= data.totalPages ? 'disabled' : '';
        paginationHtml += `
          <a href="/letter/${letter}?page=${nextPage}" class="pagination-btn ${nextDisabled}" data-page="${nextPage}">
            Siguiente &raquo;
          </a>
        `;

        alphabetPagination.innerHTML = paginationHtml;
      }
    } catch (error) {
      console.error(error);
      alphabetArtistsGrid.innerHTML = '<div class="list-empty">Error al cargar la lista de artistas.</div>';
    }
  }

  // --- Vista 2: Discografía del Artista (Artist) ---
  async function initArtist(artistSlug) {
    artistBreadcrumbName.textContent = 'Cargando...';
    artistTitleName.textContent = 'Cargando Artista...';
    artistCardName.textContent = '...';
    artistSongsGrid.innerHTML = '<div class="list-loading">Cargando catálogo del artista...</div>';
    artistTopSongs.innerHTML = '';

    try {
      const response = await fetch(`/api/artists/${artistSlug}`);
      if (!response.ok) throw new Error('Artista no encontrado');
      const data = await response.json();

      document.title = `Acordes de ${data.artist} - LaCuerda Offline`;
      
      // Rellenar breadcrumbs y títulos
      artistBreadcrumbName.textContent = data.artist;
      artistTitleName.textContent = data.artist;
      artistCardName.textContent = data.artist;

      // Pinta la columna de canciones
      if (data.songs.length === 0) {
        artistSongsGrid.innerHTML = '<div class="list-empty">El catálogo del artista está vacío</div>';
      } else {
        artistSongsGrid.innerHTML = data.songs.map(song => `
          <a href="/${data.slug}/${song.slug}" class="artist-song-card">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 16px;">🎵</span>
              <span class="song-card-title">${song.title}</span>
            </div>
            <div class="song-card-meta" style="display: flex; align-items: center; gap: 16px;">
              <span class="tag type-tag">${song.versions[0].type}</span>
              <span class="version-badges-count">${song.versions.length} versiones</span>
              <span style="color: var(--text-muted); font-size: 14px;">➔</span>
            </div>
          </a>
        `).join('');

        // Rellenar TOP CANCIONES (simulado con las primeras 5 canciones)
        const topSongs = data.songs.slice(0, 5);
        artistTopSongs.innerHTML = topSongs.map(song => `
          <li onclick="location.href='/${data.slug}/${song.slug}'">${song.title}</li>
        `).join('');
      }
    } catch (error) {
      console.error(error);
      artistTitleName.textContent = 'Error al cargar artista';
      artistSongsGrid.innerHTML = '<div class="list-empty">No se pudo encontrar el artista en la base de datos local.</div>';
    }
  }

  // --- Vista 3: Listado de Versiones (Song) ---
  async function initSong(artistSlug, songSlug) {
    songBreadcrumbTitle.textContent = 'Cargando...';
    songViewTitle.textContent = 'Cargando Canción...';
    songViewArtist.innerHTML = '...';
    songVersionsTableBody.innerHTML = '<tr><td colspan="5" class="list-loading">Cargando versiones disponibles...</td></tr>';

    try {
      const response = await fetch(`/api/songs/${artistSlug}/${songSlug}`);
      if (!response.ok) throw new Error('Canción no encontrada');
      const data = await response.json();

      document.title = `${data.title} de ${data.artist} - LaCuerda Offline`;

      // Rellenar Breadcrumbs y Títulos
      songBreadcrumbArtistLink.textContent = data.artist;
      songBreadcrumbArtistLink.href = `/${artistSlug}`;
      songBreadcrumbTitle.textContent = data.title;
      
      songViewTitle.textContent = data.title;
      songViewArtist.innerHTML = `de <a href="/${artistSlug}">${data.artist}</a>`;

      // Renderizar tabla de versiones
      if (data.versions.length === 0) {
        songVersionsTableBody.innerHTML = '<tr><td colspan="5" class="list-empty">No hay versiones locales guardadas</td></tr>';
      } else {
        songVersionsTableBody.innerHTML = data.versions.map(ver => {
          // Obtener nombre del archivo de la versión para el link (ej: mi_buen_amor-4.shtml)
          const urlParts = ver.source_url.split('/');
          const filename = urlParts[urlParts.length - 1]; // "mi_buen_amor-4.shtml"
          
          // Formatear acordes
          const chordBadges = ver.chords 
            ? ver.chords.split(/\s+/).slice(0, 6).map(c => `<span class="chord-badge">${c}</span>`).join('')
            : '<span class="text-muted">Ninguno</span>';

          return `
            <tr>
              <td><strong>Versión ${ver.version_number}</strong></td>
              <td><span class="tag type-tag">${ver.type}</span></td>
              <td>${ver.contributor || 'Colaborador'}</td>
              <td>${chordBadges} ${ver.chords && ver.chords.split(/\s+/).length > 6 ? '...' : ''}</td>
              <td>
                <a href="/${artistSlug}/${filename}" class="btn btn-primary btn-sm">Ver Acordes</a>
              </td>
            </tr>
          `;
        }).join('');
      }
    } catch (error) {
      console.error(error);
      songViewTitle.textContent = 'Error al cargar canción';
      songVersionsTableBody.innerHTML = '<tr><td colspan="5" class="list-empty">No se pudo encontrar el catálogo de la canción.</td></tr>';
    }
  }

  // --- Vista 4: Visualizador de Acordes (Version) ---
  async function initVersion(artistSlug, versionSlug) {
    versionBreadcrumbNumber.textContent = 'Cargando...';
    versionViewTitle.textContent = 'Cargando Acordes...';
    versionViewArtist.innerHTML = '...';
    versionContributorTag.textContent = 'Colaborador: ...';
    versionTabContent.innerHTML = 'Cargando tablatura...';
    versionChordsBox.classList.add('hidden');

    try {
      const response = await fetch(`/api/version/${artistSlug}/${versionSlug}`);
      if (!response.ok) throw new Error('Versión no encontrada');
      const song = await response.json();

      document.title = `${song.title} (v${song.version_number}) - ${song.artist}`;

      // Configurar Breadcrumbs y Títulos
      versionBreadcrumbArtistLink.textContent = song.artist;
      versionBreadcrumbArtistLink.href = `/${artistSlug}`;
      
      const songBaseSlug = getSongSlugFromUrl(song.source_url);
      versionBreadcrumbSongLink.textContent = song.title;
      versionBreadcrumbSongLink.href = `/${artistSlug}/${songBaseSlug}`;
      
      versionBreadcrumbNumber.textContent = `Versión ${song.version_number}`;
      
      versionViewTitle.textContent = song.title;
      versionViewArtist.innerHTML = `de <a href="/${artistSlug}">${song.artist}</a>`;

      // Tags y enlaces
      versionTypeTag.textContent = song.type.toUpperCase();
      versionContributorTag.textContent = `Colaborador: ${song.contributor}`;
      versionLinkOriginal.href = song.source_url;
      versionLinkWayback.href = song.archive_url;

      // Caja de acordes
      if (song.chords) {
        versionChordsBox.classList.remove('hidden');
        const chordList = song.chords.split(/\s+/).filter(c => c.length > 0);
        versionChordsList.innerHTML = chordList.map(chord => `
          <span class="chord-badge">${chord}</span>
        `).join('');
      } else {
        versionChordsBox.classList.add('hidden');
      }

      // Inyectar preformateado y resaltar acordes
      const highlighted = highlightChords(song.content, song.chords);
      versionTabContent.innerHTML = highlighted;

    } catch (error) {
      console.error(error);
      versionViewTitle.textContent = 'Error al cargar tablatura';
      versionTabContent.innerHTML = 'No se pudo descargar o localizar la versión clásica especificada.';
    }
  }

  // --- Lógica de Resaltado de Acordes en la Letra ---
  function highlightChords(content, chordsStr) {
    if (!chordsStr) return escapeHtml(content);

    // Separar acordes por espacio y ordenarlos por longitud descendente
    const chordList = chordsStr.split(/\s+/).filter(c => c.length > 0);
    if (chordList.length === 0) return escapeHtml(content);
    
    chordList.sort((a, b) => b.length - a.length);

    const escapedChords = chordList.map(c => c.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));

    const lines = content.split('\n');
    const highlightedLines = lines.map(line => {
      // Líneas de diagramas de trastes las pintamos en cursiva/atenuadas
      if (line.includes('|') || line.includes('--')) {
        return `<em>${escapeHtml(line)}</em>`;
      }

      let escapedLine = escapeHtml(line);

      // Regex para resaltar acordes
      const pattern = new RegExp(`(?<=^|\\s|[-|/])(${escapedChords.join('|')})(?=$|\\s|[-|/])`, 'g');
      return escapedLine.replace(pattern, '<a>$1</a>');
    });

    return highlightedLines.join('\n');
  }

  // Escapar caracteres HTML para inyección segura
  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ==========================================================================
  // BUSCADOR EN LA CABECERA (GLOBAL SEARCH)
  // ==========================================================================
  headerSearchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearTimeout(searchTimeout);
    
    if (query.length < 2) return;

    searchTimeout = setTimeout(() => {
      // Redirigir a Home, rellenar el buscador de home con la query, y disparar búsqueda
      history.pushState(null, '', '/');
      showView('home');
      homeSearchInput.value = query;
      
      // Simular input event en home
      const event = new Event('input', { bubbles: true });
      homeSearchInput.dispatchEvent(event);
    }, 300);
  });

  // ==========================================================================
  // CONTROLES DE VISUALIZADOR (AUTOSCROLL & FONT RESIZER)
  // ==========================================================================

  // Tamaño de letra
  fontSizeSlider.addEventListener('input', (e) => {
    const size = e.target.value;
    fontSizeLabel.textContent = `${size}px`;
    document.documentElement.style.setProperty('--tab-font-size', `${size}px`);
  });

  // Autoscroll
  function startAutoscroll() {
    isScrolling = true;
    btnAutoscroll.classList.add('active');
    btnAutoscroll.querySelector('.btn-icon').textContent = '■';
    btnAutoscroll.querySelector('.btn-text').textContent = 'Pausar';

    function scrollStep() {
      if (!isScrolling) return;

      const pxPerFrame = (scrollSpeed * 0.08); 
      mainContentContainer.scrollTop += pxPerFrame;

      const currentScrollTop = mainContentContainer.scrollTop;
      const reachedBottom = mainContentContainer.scrollHeight - mainContentContainer.clientHeight <= currentScrollTop + 1;

      if (reachedBottom) {
        stopAutoscroll();
        return;
      }

      requestAnimationFrame(scrollStep);
    }

    requestAnimationFrame(scrollStep);
  }

  function stopAutoscroll() {
    isScrolling = false;
    btnAutoscroll.classList.remove('active');
    btnAutoscroll.querySelector('.btn-icon').textContent = '▶';
    btnAutoscroll.querySelector('.btn-text').textContent = 'Autoscroll';
  }

  btnAutoscroll.addEventListener('click', () => {
    if (isScrolling) {
      stopAutoscroll();
    } else {
      startAutoscroll();
    }
  });

  scrollSpeedSlider.addEventListener('input', (e) => {
    scrollSpeed = parseInt(e.target.value, 10);
    scrollSpeedLabel.textContent = `x${scrollSpeed}`;
  });

  // --- Utilidades de normalización ---
  
  // Clonación de slugify en cliente
  function slugify(text) {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  // Obtiene el slug de la canción a partir de la URL
  function getSongSlugFromUrl(url) {
    const parts = url.split('/');
    const lastPart = parts[parts.length - 1];
    return lastPart.replace(/-\d+\.shtml$/, '').replace(/\.shtml$/, '');
  }

  // --- Carga Inicial ---
  navigate();
});

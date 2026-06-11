document.addEventListener('DOMContentLoaded', () => {
  // --- Elementos del DOM ---
  const searchInput = document.getElementById('search-input');
  const songsList = document.getElementById('songs-list');
  const songsCount = document.getElementById('songs-count');
  
  const viewerContainer = document.getElementById('viewer-container');
  const emptyState = document.getElementById('empty-state');
  const songViewer = document.getElementById('song-viewer');
  
  const songTitle = document.getElementById('song-title');
  const songArtist = document.getElementById('song-artist');
  const songTypeTag = document.getElementById('song-type-tag');
  const songVersionTag = document.getElementById('song-version-tag');
  
  const linkOriginal = document.getElementById('link-original');
  const linkWayback = document.getElementById('link-wayback');
  
  const fontSizeSlider = document.getElementById('font-size-slider');
  const fontSizeLabel = document.getElementById('font-size-label');
  
  const btnAutoscroll = document.getElementById('btn-autoscroll');
  const scrollSpeedSlider = document.getElementById('scroll-speed-slider');
  const scrollSpeedLabel = document.getElementById('scroll-speed-label');
  
  const songChordsBox = document.getElementById('song-chords-box');
  const songChordsList = document.getElementById('song-chords-list');
  const tabContent = document.getElementById('tab-content');

  // --- Estado de la aplicación ---
  let activeSongId = null;
  let isScrolling = false;
  let scrollIntervalId = null;
  let scrollSpeed = 3; // Valor inicial del slider
  let lastScrollTop = 0;

  // --- Cargar Catálogo de Canciones ---
  async function loadSongs(query = '') {
    try {
      const response = await fetch(`/api/songs?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Error al cargar catálogo');
      
      const songs = await response.json();
      songsCount.textContent = songs.length;
      
      if (songs.length === 0) {
        songsList.innerHTML = '<div class="list-empty">No se encontraron canciones</div>';
        return;
      }
      
      songsList.innerHTML = songs.map(song => `
        <div class="song-item ${song.id === activeSongId ? 'active' : ''}" data-id="${song.id}">
          <span class="song-item-title">${song.title}</span>
          <span class="song-item-artist">${song.artist}</span>
          <div class="song-item-footer">
            <span class="tag type-tag">${song.type}</span>
            <span class="tag version-tag">V${song.version_number}</span>
          </div>
        </div>
      `).join('');
      
      // Agregar event listeners a cada tarjeta de canción
      document.querySelectorAll('.song-item').forEach(item => {
        item.addEventListener('click', () => {
          const id = parseInt(item.getAttribute('data-id'), 10);
          selectSong(id);
        });
      });
    } catch (error) {
      console.error(error);
      songsList.innerHTML = '<div class="list-empty">Error de conexión con el servidor</div>';
    }
  }

  // --- Seleccionar y Mostrar una Canción ---
  async function selectSong(id) {
    if (isScrolling) stopAutoscroll();
    
    activeSongId = id;
    
    // Resaltar elemento activo en el sidebar
    document.querySelectorAll('.song-item').forEach(item => {
      const itemId = parseInt(item.getAttribute('data-id'), 10);
      if (itemId === id) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    try {
      const response = await fetch(`/api/songs/${id}`);
      if (!response.ok) throw new Error('Error al cargar canción');
      
      const song = await response.json();
      renderSong(song);
    } catch (error) {
      console.error(error);
      alert('No se pudo cargar la tablatura seleccionada.');
    }
  }

  // --- Renderizar Canción en el Visor ---
  function renderSong(song) {
    // Cambiar visibilidad de estados
    emptyState.classList.add('hidden');
    songViewer.classList.remove('hidden');
    
    // Resetear scroll del visualizador al inicio
    viewerContainer.scrollTop = 0;

    // Llenar metadatos
    songTitle.textContent = song.title;
    songArtist.textContent = song.artist;
    songTypeTag.textContent = song.type.toUpperCase();
    songVersionTag.textContent = `Versión ${song.version_number}`;
    
    // Configurar enlaces externos
    linkOriginal.href = song.source_url;
    linkWayback.href = song.archive_url;

    // Renderizar caja de acordes recomendados
    if (song.chords) {
      songChordsBox.classList.remove('hidden');
      const chordList = song.chords.split(/\s+/).filter(c => c.length > 0);
      songChordsList.innerHTML = chordList.map(chord => `
        <span class="chord-badge">${chord}</span>
      `).join('');
    } else {
      songChordsBox.classList.add('hidden');
    }

    // Inyectar contenido formateando y resaltando los acordes en el pre
    const highlightedContent = highlightChords(song.content, song.chords);
    tabContent.innerHTML = highlightedContent;
  }

  // --- Lógica de Resaltado de Acordes ---
  function highlightChords(content, chordsStr) {
    if (!chordsStr) return escapeHtml(content);

    // Separar acordes por espacio y ordenarlos por longitud descendente
    // (evita que se reemplace 'C' dentro de 'C#m')
    const chordList = chordsStr.split(/\s+/).filter(c => c.length > 0);
    if (chordList.length === 0) return escapeHtml(content);
    
    chordList.sort((a, b) => b.length - a.length);

    // Escapar caracteres regex especiales
    const escapedChords = chordList.map(c => c.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));

    const lines = content.split('\n');
    const highlightedLines = lines.map(line => {
      // Si la línea es una línea de diagramas de acordes (contiene pipes o guiones seguidos)
      // la dejamos intacta pero con etiquetas de cursiva para estilo
      if (line.includes('|') || line.includes('--')) {
        return `<em>${escapeHtml(line)}</em>`;
      }

      // Escapar HTML básico de la línea primero
      let escapedLine = escapeHtml(line);

      // Regex para encontrar los acordes:
      // Deben estar antecedidos por inicio de línea, espacio, guion, pipe o diagonal,
      // y seguidos por fin de línea, espacio, guion, pipe o diagonal.
      const pattern = new RegExp(`(?<=^|\\s|[-|/])(${escapedChords.join('|')})(?=$|\\s|[-|/])`, 'g');
      
      return escapedLine.replace(pattern, '<a>$1</a>');
    });

    return highlightedLines.join('\n');
  }

  // Utilidad de escape de caracteres HTML
  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // --- Lógica de Tamaño de Letra ---
  fontSizeSlider.addEventListener('input', (e) => {
    const size = e.target.value;
    fontSizeLabel.textContent = `${size}px`;
    document.documentElement.style.setProperty('--tab-font-size', `${size}px`);
  });

  // --- Lógica de Autoscroll ---
  function startAutoscroll() {
    isScrolling = true;
    btnAutoscroll.classList.add('active');
    btnAutoscroll.querySelector('.btn-icon').textContent = '■';
    btnAutoscroll.querySelector('.btn-text').textContent = 'Pausar';
    
    lastScrollTop = viewerContainer.scrollTop;

    // Loop de scroll suave usando requestAnimationFrame
    function scrollStep() {
      if (!isScrolling) return;

      // Calcular velocidad de scroll incremental por cuadro
      // (a mayor velocidad seleccionada, se desplaza más pixeles)
      const pxPerFrame = (scrollSpeed * 0.08); 
      viewerContainer.scrollTop += pxPerFrame;

      // Si el scroll manual del usuario cambió significativamente el scrollTop,
      // o si llegamos al final del scrollable, detenemos el autoscroll
      const currentScrollTop = viewerContainer.scrollTop;
      const reachedBottom = viewerContainer.scrollHeight - viewerContainer.clientHeight <= currentScrollTop + 1;

      if (reachedBottom) {
        stopAutoscroll();
        return;
      }

      lastScrollTop = currentScrollTop;
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

  // --- Buscador Dinámico ---
  let searchTimeout = null;
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value;
    
    // Debounce de 300ms para evitar peticiones en cada caracter
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      loadSongs(query);
    }, 300);
  });

  // --- Inicialización ---
  loadSongs();
});

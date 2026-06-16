import React, { useEffect, useState } from 'react';
import useAuthStore from '../../store/useAuthStore.js';
import useUIStore from '../../store/useUIStore.js';
import { useLogoutMutation } from '../../hooks/useAuth.js';

export default function Header({ cleanPath, showHeaderSearch, initialQuery = '', onNavigate }) {
  const user = useAuthStore((state) => state.user);
  const setAuthModalOpen = useUIStore((state) => state.setAuthModalOpen);
  const logoutMutation = useLogoutMutation();
  
  const [headerQuery, setHeaderQuery] = useState(initialQuery);

  // Sincroniza la consulta con la URL cuando cambia el parámetro
  useEffect(() => {
    setHeaderQuery(initialQuery);
  }, [initialQuery]);

  const handleHeaderSearchInput = (e) => {
    const value = e.target.value;
    setHeaderQuery(value);
    
    // Notifica el cambio de búsqueda y redirige a la raíz de la SPA
    const searchStr = value.trim() ? `?q=${encodeURIComponent(value.trim())}` : '';
    window.history.pushState(null, '', `/${searchStr}`);
    onNavigate('/', searchStr);
  };

  const handleLogoClick = () => {
    setHeaderQuery('');
    window.history.pushState(null, '', '/');
    onNavigate('/', '');
  };

  const handleLogout = () => {
    logoutMutation.mutate();
    handleLogoClick();
  };

  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div className="header-logo" onClick={handleLogoClick} style={{ cursor: 'pointer' }}>
          <span className="logo-icon">🎸</span>
          <h1>LaCuerda <span>Offline</span></h1>
        </div>
        <nav className="header-nav">
          <a href="/catalog" className={`nav-link ${cleanPath === 'catalog' ? 'active' : ''}`}>
            Biblioteca
          </a>
          {user && (
            <a href="/favorites" className={`nav-link ${cleanPath === 'favorites' ? 'active' : ''}`} style={{ color: 'var(--chord-color)', fontWeight: '600' }}>
              Favoritos ❤️
            </a>
          )}
        </nav>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Buscador de Cabecera (oculto en la Portada) */}
        <div className={`header-search-container ${showHeaderSearch ? '' : 'hidden'}`}>
          <input
            type="text"
            placeholder="Buscar artista o canción..."
            autoComplete="off"
            value={headerQuery}
            onChange={handleHeaderSearchInput}
          />
          <span className="search-icon">🔍</span>
        </div>

        {/* Sección de usuario */}
        <div className="header-user-section">
          {user ? (
            <div className="user-profile-menu">
              <span className="user-nickname-pill">
                👤 {user.username}
              </span>
              <button onClick={handleLogout} className="logout-btn" disabled={logoutMutation.isPending}>
                {logoutMutation.isPending ? 'Cerrando...' : 'Cerrar Sesión'}
              </button>
            </div>
          ) : (
            <button onClick={() => setAuthModalOpen(true)} className="login-btn">
              Acceder
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

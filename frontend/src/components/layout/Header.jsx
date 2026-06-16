import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore.js';
import useUIStore from '../../store/useUIStore.js';
import { useLogoutMutation } from '../../hooks/useAuth.js';

export default function Header({ cleanPath, showHeaderSearch }) {
  const user = useAuthStore((state) => state.user);
  const setAuthModalOpen = useUIStore((state) => state.setAuthModalOpen);
  const logoutMutation = useLogoutMutation();
  const navigate = useNavigate();
  const location = useLocation();

  // Derivar la query de búsqueda inicial desde la URL al montar o cambiar de ruta
  const searchParams = new URLSearchParams(location.search);
  const [headerQuery, setHeaderQuery] = useState(searchParams.get('q') || '');

  // Sincronizar el input cuando la ruta cambia (ej. al navegar atrás/adelante)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setHeaderQuery(params.get('q') || '');
  }, [location.search]);

  const handleHeaderSearchInput = (e) => {
    const value = e.target.value;
    setHeaderQuery(value);

    // Navegar silenciosamente a la portada con el query param actualizado
    const searchStr = value.trim() ? `?q=${encodeURIComponent(value.trim())}` : '';
    navigate(`/${searchStr}`, { replace: true });
  };

  const handleLogoClick = () => {
    setHeaderQuery('');
    navigate('/');
  };

  const handleLogout = () => {
    logoutMutation.mutate();
    setHeaderQuery('');
    navigate('/');
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

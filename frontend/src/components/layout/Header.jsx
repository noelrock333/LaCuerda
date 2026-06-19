import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore.js';
import useUIStore from '../../store/useUIStore.js';
import { useLogoutMutation } from '../../hooks/useAuth.js';

export default function Header({ cleanPath, showHeaderSearch }) {
  const user = useAuthStore((state) => state.user);
  const setAuthModalOpen = useUIStore((state) => state.setAuthModalOpen);
  const setImportModalOpen = useUIStore((state) => state.setImportModalOpen);
  const logoutMutation = useLogoutMutation();
  const navigate = useNavigate();
  const location = useLocation();

  const isAdminOrMod = user && (user.role === 'admin' || user.role === 'moderator');

  // Estado del menú hamburguesa
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const drawerRef = useRef(null);

  // Derivar la query de búsqueda inicial desde la URL al montar o cambiar de ruta
  const searchParams = new URLSearchParams(location.search);
  const [headerQuery, setHeaderQuery] = useState(searchParams.get('q') || '');

  // Cerrar el menú cuando la ruta cambia
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Sincronizar el input cuando la ruta cambia (ej. al navegar atrás/adelante)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setHeaderQuery(params.get('q') || '');
  }, [location.search]);

  // Cerrar el menú al hacer click fuera
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleClickOutside = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileMenuOpen]);

  const handleHeaderSearchInput = (e) => {
    const value = e.target.value;
    setHeaderQuery(value);
    const searchStr = value.trim() ? `?q=${encodeURIComponent(value.trim())}` : '';
    navigate(`/${searchStr}`, { replace: true });
  };

  const handleLogoClick = () => {
    setHeaderQuery('');
    setMobileMenuOpen(false);
    navigate('/');
  };

  const handleLogout = () => {
    logoutMutation.mutate();
    setHeaderQuery('');
    setMobileMenuOpen(false);
    navigate('/');
  };

  return (
    <>
      <header className="app-header" ref={drawerRef}>
        {/* ── Lado izquierdo: logo + nav (desktop) ── */}
        <div className="header-left">
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
            {isAdminOrMod && (
              <button
                type="button"
                className="nav-link import-nav-btn"
                onClick={() => setImportModalOpen(true)}
              >
                Importar
              </button>
            )}
          </nav>
        </div>

        {/* ── Lado derecho: buscador + usuario (desktop) ── */}
        <div className="header-right">
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

        {/* ── Botón hamburguesa (solo móvil) ── */}
        <button
          className={`hamburger-btn ${mobileMenuOpen ? 'open' : ''}`}
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-label="Menú"
          aria-expanded={mobileMenuOpen}
        >
          <span className="hamburger-line" />
          <span className="hamburger-line" />
          <span className="hamburger-line" />
        </button>

        {/* ── Drawer móvil ── */}
        <div className={`mobile-menu-drawer ${mobileMenuOpen ? 'open' : ''}`}>
          {/* Buscador en el drawer (solo si aplica) */}
          {showHeaderSearch && (
            <div className="mobile-menu-search">
              <div className="header-search-container" style={{ width: '100%' }}>
                <input
                  type="text"
                  placeholder="Buscar artista o canción..."
                  autoComplete="off"
                  value={headerQuery}
                  onChange={handleHeaderSearchInput}
                />
                <span className="search-icon">🔍</span>
              </div>
            </div>
          )}

          {/* Links de navegación */}
          <nav className="mobile-menu-nav">
            <a
              href="/"
              className={`mobile-nav-link ${cleanPath === '' || cleanPath === 'home' ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              🏠 Portada
            </a>
            <a
              href="/catalog"
              className={`mobile-nav-link ${cleanPath === 'catalog' ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              📚 Biblioteca
            </a>
            {user && (
              <a
                href="/favorites"
                className={`mobile-nav-link favorites ${cleanPath === 'favorites' ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                ❤️ Favoritos
              </a>
            )}
            {isAdminOrMod && (
              <button
                type="button"
                className="mobile-nav-link"
                onClick={() => { setImportModalOpen(true); setMobileMenuOpen(false); }}
              >
                📥 Importar canción
              </button>
            )}
          </nav>

          {/* Sección de usuario en el drawer */}
          <div className="mobile-menu-user">
            {user ? (
              <>
                <div className="mobile-menu-username">
                  👤 <strong>{user.username}</strong>
                </div>
                <button
                  onClick={handleLogout}
                  className="mobile-logout-btn"
                  disabled={logoutMutation.isPending}
                >
                  {logoutMutation.isPending ? 'Cerrando...' : 'Cerrar Sesión'}
                </button>
              </>
            ) : (
              <button
                onClick={() => { setAuthModalOpen(true); setMobileMenuOpen(false); }}
                className="mobile-login-btn"
              >
                🔐 Acceder a tu cuenta
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Overlay oscuro detrás del drawer */}
      {mobileMenuOpen && (
        <div
          className="mobile-menu-overlay"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </>
  );
}

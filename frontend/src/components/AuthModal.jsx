import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import useUIStore from '../store/useUIStore.js';
import { useLoginMutation, useRegisterMutation } from '../hooks/useAuth.js';

export default function AuthModal() {
  const isOpen = useUIStore((state) => state.isAuthModalOpen);
  const setAuthModalOpen = useUIStore((state) => state.setAuthModalOpen);
  
  const loginMutation = useLoginMutation();
  const registerMutation = useRegisterMutation();

  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleClose = () => {
    setAuthModalOpen(false);
    setUsername('');
    setPassword('');
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const mutation = isLogin ? loginMutation : registerMutation;
    
    mutation.mutate({ username, password }, {
      onSuccess: () => {
        handleClose();
      },
      onError: (err) => {
        setError(err.message || 'Algo salió mal');
      }
    });
  };

  const handleToggleMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setUsername('');
    setPassword('');
  };

  const loading = loginMutation.isPending || registerMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="auth-modal-content">
        <DialogHeader className="auth-modal-header">
          <DialogTitle className="auth-modal-title">
            {isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </DialogTitle>
          <DialogDescription className="auth-modal-description">
            {isLogin
               ? 'Accede para ver y guardar tus tablaturas favoritas'
               : 'Regístrate para empezar a guardar tus tablaturas'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="auth-modal-error">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-modal-form">
          <div className="auth-input-group">
            <label className="auth-input-label">Nombre de usuario</label>
            <input
              type="text"
              required
              disabled={loading}
              placeholder="e.g. noelrock333"
              className="auth-input-field"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="auth-input-group">
            <label className="auth-input-label">Contraseña</label>
            <input
              type="password"
              required
              disabled={loading}
              placeholder="••••••••"
              className="auth-input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="auth-submit-btn"
          >
            {loading ? (
              <span className="auth-spinner"></span>
            ) : isLogin ? (
              'Ingresar'
            ) : (
              'Registrarse'
            )}
          </button>
        </form>

        <div className="auth-modal-footer">
          <button
            type="button"
            onClick={handleToggleMode}
            className="auth-toggle-btn"
            disabled={loading}
          >
            {isLogin
              ? '¿No tienes cuenta? Regístrate aquí'
              : '¿Ya tienes una cuenta? Inicia sesión'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

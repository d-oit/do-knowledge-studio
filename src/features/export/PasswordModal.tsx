import React, { useState, useRef, useEffect } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import Overlay from '../../components/Overlay';

interface PasswordState {
  password: string;
  confirmPassword: string;
  showPassword: boolean;
  error: string;
}

const INITIAL_STATE: PasswordState = { password: '', confirmPassword: '', showPassword: false, error: '' };

interface PasswordModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  onConfirm: (password: string) => void;
  onCancel: () => void;
  minLength?: number;
}

const PasswordModal: React.FC<PasswordModalProps> = ({
  isOpen,
  title,
  description,
  onConfirm,
  onCancel,
  minLength = 8,
}) => {
  const [state, setState] = useState<PasswordState>(INITIAL_STATE);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = () => {
    setState(prev => ({ ...prev, error: '' }));

    if (state.password.length < minLength) {
      setState(prev => ({ ...prev, error: `Password must be at least ${minLength} characters` }));
      return;
    }

    if (state.password !== state.confirmPassword) {
      setState(prev => ({ ...prev, error: 'Passwords do not match' }));
      return;
    }

    onConfirm(state.password);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && state.password && state.confirmPassword) {
      handleSubmit();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <Overlay key={isOpen ? 'open' : 'closed'} isOpen={isOpen} onClose={onCancel} variant="center" ariaLabel={title}>
      <div style={{ padding: '8px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Lock size={20} style={{ color: 'var(--interactive-primary)' }} />
          <h3 style={{ margin: 0 }}>{title}</h3>
        </div>

        {description && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
            {description}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label htmlFor="password-input" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                ref={inputRef}
                id="password-input"
                type={state.showPassword ? 'text' : 'password'}
                value={state.password}
                onChange={e => { setState(prev => ({ ...prev, password: e.target.value, error: '' })); }}
                onKeyDown={handleKeyDown}
                placeholder={`At least ${minLength} characters`}
                style={{ width: '100%', padding: '8px 36px 8px 8px', borderRadius: '6px', border: '1px solid var(--border-default)', fontSize: '14px', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
              />
              <button
                type="button"
                onClick={() => { setState(prev => ({ ...prev, showPassword: !prev.showPassword })); }}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}
                aria-label={state.showPassword ? 'Hide password' : 'Show password'}
              >
                {state.showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirm-password-input" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>
              Confirm Password
            </label>
            <input
              id="confirm-password-input"
              type={state.showPassword ? 'text' : 'password'}
              value={state.confirmPassword}
              onChange={e => { setState(prev => ({ ...prev, confirmPassword: e.target.value, error: '' })); }}
              onKeyDown={handleKeyDown}
              placeholder="Re-enter password"
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-default)', fontSize: '14px', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
            />
          </div>

          {state.error && (
            <div style={{ fontSize: '13px', color: 'var(--status-danger)', padding: '6px 10px', background: 'var(--status-danger-bg)', borderRadius: '6px' }}>
              {state.error}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <button type="button" onClick={onCancel} className="btn-secondary" style={{ flex: 1 }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="primary"
            style={{ flex: 1 }}
            disabled={!state.password || !state.confirmPassword}
          >
            Encrypt & Export
          </button>
        </div>
      </div>
    </Overlay>
  );
};

export default PasswordModal;

import React, { useState } from 'react';
import { Lock, Eye, EyeOff, KeyRound, AlertCircle } from 'lucide-react';
import type { ShareStatus } from '../types';
import GradientWaves from './GradientWaves';
import CodeSlots from './CodeSlots';

interface LoginViewProps {
  password: string;
  setPassword: (val: string) => void;
  handleLogin: (e: React.FormEvent) => void;
  loginError: string;
  isSubmittingLogin: boolean;
  status: ShareStatus | null;
}

export const LoginView: React.FC<LoginViewProps> = ({
  password,
  setPassword,
  handleLogin,
  loginError,
  isSubmittingLogin
}) => {
  const [isMasked, setIsMasked] = useState<boolean>(true);
  const [useFreeform, setUseFreeform] = useState<boolean>(false);
  const [slotCount, setSlotCount] = useState<number>(6);

  // Auto-adapt slot length if typed/pasted password exceeds slot count
  const effectiveLength = Math.max(slotCount, Math.min(password.length, 16) || slotCount);

  return (
    <div id="login-container">
      {/* Dynamic 3D WebGL Raymarched Wave Background */}
      <div id="login-waves-bg" aria-hidden="true">
        <GradientWaves
          horizonColor="#2e1065"
          waveColor="#0284c7"
          crestColor="#e0e7ff"
          speed={0.35}
          amplitude={2.5}
          waveScale={0.62}
          waveRatio={0.92}
          swell={32}
          turbulence={18}
          tilt={1.12}
          zoom={1.0}
          height={5.4}
          fogDepth={18}
          detail="medium"
          brightness={1.05}
          opacity={0.9}
          mouseInteraction={true}
          parallaxStrength={0.55}
          grain={true}
          grainIntensity={0.035}
        />
      </div>

      {/* Subtle depth vignette scrim */}
      <div id="login-scrim" aria-hidden="true" />

      {/* Floating Frosted Glass Card Container */}
      <div id="login-content-wrapper">
        <section className="auth-card" id="auth-card">
          <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <Lock className="w-3.5 h-3.5" style={{ color: 'var(--accent, #38bdf8)' }} />
            <span>PROTECTED WORKSPACE</span>
          </div>

          <h1 style={{ textAlign: 'center', fontSize: '28px', marginTop: '6px' }}>Private file access</h1>
          <p className="muted" style={{ textAlign: 'center', fontSize: '13px', marginTop: '8px' }}>
            Enter the session password to unlock and access shared files.
          </p>

          <form onSubmit={handleLogin} className="auth-form" id="auth-form" style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
              <label htmlFor="password" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                <KeyRound className="w-3.5 h-3.5" style={{ color: 'var(--accent, #38bdf8)' }} />
                <span>Password Code</span>
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {!useFreeform && (
                  <>
                    <button
                      type="button"
                      onClick={() => setSlotCount((prev) => (prev === 6 ? 8 : prev === 8 ? 12 : 6))}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: 'var(--muted)',
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                      title="Adjust number of animated slots"
                    >
                      {effectiveLength} slots
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsMasked((prev) => !prev)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: isMasked ? 'var(--muted)' : 'var(--accent, #38bdf8)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        padding: '2px 4px'
                      }}
                      title={isMasked ? 'Show password characters' : 'Mask password'}
                    >
                      {isMasked ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      <span>{isMasked ? 'Show' : 'Mask'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Password Entry Area: Animated CodeSlots vs Freeform fallback */}
            {!useFreeform ? (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '16px 8px',
                  borderRadius: '14px',
                  backgroundColor: 'rgba(0, 0, 0, 0.35)',
                  border: loginError ? '1px solid rgba(248, 113, 113, 0.5)' : '1px solid rgba(255, 255, 255, 0.09)',
                  transition: 'border-color 0.2s ease'
                }}
              >
                <CodeSlots
                  length={effectiveLength}
                  value={password}
                  onChange={(val) => setPassword(val)}
                  onComplete={() => {
                    // Automatically focus submit readiness
                  }}
                  status={loginError ? 'error' : isSubmittingLogin ? 'idle' : 'idle'}
                  mask={isMasked}
                  caret={true}
                  disabled={isSubmittingLogin}
                  autoFocus={true}
                  accentColor="var(--accent, #38bdf8)"
                  inkColor="#ffffff"
                  slotColor="rgba(255, 255, 255, 0.08)"
                  digitColor="#ffffff"
                  dangerColor="#f87171"
                  slotSize={effectiveLength > 8 ? 36 : 44}
                  gap={effectiveLength > 8 ? 6 : 8}
                  radius={12}
                  bounce={0.25}
                  settle={0.3}
                  ariaLabel="Workspace Access Password"
                />
              </div>
            ) : (
              <input
                id="password"
                name="password"
                type={isMasked ? 'password' : 'text'}
                autoComplete="current-password"
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmittingLogin}
                placeholder="Enter workspace password"
                style={{
                  width: '100%',
                  padding: '13px 14px',
                  border: '1px solid var(--border)',
                  borderRadius: '11px',
                  background: '#090b0e',
                  color: 'var(--text)',
                  outline: 'none'
                }}
              />
            )}

            {loginError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  color: '#f87171',
                  backgroundColor: 'rgba(248, 113, 113, 0.1)',
                  border: '1px solid rgba(248, 113, 113, 0.25)',
                  padding: '9px 12px',
                  borderRadius: '9px',
                  fontSize: '12px'
                }}
              >
                <AlertCircle className="w-4 h-4" style={{ flexShrink: 0 }} />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmittingLogin || !password.trim()}
              style={{
                marginTop: '6px',
                padding: '13px 18px',
                borderRadius: '11px',
                backgroundColor: 'var(--accent, #38bdf8)',
                color: '#090b0e',
                border: 'none',
                fontWeight: 800,
                fontSize: '14px',
                cursor: isSubmittingLogin || !password.trim() ? 'not-allowed' : 'pointer',
                opacity: isSubmittingLogin || !password.trim() ? 0.6 : 1,
                transition: 'all 0.18s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {isSubmittingLogin ? (
                <>
                  <span
                    style={{
                      width: '14px',
                      height: '14px',
                      border: '2px solid rgba(0, 0, 0, 0.2)',
                      borderTopColor: '#000',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                      display: 'inline-block'
                    }}
                  />
                  <span>Unlocking session…</span>
                </>
              ) : (
                <span>Unlock workspace</span>
              )}
            </button>

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => setUseFreeform((prev) => !prev)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: '4px'
                }}
              >
                {useFreeform ? 'Switch to animated code slots' : 'Switch to standard text field'}
              </button>
            </div>
          </form>

          <div
            style={{
              marginTop: '20px',
              padding: '12px 14px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              fontSize: '11px',
              color: 'var(--muted)',
              textAlign: 'center',
              lineHeight: 1.5
            }}
          >
            Encrypted session &middot; Configurable via <code>SHARE_PASSWORD</code> in server config
          </div>
        </section>

        <footer
          className="fs-footer"
          style={{
            marginTop: '24px',
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            color: 'rgba(255, 255, 255, 0.45)'
          }}
        >
          <div className="fs-footer-note" style={{ color: 'rgba(255, 255, 255, 0.45)' }}>
            Temporary workspace file storage
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.35)' }}>
              Interactive WebGL &amp; Motion
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default LoginView;

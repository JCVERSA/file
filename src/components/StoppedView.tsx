import React from 'react';
import type { ShareStatus } from '../types';

interface StoppedViewProps {
  status: ShareStatus | null;
  onRestart: () => void;
}

export const StoppedView: React.FC<StoppedViewProps> = ({ status, onRestart }) => {
  return (
    <div id="stopped-container">
      <section className="auth-card" style={{ textAlign: 'center', marginTop: '64px' }}>
        <div className="eyebrow" style={{ color: 'var(--danger)' }}>SHARE CLOSED</div>
        <h1>Public link inactive</h1>
        <p className="muted" style={{ margin: '14px 0 24px' }}>
          The sharing session has ended.<br />
          Reason: <strong style={{ color: 'var(--text)' }}>{status?.stop_reason || 'stopped'}</strong>.
        </p>
        <button
          type="button"
          className="primary"
          onClick={onRestart}
          style={{ width: '100%', padding: '12px', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}
        >
          Restart File Share
        </button>
        {status && status.is_owner === false && (
          <p className="muted" style={{ marginTop: '12px' }}>
            Only the share owner can restart the share.
          </p>
        )}
      </section>
    </div>
  );
};

import React, { useState } from 'react';
import { Lock, Copy, Check, Sparkles } from 'lucide-react';
import type { ShareStatus } from '../types';

interface ShareHeaderProps {
  filesCount: number;
  status: ShareStatus | null;
  shareUrl: string;
  remainingText: string;
  copiedText: string;
  showQr: boolean;
  setShowQr: (val: boolean) => void;
  onCopyLink: () => void;
  onLogout: (e: React.FormEvent) => void;
  onStopShare: () => void;
  onOpenSmopi?: () => void;
  extraActions?: React.ReactNode;
}

export const ShareHeader: React.FC<ShareHeaderProps> = ({
  filesCount,
  status,
  shareUrl,
  remainingText,
  copiedText,
  showQr,
  setShowQr,
  onCopyLink,
  onLogout,
  onStopShare,
  onOpenSmopi,
  extraActions
}) => {
  const [copiedPassword, setCopiedPassword] = useState(false);

  const handleCopyPassword = () => {
    if (!status?.share_password) return;
    navigator.clipboard.writeText(status.share_password);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 1500);
  };

  return (
    <>
      <div className="hero fs-hero" id="dashboard-hero">
        <div className="fs-hero-copy">
          <div className="eyebrow">
            {status?.one_time ? 'One-time download' : 'Temporary access'}
          </div>
          <div className="fs-title-row">
            <h1>Available files</h1>
            <span className="fs-online">
              <span className="status-dot" aria-hidden="true"></span> ONLINE
            </span>
          </div>
          <p className="muted">
            {filesCount} file{filesCount !== 1 ? 's' : ''} &middot; secure workspace share
          </p>
        </div>
        <div className="fs-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {extraActions}
          {onOpenSmopi && (
            <button
              type="button"
              className="ghost"
              onClick={onOpenSmopi}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: '#d8b4fe',
                backgroundColor: 'rgba(192, 132, 252, 0.12)',
                border: '1px solid rgba(192, 132, 252, 0.35)',
                fontWeight: 600,
                padding: '6px 12px',
                borderRadius: '8px',
                boxShadow: '0 0 12px rgba(192, 132, 252, 0.2)'
              }}
            >
              <Sparkles className="w-3.5 h-3.5 animate-pulse text-purple-300" />
              <span>Smopi AI</span>
            </button>
          )}
          <form onSubmit={onLogout}>
            <button className="ghost fs-lock-btn" type="submit" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Lock className="w-3.5 h-3.5" />
              <span>Lock</span>
            </button>
          </form>
          <button
            id="stopShare"
            className="button fs-stop-btn"
            type="button"
            aria-label="Stop sharing"
            onClick={onStopShare}
          >
            <span className="fs-stop-icon" aria-hidden="true">&times;</span>
            <span>Stop share</span>
          </button>
        </div>
      </div>

      {/* Public Share URL Card */}
      <div className="fs-share-card" id="share-card">
        <div className="fs-share-copy">
          <div className="eyebrow">PUBLIC LINK</div>
          <div className="fs-share-url" title={shareUrl}>{shareUrl}</div>
          <div className="fs-share-meta">
            <span id="shareState">{remainingText}</span>
            <span aria-hidden="true">&middot;</span>
            <span id="statsText">
              {status?.downloads_total || 0} download{status?.downloads_total !== 1 ? 's' : ''} &middot; {status?.bytes_total_human || '0 B'} transferred
              {status?.active_downloads ? ` &middot; ${status.active_downloads} active` : ''}
            </span>
          </div>
          {status?.share_password && (
            <div style={{
              marginTop: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              width: 'fit-content'
            }}>
              <span className="eyebrow" style={{ margin: 0, fontSize: '10px' }}>SHARE PASSWORD:</span>
              <code style={{ color: 'var(--accent)', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '13px', letterSpacing: '0.05em' }}>
                {status.share_password}
              </code>
              <button
                type="button"
                onClick={handleCopyPassword}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: copiedPassword ? '#34C759' : 'var(--text-muted)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 6px'
                }}
              >
                {copiedPassword ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedPassword ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          )}
        </div>
        <div className="fs-share-actions">
          <button id="copyLink" type="button" className="ghost fs-action-btn" onClick={onCopyLink}>
            {copiedText}
          </button>
          <button id="showQr" type="button" className="ghost fs-action-btn" onClick={() => setShowQr(!showQr)}>
            {showQr ? 'Hide QR' : 'QR code'}
          </button>
        </div>
      </div>
    </>
  );
};

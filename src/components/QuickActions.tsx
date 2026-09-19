import React from 'react';
import { UploadCloud, FileArchive, Sparkles, FilePlus } from 'lucide-react';
import SquishSwitch from './SquishSwitch';

interface QuickActionsProps {
  onUploadClick: () => void;
  onDownloadZip: () => void;
  onOpenSmopi: () => void;
  onNewFile: () => void;
  onColorChange: (hex: string) => void;
  autoRefresh: boolean;
  setAutoRefresh: (val: boolean) => void;
  reduceMotion: boolean;
  setReduceMotion: (val: boolean) => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  onUploadClick,
  onDownloadZip,
  onOpenSmopi,
  onNewFile,
  onColorChange,
  autoRefresh,
  setAutoRefresh,
  reduceMotion,
  setReduceMotion
}) => {
  return (
    <>
      {/* Quick Action Cards Hub */}
      <div className="button-container" style={{ margin: '20px 0 24px' }}>
        <button
          type="button"
          className="brutalist-button button-1"
          onClick={onUploadClick}
          title="Click to browse & upload files"
        >
          <div className="action-logo">
            <UploadCloud className="action-icon text-emerald-300" />
            <div className="action-text">Upload Files</div>
          </div>
        </button>

        <button
          type="button"
          className="brutalist-button button-smopi"
          onClick={onOpenSmopi}
          title="Smopi AI: Create, organize, modify & delete files"
        >
          <div className="action-logo">
            <Sparkles className="action-icon text-purple-300 animate-pulse" />
            <div className="action-text">Smopi AI</div>
          </div>
        </button>

        <button
          type="button"
          className="brutalist-button button-newfile"
          onClick={onNewFile}
          title="Create a new text or markdown file"
        >
          <div className="action-logo">
            <FilePlus className="action-icon text-indigo-300" />
            <div className="action-text">New File</div>
          </div>
        </button>

        <button
          type="button"
          className="brutalist-button button-2"
          onClick={onDownloadZip}
          title="Download all files in single ZIP archive"
        >
          <div className="action-logo">
            <FileArchive className="action-icon text-sky-300" />
            <div className="action-text">Download ZIP</div>
          </div>
        </button>
      </div>

      {/* Preferences & Interactive Utilities Strip */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
          padding: '12px 18px',
          marginBottom: '20px'
        }}
      >
        {/* 3D Theme Accent Swatches */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '.06em', color: 'var(--muted)', textTransform: 'uppercase' }}>
            Theme Accent:
          </span>
          <div className="container-items">
            {[
              { name: 'Emerald', hex: '#42c498' },
              { name: 'Sky', hex: '#38bdf8' },
              { name: 'Violet', hex: '#a855f7' },
              { name: 'Amber', hex: '#f59e0b' },
              { name: 'Rose', hex: '#f43f5e' },
              { name: 'Lime', hex: '#84cc16' }
            ].map(c => (
              <button
                key={c.name}
                type="button"
                className="item-color"
                data-color={c.name}
                aria-label={`Switch theme accent to ${c.name}`}
                style={{ '--color': c.hex } as React.CSSProperties}
                onClick={() => onColorChange(c.hex)}
                title={`Switch theme accent to ${c.name}`}
              />
            ))}
          </div>
        </div>

        {/* Controls: Live Sync and Reduce Motion */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} title="Live Sync: Auto-refresh files every 5s">
            <SquishSwitch
              checked={autoRefresh}
              onChange={setAutoRefresh}
              width={44}
              height={22}
              inset={2}
              trackColor="rgba(255, 255, 255, 0.1)"
              trackOnColor="#10b981"
              thumbColor="#94a3b8"
              thumbOnColor="#ffffff"
              ariaLabel="Toggle Live Sync auto refresh"
            />
            <span style={{ fontSize: '12px', fontWeight: 600, color: autoRefresh ? '#10b981' : 'var(--muted)' }}>
              {autoRefresh ? 'Live Sync' : 'Auto Sync'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} title="Toggle Reduced Motion / Eco Animations">
            <SquishSwitch
              checked={reduceMotion}
              onChange={setReduceMotion}
              width={44}
              height={22}
              inset={2}
              trackColor="rgba(255, 255, 255, 0.1)"
              trackOnColor="#38bdf8"
              thumbColor="#94a3b8"
              thumbOnColor="#ffffff"
              ariaLabel="Toggle Reduced Motion"
            />
            <span style={{ fontSize: '12px', fontWeight: 600, color: reduceMotion ? '#38bdf8' : 'var(--muted)' }}>
              {reduceMotion ? 'Eco Motion' : 'Motion FX'}
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

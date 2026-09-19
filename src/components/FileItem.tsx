import React from 'react';
import { Trash2 } from 'lucide-react';
import type { SharedFile } from '../types';

interface FileItemProps {
  file: SharedFile;
  viewMode: 'list' | 'grid';
  isSelected: boolean;
  onToggleSelect: (name: string, e: React.MouseEvent) => void;
  onPreview: (file: SharedFile) => void;
  onDelete: (name: string, e: React.MouseEvent) => void;
  onDownload: (e: React.MouseEvent, name: string, size: number) => void;
  downloadUrl: string;
  getFileIcon: (file: SharedFile) => React.ReactNode;
}

const lettersOfDownload = 'Download'.split('');

export const FileItem: React.FC<FileItemProps> = ({
  file,
  viewMode,
  isSelected,
  onToggleSelect,
  onPreview,
  onDelete,
  onDownload,
  downloadUrl,
  getFileIcon
}) => {
  if (viewMode === 'grid') {
    return (
      <div
        className={`file-card ${isSelected ? 'is-selected' : ''}`}
        onClick={() => onPreview(file)}
        style={{
          backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255, 255, 255, 0.03)',
          border: isSelected ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '14px',
          padding: '16px',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '12px',
          transition: 'all 0.2s ease',
          textAlign: 'left',
          position: 'relative'
        }}
        onMouseEnter={(e) => {
          if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.25)';
        }}
        onMouseLeave={(e) => {
          if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        {/* Top Row: Checkbox, Icon, Filename, and Delete Action */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <div
            onClick={(e) => onToggleSelect(file.name, e)}
            style={{
              paddingTop: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title={isSelected ? 'Deselect file' : 'Select file'}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => {}}
              style={{
                width: '16px',
                height: '16px',
                cursor: 'pointer',
                accentColor: 'var(--accent, #38bdf8)',
                borderRadius: '4px'
              }}
              aria-label={`Select ${file.name}`}
            />
          </div>

          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '10px',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            {getFileIcon(file)}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
            <strong
              style={{
                color: 'var(--text)',
                fontSize: '14px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
              title={file.name}
            >
              {file.name}
            </strong>
            <span className="muted" style={{ fontSize: '11px' }}>
              {file.type}
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => onDelete(file.name, e)}
            title={`Delete ${file.name}`}
            aria-label={`Delete ${file.name}`}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px',
              color: 'var(--muted)',
              cursor: 'pointer',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#f87171'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted)'}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '10px', marginTop: '4px' }}>
          <span className="muted">{file.size_human}</span>
          <span className="muted">{file.mtime.split(' ')[0]}</span>
        </div>

        <a
          className="fs-download-btn"
          href={downloadUrl}
          download
          aria-label={`Download ${file.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onDownload(e, file.name, file.size);
          }}
          style={{
            width: '100%',
            textAlign: 'center',
            marginTop: '4px'
          }}
        >
          <span className="original">Download</span>
          <span className="letters">
            {lettersOfDownload.map((char, index) => (
              <span key={index}>{char}</span>
            ))}
          </span>
        </a>
      </div>
    );
  }

  // List View
  return (
    <div
      className={`file-row ${isSelected ? 'is-selected' : ''}`}
      onClick={() => onPreview(file)}
      style={{ cursor: 'pointer', transition: 'background-color 0.15s ease' }}
    >
      <div
        onClick={(e) => onToggleSelect(file.name, e)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 4px'
        }}
        title={isSelected ? 'Deselect file' : 'Select file'}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {}}
          style={{
            width: '16px',
            height: '16px',
            cursor: 'pointer',
            accentColor: 'var(--accent, #38bdf8)',
            borderRadius: '4px'
          }}
          aria-label={`Select ${file.name}`}
        />
      </div>

      <span className="file-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {getFileIcon(file)}
      </span>
      <span className="file-main">
        <strong>{file.name}</strong>
        <span>{file.type} &middot; {file.size_human} &middot; {file.mtime}</span>
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <a
          className="fs-download-btn"
          href={downloadUrl}
          download
          aria-label={`Download ${file.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onDownload(e, file.name, file.size);
          }}
        >
          <span className="original">Download</span>
          <span className="letters">
            {lettersOfDownload.map((char, index) => (
              <span key={index}>{char}</span>
            ))}
          </span>
        </a>

        <button
          type="button"
          onClick={(e) => onDelete(file.name, e)}
          title={`Delete ${file.name}`}
          aria-label={`Delete ${file.name}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px',
            borderRadius: '8px',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            color: '#f87171',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
            e.currentTarget.style.borderColor = '#ef4444';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.25)';
          }}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

import React from 'react';
import { X, RefreshCw, FileDown, Edit3, Sparkles, FileImage } from 'lucide-react';
import type { SharedFile, PreviewData } from '../types';

interface FilePreviewModalProps {
  previewFile: SharedFile | null;
  previewData: PreviewData | null;
  isLoading: boolean;
  onClose: () => void;
  onDownload: (e: React.MouseEvent, name: string, size: number) => void;
  downloadUrl: string;
  getFileIcon: (file: SharedFile) => React.ReactNode;
  onEditFile?: (file: SharedFile, content?: string) => void;
  onAskSmopi?: (prompt: string) => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  previewFile,
  previewData,
  isLoading,
  onClose,
  onDownload,
  downloadUrl,
  getFileIcon,
  onEditFile,
  onAskSmopi
}) => {
  if (!previewFile) return null;

  return (
    <div
      className="fs-confirm"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(12px)',
        padding: '24px',
        animation: 'fadeIn 0.2s ease'
      }}
      onClick={onClose}
    >
      <div
        className="fs-confirm-card"
        style={{
          backgroundColor: '#15171d',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '800px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          padding: '24px',
          animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
            <div style={{ backgroundColor: 'rgba(255,255,255,0.04)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
              {getFileIcon(previewFile)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden', textAlign: 'left' }}>
              <h2 style={{
                fontSize: '18px',
                fontWeight: 700,
                color: 'var(--text)',
                margin: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {previewFile.name}
              </h2>
              <span className="muted" style={{ fontSize: '12px' }}>
                {previewFile.size_human} &middot; Modified {previewFile.mtime}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '8px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.04)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Preview Container */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: '260px',
          maxHeight: '55vh',
          backgroundColor: '#0d0f12',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <RefreshCw className="w-8 h-8 text-sky-400 animate-spin" />
              <span className="muted">Loading preview…</span>
            </div>
          ) : previewData?.type === 'image' && previewData.url ? (
            previewData.svg ? (
              // SVGs are served as downloads, not rendered inline (stored XSS).
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', maxWidth: '360px', textAlign: 'center' }}>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <FileImage className="w-12 h-12 text-slate-400" />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 4px', color: 'var(--text)' }}>SVG Preview Unavailable</h3>
                  <p className="muted" style={{ fontSize: '13px', margin: 0 }}>SVG files can contain scripts, so they are downloaded rather than rendered inline. Use the download button to view this file.</p>
                </div>
              </div>
            ) : (
              <img
                src={previewData.url}
                alt={previewFile.name}
                referrerPolicy="no-referrer"
                style={{
                  maxWidth: '100%',
                  maxHeight: '48vh',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
                }}
              />
            )
          ) : previewData?.type === 'text' && previewData.content !== undefined ? (
            <pre style={{
              width: '100%',
              maxHeight: '48vh',
              textAlign: 'left',
              margin: 0,
              fontSize: '13px',
              fontFamily: 'Consolas, Monaco, "Courier New", Courier, monospace',
              color: '#e2e8f0',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflowY: 'auto'
            }}>
              <code>{previewData.content}</code>
            </pre>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', maxWidth: '320px', textAlign: 'center' }}>
              <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.05)' }}>
                <FileDown className="w-12 h-12 text-slate-400" />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 4px', color: 'var(--text)' }}>No Preview Available</h3>
                <p className="muted" style={{ fontSize: '13px', margin: 0 }}>This file type cannot be previewed in the web browser. Please download it to view its content.</p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px', marginTop: '16px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {previewData?.type === 'text' && onEditFile && (
              <button
                type="button"
                className="ghost"
                onClick={() => onEditFile(previewFile, previewData.content)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.3)'
                }}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit file</span>
              </button>
            )}
            {onAskSmopi && (
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  onAskSmopi(`Please inspect "${previewFile.name}" and tell me about it.`);
                  onClose();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: '#c084fc',
                  border: '1px solid rgba(192, 132, 252, 0.3)'
                }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ask Smopi</span>
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="ghost"
              onClick={onClose}
              style={{ width: 'auto', padding: '10px 18px', fontSize: '13px', border: 'none', background: 'none', cursor: 'pointer' }}
            >
              Close
            </button>
            <a
              href={downloadUrl}
              download
              onClick={(e) => {
                onDownload(e, previewFile.name, previewFile.size);
              }}
              className="button primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                textDecoration: 'none',
                padding: '10px 20px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 700,
                backgroundColor: 'var(--accent)',
                color: '#000000',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <FileDown className="w-4 h-4" />
              <span>Download file</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { UploadCloud } from 'lucide-react';
import type { UploadItem } from '../types';

interface UploadDropzoneProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFilesSelected: (files: FileList | null) => void;
  uploads: UploadItem[];
}

export const UploadDropzone: React.FC<UploadDropzoneProps> = ({
  fileInputRef,
  onFilesSelected,
  uploads
}) => {
  return (
    <>
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        className="fs-upload-dropzone"
        style={{
          border: '2px dashed rgba(255, 255, 255, 0.15)',
          borderRadius: '12px',
          padding: '24px',
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          transition: 'all 0.2s ease',
          marginBottom: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px'
        }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.5)'}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'}
      >
        <input
          type="file"
          ref={fileInputRef}
          multiple
          style={{ display: 'none' }}
          onChange={(e) => onFilesSelected(e.target.files)}
        />
        <UploadCloud className="w-9 h-9 text-sky-400 animate-pulse" />
        <div>
          <p style={{ fontWeight: 600, fontSize: '15px', margin: 0 }}>Drag & drop files here to upload</p>
          <p className="muted" style={{ fontSize: '13px', margin: '4px 0 0' }}>or click to browse from your device (up to 500MB each)</p>
        </div>
        <button
          type="button"
          className="flyout-action-btn"
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          aria-label="Upload files now"
        >
          <div className="svg-wrapper">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
              <path fill="none" d="M0 0h24v24H0z" />
              <path fill="currentColor" d="M1.946 9.315c-.522-.174-.527-.455.01-.634l19.087-6.362c.529-.176.832.12.684.638l-5.454 19.086c-.15.529-.455.547-.679.045L12 14l6-8-8 6-8.054-2.685z" />
            </svg>
          </div>
          <span>Upload Files</span>
        </button>
      </div>

      {/* Dynamic Upload Queue list */}
      {uploads.length > 0 && (
        <div className="uploads-list" style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {uploads.map(upload => (
            <div
              key={upload.id}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                  {upload.name}
                </span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: upload.status === 'success' ? '#10b981' : upload.status === 'error' ? '#ef4444' : '#38bdf8'
                }}>
                  {upload.status === 'uploading' ? `${upload.progress}%` : upload.status === 'success' ? 'Uploaded' : 'Upload Failed'}
                </span>
              </div>
              <div style={{ height: '4px', backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${upload.progress}%`,
                    backgroundColor: upload.status === 'success' ? '#10b981' : upload.status === 'error' ? '#ef4444' : '#38bdf8',
                    transition: 'width 0.1s ease'
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

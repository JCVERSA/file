import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  X,
  Send,
  Trash2,
  FilePlus,
  BookOpen,
  Wand2,
  FolderSync,
  Bot,
  User,
  CheckCircle2,
  RefreshCw,
  FileText,
  Copy,
  Check
} from 'lucide-react';
import type { SmopiMessage, SmopiAction, SharedFile } from '../types';

interface SmopiDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  files: SharedFile[];
  onFilesChanged: () => void;
  authToken: string | null;
}

export const SmopiDrawer: React.FC<SmopiDrawerProps> = ({
  isOpen,
  onClose,
  files,
  onFilesChanged,
  authToken
}) => {
  const [messages, setMessages] = useState<SmopiMessage[]>(() => [
    {
      id: 'welcome',
      role: 'model',
      text: `👋 **Hi! I'm Smopi**, your AI file assistant for this workspace.\n\nI can **create**, **organize**, **modify**, **rename**, **summarize**, and **delete** files for you.\n\nWhat would you like me to do with your files today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      model: 'Smopi Agent'
    }
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch Smopi backend status
  useEffect(() => {
    if (!isOpen) return;
    const fetchStatus = async () => {
      try {
        const headers: Record<string, string> = {};
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
        const res = await fetch('/api/smopi/status', { headers });
        if (res.ok) {
          const data = await res.json();
          setHasApiKey(Boolean(data.hasApiKey));
        }
      } catch (_) {}
    };
    fetchStatus();
  }, [isOpen, authToken]);

  // Scroll to bottom of chat
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isProcessing]);

  // Focus textarea when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputPrompt).trim();
    if (!query || isProcessing) return;

    const userMsg: SmopiMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setIsProcessing(true);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      // Build recent history for context
      const historyPayload = messages
        .filter((m) => m.id !== 'welcome')
        .slice(-6)
        .map((m) => ({
          role: m.role,
          text: m.text
        }));

      const res = await fetch('/api/smopi/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: query,
          history: historyPayload
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Server responded with ${res.status}`);
      }

      const data = await res.json();
      const actions: SmopiAction[] = data.actionsTaken || [];

      const modelMsg: SmopiMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        text: data.text || 'Action completed.',
        actions,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: data.model || 'Smopi Agent'
      };

      setMessages((prev) => [...prev, modelMsg]);

      // If any files were modified, trigger instant files refresh
      if (actions.length > 0) {
        onFilesChanged();
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'model',
          text: `⚠️ **Smopi encountered an error**: ${err.message || 'Failed to complete task'}. Please try again.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickAction = async (action: 'generate_index' | 'standardize_names' | 'summarize') => {
    if (action === 'generate_index') {
      handleSendMessage('Please generate a structured WORKSPACE_INDEX.md cataloging all files.');
    } else if (action === 'standardize_names') {
      handleSendMessage('Please standardize and clean up all filenames in the workspace.');
    } else if (action === 'summarize') {
      handleSendMessage('Please analyze and create a WORKSPACE_SUMMARY.md synthesizing all files.');
    }
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const renderActionBadge = (act: SmopiAction, idx: number) => {
    const isCreated = act.type === 'created' || act.type === 'indexed';
    const isDeleted = act.type === 'deleted';
    const isRenamed = act.type === 'renamed';
    const isModified = act.type === 'modified';

    let color = 'rgba(56, 189, 248, 0.15)';
    let border = 'rgba(56, 189, 248, 0.3)';
    let textCol = '#38bdf8';
    let icon = <Wand2 className="w-3.5 h-3.5" />;

    if (isCreated) {
      color = 'rgba(52, 211, 153, 0.15)';
      border = 'rgba(52, 211, 153, 0.35)';
      textCol = '#34d399';
      icon = <CheckCircle2 className="w-3.5 h-3.5" />;
    } else if (isDeleted) {
      color = 'rgba(248, 113, 113, 0.15)';
      border = 'rgba(248, 113, 113, 0.35)';
      textCol = '#f87171';
      icon = <Trash2 className="w-3.5 h-3.5" />;
    } else if (isRenamed) {
      color = 'rgba(251, 191, 36, 0.15)';
      border = 'rgba(251, 191, 36, 0.35)';
      textCol = '#fbbf24';
      icon = <FolderSync className="w-3.5 h-3.5" />;
    } else if (isModified) {
      color = 'rgba(168, 85, 247, 0.15)';
      border = 'rgba(168, 85, 247, 0.35)';
      textCol = '#c084fc';
      icon = <FileText className="w-3.5 h-3.5" />;
    }

    return (
      <div
        key={idx}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: '8px',
          backgroundColor: color,
          border: `1px solid ${border}`,
          color: textCol,
          fontSize: '12px',
          fontWeight: 600,
          marginTop: '6px',
          marginRight: '6px'
        }}
      >
        {icon}
        <span>{act.type.toUpperCase()}: {act.file}</span>
        {act.details && <span style={{ opacity: 0.8, fontWeight: 400 }}>({act.details})</span>}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        display: 'flex',
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          height: '100%',
          backgroundColor: '#12141a',
          borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-12px 0 48px rgba(0,0,0,0.8)',
          animation: 'slideLeft 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'rgba(255, 255, 255, 0.02)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
                boxShadow: '0 0 16px rgba(56, 189, 248, 0.25)'
              }}
            >
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>
                  Smopi AI Agent
                </h2>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: hasApiKey ? 'rgba(52, 211, 153, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                    color: hasApiKey ? '#34d399' : '#fbbf24',
                    border: `1px solid ${hasApiKey ? 'rgba(52, 211, 153, 0.3)' : 'rgba(251, 191, 36, 0.3)'}`
                  }}
                >
                  {hasApiKey ? 'Gemini 3.8' : 'Ready'}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                Manage, create, modify & organize workspace files
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              className="ghost"
              style={{ padding: '6px 10px', borderRadius: '8px', fontSize: '12px', gap: '4px' }}
              onClick={() => {
                setMessages([
                  {
                    id: 'welcome-reset',
                    role: 'model',
                    text: `🧹 **Chat reset.** Workspace has ${files.length} active files. How can Smopi help?`,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    model: 'Smopi'
                  }
                ]);
              }}
              title="Clear conversation"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
            <button
              type="button"
              className="ghost"
              style={{ padding: '8px', borderRadius: '8px' }}
              onClick={onClose}
              aria-label="Close Smopi"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Actions Strip */}
        <div
          style={{
            padding: '10px 16px',
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
            scrollbarWidth: 'none'
          }}
        >
          <button
            type="button"
            className="ghost"
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              fontSize: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onClick={() => handleQuickAction('generate_index')}
            disabled={isProcessing}
          >
            <BookOpen className="w-3.5 h-3.5 text-sky-400" />
            <span>Generate Index</span>
          </button>
          <button
            type="button"
            className="ghost"
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              fontSize: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onClick={() => handleQuickAction('standardize_names')}
            disabled={isProcessing}
          >
            <Wand2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Clean Names</span>
          </button>
          <button
            type="button"
            className="ghost"
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              fontSize: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onClick={() => handleQuickAction('summarize')}
            disabled={isProcessing}
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span>Summarize Files</span>
          </button>
          <button
            type="button"
            className="ghost"
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              fontSize: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onClick={() => handleSendMessage('Create a new documentation file README.md explaining how to use the files in this workspace.')}
            disabled={isProcessing}
          >
            <FilePlus className="w-3.5 h-3.5 text-purple-400" />
            <span>Create README</span>
          </button>
        </div>

        {/* Chat Feed */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isUser ? 'flex-end' : 'flex-start',
                  maxWidth: '100%'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '4px',
                    fontSize: '11px',
                    color: 'var(--muted)'
                  }}
                >
                  {isUser ? (
                    <>
                      <span>You</span>
                      <User className="w-3 h-3" />
                      <span>&middot; {msg.timestamp}</span>
                    </>
                  ) : (
                    <>
                      <Bot className="w-3.5 h-3.5 text-sky-400" />
                      <span style={{ fontWeight: 600, color: '#38bdf8' }}>Smopi</span>
                      <span>&middot; {msg.timestamp}</span>
                    </>
                  )}
                </div>

                <div
                  style={{
                    backgroundColor: isUser ? '#1e293b' : 'rgba(255, 255, 255, 0.04)',
                    border: `1px solid ${isUser ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.08)'}`,
                    borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    padding: '12px 16px',
                    color: 'var(--text)',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    wordBreak: 'break-word',
                    boxShadow: isUser ? '0 4px 12px rgba(0,0,0,0.3)' : 'none',
                    position: 'relative'
                  }}
                >
                  {/* Message body with Markdown-like rendering */}
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    {msg.text}
                  </div>

                  {/* Action Badges */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Actions Executed:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                        {msg.actions.map((act, i) => renderActionBadge(act, i))}
                      </div>
                    </div>
                  )}

                  {/* Copy Button */}
                  {!isUser && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                      <button
                        type="button"
                        className="ghost"
                        style={{ padding: '2px 6px', fontSize: '10px', borderRadius: '4px', opacity: 0.6 }}
                        onClick={() => handleCopyMessage(msg.id, msg.text)}
                        title="Copy message"
                      >
                        {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isProcessing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', padding: '8px 12px' }}>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span style={{ fontSize: '13px', fontWeight: 500 }}>Smopi is inspecting & updating your files…</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Prompts Pill Strip */}
        <div
          style={{
            padding: '8px 16px',
            backgroundColor: 'rgba(0,0,0,0.2)',
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            scrollbarWidth: 'none'
          }}
        >
          {[
            'Create notes.md with project summary',
            'Find duplicate files',
            'Organize and rename files cleanly',
            'List all file sizes'
          ].map((promptText, idx) => (
            <button
              key={idx}
              type="button"
              className="ghost"
              style={{
                fontSize: '11px',
                padding: '4px 10px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                color: 'var(--muted)'
              }}
              onClick={() => handleSendMessage(promptText)}
              disabled={isProcessing}
            >
              {promptText}
            </button>
          ))}
        </div>

        {/* Message Input Area */}
        <div
          style={{
            padding: '14px 16px',
            backgroundColor: 'rgba(18, 20, 26, 0.95)',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '8px 12px',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.4)'
            }}
          >
            <textarea
              ref={inputRef}
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Smopi: 'create file notes.txt', 'organize files', 'delete temp.log'…"
              rows={1}
              style={{
                flex: 1,
                backgroundColor: 'transparent',
                border: 'none',
                color: 'var(--text)',
                fontSize: '14px',
                lineHeight: '1.4',
                resize: 'none',
                outline: 'none',
                maxHeight: '120px',
                padding: '4px 0'
              }}
              disabled={isProcessing}
            />

            <button
              type="button"
              className="button"
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: '#0284c7',
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600,
                fontSize: '13px',
                opacity: !inputPrompt.trim() || isProcessing ? 0.5 : 1,
                cursor: !inputPrompt.trim() || isProcessing ? 'not-allowed' : 'pointer'
              }}
              onClick={() => handleSendMessage()}
              disabled={!inputPrompt.trim() || isProcessing}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '8px',
              fontSize: '11px',
              color: 'var(--muted)'
            }}
          >
            <span>Press <kbd style={{ padding: '1px 4px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px' }}>Enter</kbd> to send, <kbd style={{ padding: '1px 4px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px' }}>Shift+Enter</kbd> for newline</span>
            <span>Workspace: <strong>{files.length}</strong> files</span>
          </div>
        </div>
      </div>
    </div>
  );
};

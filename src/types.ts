export interface SharedFile {
  name: string;
  size: number;
  size_human: string;
  mtime: string;
  type: string;
  category: string;
}

export interface ShareStatus {
  active_downloads: number;
  bytes_total: number;
  bytes_total_human: string;
  downloads_total: number;
  one_time: boolean;
  remaining: number | null;
  stopped: boolean;
  stop_reason: string;
  share_password?: string;
  dev_password?: string;
  authorized?: boolean;
}

export interface UploadItem {
  id: string;
  name: string;
  progress: number;
  status: 'uploading' | 'success' | 'error';
}

export interface PreviewData {
  type: string;
  content?: string;
  url?: string;
  message?: string;
}

export interface DownloadProgressState {
  visible: boolean;
  name: string;
  percent: number;
  statusText: string;
  metaText: string;
  loaded: number;
  total: number;
}

export interface SmopiAction {
  type: 'created' | 'modified' | 'renamed' | 'deleted' | 'duplicated' | 'indexed' | 'analyzed';
  file: string;
  details?: string;
  timestamp: string;
}

export interface SmopiMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  actions?: SmopiAction[];
  timestamp: string;
  model?: string;
}

export interface SmopiStatus {
  hasApiKey: boolean;
  agentName: string;
  model: string;
  capabilities: string[];
}


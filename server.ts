import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
dotenv.config();
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const archiver = require('archiver');
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { runSmopiAgent, executeSmopiTool, sanitizeFileName, resolveSafePath } from './server/smopi';

const app = express();
app.set('trust proxy', 1);
const PORT = 3000;
const SHARE_DIR = path.resolve(process.cwd(), 'shared_files');

// Ensure the shared directory exists
if (!fs.existsSync(SHARE_DIR)) {
  fs.mkdirSync(SHARE_DIR, { recursive: true });
}

// Multer storage configuration for saving uploaded files with security hardening
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, SHARE_DIR);
  },
  filename: (req, file, cb) => {
    // Strip directory structures to avoid traversal
    let sanitized = path.basename(file.originalname).trim();
    // Forbid hidden files starting with .
    if (sanitized.startsWith('.')) {
      sanitized = sanitized.replace(/^\.+/, '') || 'upload.bin';
    }
    // Strip control characters
    sanitized = sanitized.replace(/[\x00-\x1f\x7f]/g, '');
    if (!sanitized) {
      sanitized = `upload_${Date.now()}.bin`;
    }

    // Collision avoidance: append (1), (2), etc. if a file with the same name exists (capped at 1000)
    let candidate = sanitized;
    let counter = 1;
    const ext = path.extname(sanitized);
    const base = path.basename(sanitized, ext);

    while (fs.existsSync(path.join(SHARE_DIR, candidate)) && counter <= 1000) {
      candidate = `${base} (${counter})${ext}`;
      counter++;
    }

    if (fs.existsSync(path.join(SHARE_DIR, candidate))) {
      candidate = `${base}_${Date.now()}${ext}`;
    }

    cb(null, candidate);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500 MB max per uploaded file
    files: 1
  }
});


// In-memory state
const state = {
  password: '',
  expiresAt: null as number | null,
  stopped: false,
  stopReason: '',
  downloadsTotal: 0,
  bytesTotal: 0,
  activeDownloads: 0,
  oneTime: false,
  expiresInSec: 30 * 60, // default 30 minutes
};

interface SessionRecord {
  createdAt: number;
  expiresAt: number;
}
const sessions = new Map<string, SessionRecord>();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours TTL

function pruneExpiredSessions() {
  const now = Date.now();
  for (const [token, data] of sessions.entries()) {
    if (now >= data.expiresAt) {
      sessions.delete(token);
    }
  }
}

const loginAttempts: Record<string, number[]> = {};

// Safe human-readable byte sizes
function humanSize(size: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = size;
  for (const unit of units) {
    if (value < 1024 || unit === units[units.length - 1]) {
      return unit === "B" ? `${value.toFixed(0)} ${unit}` : `${value.toFixed(1)} ${unit}`;
    }
    value /= 1024;
  }
  return `${size} B`;
}

// Map extensions to MIME types
function getMimeType(name: string): string {
  const ext = path.extname(name).toLowerCase();
  const mimes: Record<string, string> = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.csv': 'text/csv',
    '.xml': 'application/xml',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
    '.rar': 'application/vnd.rar',
  };
  return mimes[ext] || 'application/octet-stream';
}

// Assign category based on file suffix/mime
function categoryFor(name: string, mime: string): string {
  const ext = path.extname(name).toLowerCase();
  if ([".zip", ".7z", ".rar", ".tar", ".gz", ".bz2", ".xz", ".tgz", ".tbz2"].includes(ext)) {
    return "archives";
  }
  if (mime.startsWith("image/") || [".svg", ".ico"].includes(ext)) {
    return "images";
  }
  if (mime.startsWith("text/") || ["application/json", "application/xml", "application/pdf"].includes(mime) || [".md", ".csv", ".log", ".yaml", ".yml", ".toml"].includes(ext)) {
    return "documents";
  }
  return "other";
}

// Return formatted type name or extension
function fileType(name: string): string {
  const mime = getMimeType(name);
  if (mime !== 'application/octet-stream') {
    return mime;
  }
  const ext = path.extname(name).toLowerCase().slice(1);
  return ext ? ext.toUpperCase() : "FILE";
}

// Scan directory for regular files (ignores folders, links, dots, path traversal)
async function getRegularFiles(rootDir: string) {
  const result: any[] = [];
  try {
    const entries = await fs.promises.readdir(rootDir);
    // Sort case-insensitively
    entries.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

    for (const name of entries) {
      if (name.startsWith('.')) continue; // ignore hidden system files
      const fullPath = path.join(rootDir, name);
      try {
        const stat = await fs.promises.lstat(fullPath);
        if (stat.isSymbolicLink() || !stat.isFile()) {
          continue;
        }
        const mime = getMimeType(name);
        const mtimeDate = stat.mtime;
        const formattedMtime = mtimeDate.toISOString().replace('T', ' ').substring(0, 16);
        result.push({
          name,
          size: stat.size,
          size_human: humanSize(stat.size),
          mtime: formattedMtime,
          type: fileType(name),
          category: categoryFor(name, mime),
        });
      } catch {
        continue;
      }
    }
  } catch (err) {
    console.error("Error reading shared directory:", err);
  }
  return result;
}

// Secure safe-path resolve for downloads (strictly avoids directory traversal / symlinks)
function safeChild(rootDir: string, name: string): string | null {
  if (!name || name === '.' || name === '..' || name.length > 255) {
    return null;
  }
  if (name.includes('/') || name.includes('\\') || name.includes('\0')) {
    return null;
  }
  const candidate = path.normalize(path.join(rootDir, name));
  const resolvedRoot = path.resolve(rootDir);
  const resolvedCandidate = path.resolve(candidate);
  const rel = path.relative(resolvedRoot, resolvedCandidate);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    return null;
  }
  try {
    const stat = fs.lstatSync(resolvedCandidate);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      return null;
    }
    return resolvedCandidate;
  } catch {
    return null;
  }
}

// Login rate limiter: 5 attempts per IP per minute with memory cleanup
function allowLoginAttempt(ip: string): { allowed: boolean; waitSec: number } {
  const now = Date.now();
  const windowMs = 60 * 1000;

  // Evict empty or expired IP records to prevent memory leak
  for (const [key, timestamps] of Object.entries(loginAttempts)) {
    const valid = timestamps.filter(t => now - t < windowMs);
    if (valid.length === 0) {
      delete loginAttempts[key];
    } else {
      loginAttempts[key] = valid;
    }
  }

  if (!loginAttempts[ip]) {
    loginAttempts[ip] = [];
  }
  if (loginAttempts[ip].length >= 5) {
    const oldest = loginAttempts[ip][0];
    const waitSec = Math.ceil((windowMs - (now - oldest)) / 1000);
    return { allowed: false, waitSec: Math.max(1, waitSec) };
  }
  loginAttempts[ip].push(now);
  return { allowed: true, waitSec: 0 };
}

// Initialize active state with environment variables or secure random fallback
function initializeState() {
  try {
    dotenv.config({ override: true });
  } catch (_) {
    // ignore
  }

  // Primary: Check SHARE_PASSWORD or PASSWORD environment variable
  const envPassword = (process.env.SHARE_PASSWORD || process.env.PASSWORD || '').trim();
  let sharePassword = envPassword;
  const isFromEnv = Boolean(envPassword);

  if (!sharePassword) {
    sharePassword = crypto.randomBytes(6).toString('hex');
  }

  const expiresSec = process.env.SHARE_EXPIRY ? parseInt(process.env.SHARE_EXPIRY) : 30 * 60; // 30 minutes default
  const oneTime = process.env.SHARE_ONE_TIME === 'true' || false;

  state.password = sharePassword;
  state.expiresAt = expiresSec > 0 ? Date.now() + expiresSec * 1000 : null;
  state.stopped = false;
  state.stopReason = '';
  state.downloadsTotal = 0;
  state.bytesTotal = 0;
  state.activeDownloads = 0;
  state.oneTime = oneTime;
  state.expiresInSec = expiresSec;

  console.log("\n" + "=".repeat(72));
  console.log(`  TEMPORARY FILE SHARE SERVER (Node/Express)`);
  console.log("=".repeat(72));
  console.log(`  Directory : ${SHARE_DIR}`);
  console.log(`  Password  : ${sharePassword} (${isFromEnv ? 'from SHARE_PASSWORD env' : 'generated'})`);
  console.log(`  Lifetime  : ${expiresSec > 0 ? expiresSec + 's' : 'disabled'}`);
  console.log(`  One-time  : ${oneTime ? 'YES' : 'NO'}`);
  console.log("=".repeat(72) + "\n");
}

function isExpired(): boolean {
  if (state.stopped) return true;
  if (state.expiresAt && Date.now() >= state.expiresAt) {
    state.stopped = true;
    state.stopReason = 'expired';
    return true;
  }
  return false;
}

function remainingSeconds(): number | null {
  if (state.stopped) return 0;
  if (!state.expiresAt) return null;
  return Math.max(0, Math.ceil((state.expiresAt - Date.now()) / 1000));
}

// Apply middlewares
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use(express.json());
app.use(cookieParser());

// Initialize share configurations
initializeState();

// Check if cookies, Authorization header, or query token has a valid, non-expired session
function isSessionValid(req: express.Request): boolean {
  pruneExpiredSessions();
  const now = Date.now();

  const checkToken = (token?: string | null): boolean => {
    if (!token || typeof token !== 'string') return false;
    const session = sessions.get(token);
    if (!session) return false;
    if (now >= session.expiresAt) {
      sessions.delete(token);
      return false;
    }
    return true;
  };

  // 1. Check HTTP-only cookie
  if (checkToken(req.cookies?.fs_session)) {
    return true;
  }

  // 2. Check Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.substring(7).trim();
    if (checkToken(bearerToken)) {
      return true;
    }
  }

  // 3. Check query token (for direct browser downloads / previews in embedded iframe contexts)
  const queryToken = req.query?.token;
  if (typeof queryToken === 'string' && checkToken(queryToken)) {
    return true;
  }

  return false;
}

// API: Get current metrics & lifetime status
app.get('/api/status', (req, res) => {
  // Update expired states lazily
  isExpired();

  // Determine if authorized
  const authorized = isSessionValid(req);

  res.json({
    active_downloads: state.activeDownloads,
    bytes_total: state.bytesTotal,
    bytes_total_human: humanSize(state.bytesTotal),
    downloads_total: state.downloadsTotal,
    one_time: state.oneTime,
    remaining: remainingSeconds(),
    stopped: state.stopped,
    stop_reason: state.stopReason,
    authorized,
    // Disclose the share password strictly to authenticated sessions so the host can copy/distribute it
    share_password: authorized ? state.password : undefined
  });
});

// API: File Upload Endpoint with Multer Error Handling & Authentication
app.post('/api/upload', (req, res) => {
  if (!isSessionValid(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (isExpired()) {
    return res.status(403).json({ error: 'Share expired' });
  }

  upload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File exceeds the maximum upload limit of 500 MB.' });
      }
      return res.status(400).json({ error: err.message || 'File upload error' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    res.json({
      success: true,
      file: {
        name: req.file.filename,
        size: req.file.size,
        size_human: humanSize(req.file.size),
        mtime: new Date().toISOString().replace('T', ' ').substring(0, 16),
        type: fileType(req.file.filename),
        category: categoryFor(req.file.filename, getMimeType(req.file.filename))
      }
    });
  });
});

// API: File Preview Endpoint
app.get('/api/preview/:filename', async (req, res) => {
  if (!isSessionValid(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { filename } = req.params;
  const filePath = safeChild(SHARE_DIR, filename);
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    const stat = await fs.promises.stat(filePath);
    const size = stat.size;
    const mime = getMimeType(filename);

    if (mime.startsWith('image/')) {
      const activeToken = req.cookies?.fs_session || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.substring(7).trim() : '');
      const tokenParam = activeToken ? `?token=${encodeURIComponent(activeToken)}` : '';
      return res.json({ type: 'image', url: `/download/${encodeURIComponent(filename)}${tokenParam}` });
    }

    const ext = path.extname(filename).toLowerCase();
    const isText = mime.startsWith('text/') || 
                   ['.json', '.xml', '.js', '.ts', '.tsx', '.jsx', '.py', '.sh', '.yaml', '.yml', '.toml', '.ini', '.csv', '.md'].includes(ext);

    if (isText) {
      if (size > 2 * 1024 * 1024) { // limit preview reading to 2MB to keep it blazing fast
        return res.json({ type: 'text', content: 'This file is too large to preview directly in the browser (max 2MB).' });
      }
      const content = await fs.promises.readFile(filePath, 'utf8');
      return res.json({ type: 'text', content });
    }

    return res.json({ type: 'unsupported', message: 'No browser preview is available for this file type.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read file content' });
  }
});

// API: Login verification
app.post('/api/login', (req, res) => {
  const ip = req.ip || 'unknown';
  const { allowed, waitSec } = allowLoginAttempt(ip);

  if (!allowed) {
    return res.status(429).json({ error: `Too many attempts. Please wait ${waitSec} seconds.` });
  }

  const { password } = req.body;
  const userPassBuf = Buffer.from(typeof password === 'string' ? password : '');
  const actualPassBuf = Buffer.from(state.password);

  const isPasswordMatch = userPassBuf.length === actualPassBuf.length &&
    crypto.timingSafeEqual(userPassBuf, actualPassBuf);

  if (isPasswordMatch) {
    const token = crypto.randomBytes(24).toString('hex');
    const now = Date.now();
    sessions.set(token, {
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS
    });

    // Set cookie with SameSite: 'lax' for broader compatibility
    res.cookie('fs_session', token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: SESSION_TTL_MS
    });

    return res.json({ success: true, token });
  }

  return res.status(401).json({ error: 'The password is incorrect.' });
});

// API: End session / Logout
app.post('/api/logout', (req, res) => {
  const cookieToken = req.cookies?.fs_session;
  if (cookieToken) {
    sessions.delete(cookieToken);
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.substring(7).trim();
    if (bearerToken) {
      sessions.delete(bearerToken);
    }
  }
  const queryToken = req.query?.token;
  if (queryToken && typeof queryToken === 'string') {
    sessions.delete(queryToken);
  }
  res.clearCookie('fs_session');
  res.json({ success: true });
});

// API: Get listed files (Requires valid session)
app.get('/api/files', async (req, res) => {
  if (!isSessionValid(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (isExpired()) {
    return res.status(403).json({ error: 'Share expired', files: [] });
  }
  const filesList = await getRegularFiles(SHARE_DIR);
  res.json({ files: filesList });
});

// API: Bulk delete files
app.post('/api/files/bulk-delete', async (req, res) => {
  if (!isSessionValid(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (isExpired()) {
    return res.status(403).json({ error: 'Share expired' });
  }
  const { names } = req.body;
  if (!Array.isArray(names) || names.length === 0) {
    return res.status(400).json({ error: 'No files specified' });
  }
  const deleted: string[] = [];
  const errors: string[] = [];

  for (const name of names) {
    const filePath = safeChild(SHARE_DIR, name);
    if (!filePath || !fs.existsSync(filePath)) {
      errors.push(`File not found: ${name}`);
      continue;
    }
    try {
      await fs.promises.unlink(filePath);
      deleted.push(name);
    } catch (err: any) {
      errors.push(`Failed to delete ${name}: ${err.message}`);
    }
  }

  res.json({ success: true, deleted, errors });
});

// API: Delete single file
app.delete('/api/files/:name', async (req, res) => {
  if (!isSessionValid(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (isExpired()) {
    return res.status(403).json({ error: 'Share expired' });
  }
  const { name } = req.params;
  const filePath = safeChild(SHARE_DIR, name);
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  try {
    await fs.promises.unlink(filePath);
    res.json({ success: true, deleted: name });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to delete file: ${err.message}` });
  }
});

// API: Smopi AI status
app.get('/api/smopi/status', (req, res) => {
  const hasKey = Boolean((process.env.GEMINI_API_KEY || '').trim());
  res.json({
    hasApiKey: hasKey,
    agentName: 'Smopi',
    model: hasKey ? 'gemini-3.8-flash' : 'local-smopi-engine',
    capabilities: [
      'File creation & markdown writing',
      'File modification & editing',
      'Intelligent organization & renaming',
      'Batch deletion & cleanup',
      'Workspace indexing & catalog generation',
      'Document summarization & synthesis'
    ]
  });
});

// API: Smopi AI Chat / Action Loop
app.post('/api/smopi/chat', async (req, res) => {
  if (!isSessionValid(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (isExpired()) {
    return res.status(403).json({ error: 'Share expired' });
  }
  const { message, history } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const result = await runSmopiAgent(message, SHARE_DIR, history || []);
    res.json(result);
  } catch (err: any) {
    console.error('Smopi chat route error:', err);
    res.status(500).json({ error: err.message || 'Smopi failed to process request' });
  }
});

// API: Smopi Quick Action (generate_index, standardize_names)
app.post('/api/smopi/quick-action', async (req, res) => {
  if (!isSessionValid(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (isExpired()) {
    return res.status(403).json({ error: 'Share expired' });
  }
  const { action } = req.body;
  const actionsTaken: any[] = [];
  const toolResult = executeSmopiTool('organize_workspace', { operation: action }, SHARE_DIR, actionsTaken);
  
  if (toolResult.error) {
    return res.status(400).json({ error: toolResult.error });
  }

  res.json({
    success: true,
    result: toolResult.result,
    actionsTaken
  });
});

// API: Read file text content
app.get('/api/files/:name/content', async (req, res) => {
  if (!isSessionValid(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { name } = req.params;
  const filePath = safeChild(SHARE_DIR, name);
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  try {
    const stat = await fs.promises.stat(filePath);
    if (stat.size > 2 * 1024 * 1024) {
      return res.status(400).json({ error: 'File is too large to preview directly (> 2MB)' });
    }
    const content = await fs.promises.readFile(filePath, 'utf8');
    res.json({ success: true, name, content, size: stat.size });
  } catch (err: any) {
    res.status(500).json({ error: `Could not read file: ${err.message}` });
  }
});

// API: Update/modify file text content
app.put('/api/files/:name/content', async (req, res) => {
  if (!isSessionValid(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (isExpired()) {
    return res.status(403).json({ error: 'Share expired' });
  }
  const { name } = req.params;
  const { content } = req.body;
  if (typeof content !== 'string') {
    return res.status(400).json({ error: 'Content must be a string' });
  }
  const filePath = safeChild(SHARE_DIR, name);
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  try {
    await fs.promises.writeFile(filePath, content, 'utf8');
    res.json({ success: true, name, size: Buffer.byteLength(content, 'utf8') });
  } catch (err: any) {
    res.status(500).json({ error: `Could not save file: ${err.message}` });
  }
});

// API: Create new file directly
app.post('/api/files/create', async (req, res) => {
  if (!isSessionValid(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (isExpired()) {
    return res.status(403).json({ error: 'Share expired' });
  }
  const { name, content } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Filename is required' });
  }
  const sanitized = sanitizeFileName(name);
  const filePath = resolveSafePath(SHARE_DIR, sanitized);
  if (!filePath) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  if (fs.existsSync(filePath)) {
    return res.status(409).json({ error: `File "${sanitized}" already exists` });
  }
  try {
    await fs.promises.writeFile(filePath, content || '', 'utf8');
    res.json({ success: true, name: sanitized, size: Buffer.byteLength(content || '', 'utf8') });
  } catch (err: any) {
    res.status(500).json({ error: `Could not create file: ${err.message}` });
  }
});

// API: Rename file directly
app.post('/api/files/:name/rename', async (req, res) => {
  if (!isSessionValid(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (isExpired()) {
    return res.status(403).json({ error: 'Share expired' });
  }
  const { name } = req.params;
  const { newName } = req.body;
  if (!newName || typeof newName !== 'string') {
    return res.status(400).json({ error: 'New name is required' });
  }
  const oldPath = safeChild(SHARE_DIR, name);
  if (!oldPath || !fs.existsSync(oldPath)) {
    return res.status(404).json({ error: 'Original file not found' });
  }
  const sanitizedNew = sanitizeFileName(newName);
  const newPath = resolveSafePath(SHARE_DIR, sanitizedNew);
  if (!newPath) {
    return res.status(400).json({ error: 'Invalid new filename' });
  }
  if (fs.existsSync(newPath) && oldPath !== newPath) {
    return res.status(409).json({ error: `Target file "${sanitizedNew}" already exists` });
  }
  try {
    await fs.promises.rename(oldPath, newPath);
    res.json({ success: true, oldName: name, newName: sanitizedNew });
  } catch (err: any) {
    res.status(500).json({ error: `Could not rename file: ${err.message}` });
  }
});

// API: Download selected files as zip
app.post('/api/download-selected', (req, res) => {
  if (!isSessionValid(req)) {
    return res.status(401).send('Unauthorized');
  }
  if (isExpired()) {
    return res.status(403).send('Share expired');
  }

  const { names } = req.body;
  if (!Array.isArray(names) || names.length === 0) {
    return res.status(400).send('No files specified');
  }

  const validFiles: { name: string; path: string }[] = [];
  for (const name of names) {
    const filePath = safeChild(SHARE_DIR, name);
    if (filePath && fs.existsSync(filePath)) {
      validFiles.push({ name, path: filePath });
    }
  }

  if (validFiles.length === 0) {
    return res.status(404).send('None of the requested files were found');
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="selected_files.zip"');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  const archive = archiver('zip', { store: true });
  archive.on('error', (err: any) => {
    console.error('ZIP archiver error:', err);
    if (!res.headersSent) {
      res.status(500).send('Archiving error');
    }
  });

  state.activeDownloads++;
  let sentBytes = 0;
  let activeDecremented = false;
  const cleanupActive = () => {
    if (!activeDecremented) {
      activeDecremented = true;
      state.activeDownloads = Math.max(0, state.activeDownloads - 1);
    }
  };

  res.on('close', cleanupActive);

  archive.on('data', (chunk: any) => {
    sentBytes += chunk.length;
  });
  archive.on('end', () => {
    cleanupActive();
    state.downloadsTotal++;
    state.bytesTotal += sentBytes;
  });

  archive.pipe(res);

  for (const file of validFiles) {
    archive.file(file.path, { name: file.name });
  }

  archive.finalize();
});

// API: Manually terminate share
app.post('/stop-share', (req, res) => {
  if (!isSessionValid(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  state.stopped = true;
  state.stopReason = 'stopped from dashboard';
  sessions.clear(); // revoke all sessions
  res.json({ success: true });
});

// API: Full server restart/refresh (Requires valid session)
app.post('/api/restart', (req, res) => {
  if (!isSessionValid(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  sessions.clear();
  initializeState();
  res.json({ success: true });
});

// API: Single File download streaming with Range support
app.get('/download/:name', (req, res) => {
  if (!isSessionValid(req)) {
    return res.status(401).send('Unauthorized');
  }
  if (isExpired()) {
    return res.status(403).send('Share expired');
  }

  const filename = req.params.name;
  const fullPath = safeChild(SHARE_DIR, filename);
  if (!fullPath) {
    return res.status(404).send('File not found');
  }

  const stat = fs.statSync(fullPath);
  const size = stat.size;
  const mime = getMimeType(filename);

  let start = 0;
  let end = size - 1;
  let isRange = false;

  // Range parsing (only when NOT in one-time download mode)
  const rangeHeader = req.headers.range;
  if (rangeHeader && !state.oneTime) {
    const parts = rangeHeader.replace(/bytes=/, "").split("-");
    const partialStart = parts[0];
    const partialEnd = parts[1];

    const parsedStart = parseInt(partialStart, 10);
    const parsedEnd = parseInt(partialEnd, 10);

    if (!isNaN(parsedStart)) {
      start = parsedStart;
    }
    if (!isNaN(parsedEnd)) {
      end = parsedEnd;
    } else {
      end = size - 1;
    }

    if (start >= size || end >= size || start > end) {
      res.setHeader('Content-Range', `bytes */${size}`);
      return res.status(416).send('Requested Range Not Satisfiable');
    }
    isRange = true;
  }

  const chunksize = (end - start) + 1;
  state.activeDownloads++;

  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Accept-Ranges', state.oneTime ? 'none' : 'bytes');

  if (isRange) {
    res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    res.status(206);
  } else {
    res.setHeader('Content-Length', chunksize);
    res.status(200);
  }

  const stream = fs.createReadStream(fullPath, { start, end });
  let sentBytes = 0;
  let activeDecremented = false;
  const cleanupActive = () => {
    if (!activeDecremented) {
      activeDecremented = true;
      state.activeDownloads = Math.max(0, state.activeDownloads - 1);
    }
  };

  res.on('close', cleanupActive);

  stream.on('data', (chunk) => {
    sentBytes += chunk.length;
  });

  stream.on('end', () => {
    cleanupActive();
    
    // Check if fully and successfully completed
    if (start === 0 && end === size - 1 && sentBytes === chunksize) {
      state.downloadsTotal++;
      state.bytesTotal += sentBytes;
      if (state.oneTime) {
        state.stopped = true;
        state.stopReason = 'one-time download completed';
        sessions.clear();
      }
    } else {
      state.bytesTotal += sentBytes;
    }
  });

  stream.on('error', (err) => {
    console.error('Download stream error:', err);
    cleanupActive();
  });

  stream.pipe(res);
});

// API: ZIP archive bundling & streaming on the fly
app.get('/download-all', async (req, res) => {
  if (!isSessionValid(req)) {
    return res.status(401).send('Unauthorized');
  }
  if (isExpired()) {
    return res.status(403).send('Share expired');
  }

  const filesList = await getRegularFiles(SHARE_DIR);
  if (filesList.length === 0) {
    return res.status(404).send('No files to bundle');
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="files.zip"');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  // Fast archiving without CPU compression load (ZIP_STORED)
  const archive = archiver('zip', { store: true });

  archive.on('error', (err: any) => {
    console.error('ZIP archiver error:', err);
    if (!res.headersSent) {
      res.status(500).send('Archiving error');
    }
  });

  state.activeDownloads++;

  let sentBytes = 0;
  let activeDecremented = false;
  const cleanupActive = () => {
    if (!activeDecremented) {
      activeDecremented = true;
      state.activeDownloads = Math.max(0, state.activeDownloads - 1);
    }
  };

  res.on('close', cleanupActive);

  archive.on('data', (chunk: any) => {
    sentBytes += chunk.length;
  });

  archive.on('end', () => {
    cleanupActive();
    state.downloadsTotal++;
    state.bytesTotal += sentBytes;

    if (state.oneTime) {
      state.stopped = true;
      state.stopReason = 'one-time download completed';
      sessions.clear();
    }
  });

  archive.pipe(res);

  for (const item of filesList) {
    const filePath = safeChild(SHARE_DIR, item.name);
    if (filePath) {
      archive.file(filePath, { name: item.name });
    }
  }

  archive.finalize();
});


// FRONTEND ASSET SERVING & VITE INTEGRATION
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Vite Dev Mode Middleware setup
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production compiled static assets
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server successfully started on port ${PORT}`);
  });
}

startServer();

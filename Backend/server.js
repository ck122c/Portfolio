const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

function loadLocalEnv() {
  const envPath = path.resolve(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) return;

    const key = trimmed.slice(0, equalIndex).trim();
    let value = trimmed.slice(equalIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

loadLocalEnv();

let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (_error) {
  nodemailer = null;
}

const app = express();

/* ============================================================
   SERVER + DB CONFIG SECTION
   ============================================================ */
const PORT = Number(process.env.PORT) || 5001;
const DB_HOST = readStringEnv('DB_HOST', 'localhost');
const DB_PORT = Number(process.env.DB_PORT) || 3306;
const DB_USER = readStringEnv('DB_USER', 'root');
const DB_PASS = readStringEnv('DB_PASS', '12345678');
const DB_NAME = readStringEnv('DB_NAME', 'portfolio');
const DB_SSL = readBooleanEnv('DB_SSL', false);
const DB_SSL_REJECT_UNAUTHORIZED = readBooleanEnv('DB_SSL_REJECT_UNAUTHORIZED', true);
const ADMIN_PASS = process.env.ADMIN_PASS || 'Chandan@123';
const ADMIN_PASS_ALIASES = new Set([
  normalizeAdminPassword(ADMIN_PASS),
  normalizeAdminPassword('Chandan@123')
]);
const ADMIN_TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET || `${ADMIN_PASS}:${DB_NAME}:admin-token-secret`;
const ADMIN_TOKEN_TTL_MS = Number(process.env.ADMIN_TOKEN_TTL_MS) || (12 * 60 * 60 * 1000);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_RESUME_BYTES = 8 * 1024 * 1024;
const ALERT_EMAIL_TO = process.env.ALERT_EMAIL_TO || 'chandankumar122c@gmail.com';
const MAIL_USER = process.env.MAIL_USER || '';
const MAIL_PASS = process.env.MAIL_PASS || '';
const MAIL_HOST = process.env.MAIL_HOST || 'smtp.gmail.com';
const MAIL_PORT = Number(process.env.MAIL_PORT) || 465;
const MAIL_SECURE = String(process.env.MAIL_SECURE || 'true').toLowerCase() !== 'false';
const MAIL_FROM = process.env.MAIL_FROM || MAIL_USER;
const ALERT_ON_VISIT = String(process.env.ALERT_ON_VISIT || 'true').toLowerCase() !== 'false';
const ALERT_VISIT_THROTTLE_MS =
  (Number(process.env.ALERT_VISIT_THROTTLE_MINUTES) || 30) * 60 * 1000;
const PUBLIC_SITE_URL = cleanBaseUrl(process.env.PUBLIC_SITE_URL || '');

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '20mb' }));

/* ============================================================
   FRONTEND STATIC SERVE SECTION
   - http://localhost:5001 par Frontend/index.html open hoga
   ============================================================ */
const FRONTEND_DIR = path.resolve(__dirname, '../Frontend');

app.get('/healthz', (_req, res) => {
  return res.json({
    ok: true,
    service: 'portfolio',
    status: 'healthy'
  });
});

app.get('/robots.txt', (req, res) => {
  const siteUrl = getPublicSiteUrl(req);
  res.type('text/plain');
  return res.send(`User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`);
});

app.get('/sitemap.xml', (req, res) => {
  const siteUrl = getPublicSiteUrl(req);
  const pages = ['/', '/projects', '/blogs', '/resume'];
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...pages.map((page) => `  <url><loc>${escapeXml(`${siteUrl}${page}`)}</loc></url>`),
    '</urlset>'
  ].join('\n');

  res.type('application/xml');
  return res.send(xml);
});

app.use(express.static(FRONTEND_DIR));

const db = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASS,
  database: DB_NAME,
  ssl: DB_SSL ? { rejectUnauthorized: DB_SSL_REJECT_UNAUTHORIZED } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

/* ============================================================
   SHARED HELPERS SECTION
   ============================================================ */
function cleanString(value, max = 500) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function readStringEnv(key, fallback = '') {
  const value = process.env[key];
  if (value === undefined || value === null) return fallback;
  const trimmed = String(value).trim();
  return trimmed || fallback;
}

function readBooleanEnv(key, fallback) {
  const raw = process.env[key];
  if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(raw).trim().toLowerCase());
}

function normalizeAdminPassword(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase()
    .trim();
}

function cleanBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function getPublicSiteUrl(req) {
  if (PUBLIC_SITE_URL) return PUBLIC_SITE_URL;
  const forwardedProto = String(req.get('x-forwarded-proto') || '').split(',')[0].trim();
  const protocol = forwardedProto || req.protocol || 'http';
  const host = req.get('host') || `localhost:${PORT}`;
  return cleanBaseUrl(`${protocol}://${host}`);
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cleanMultilineText(value, max = 5000) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, '')
    .slice(0, max);
}

function sanitizeUrl(value, max = 500) {
  const url = cleanString(value, max);
  if (!url) return '';
  const lower = url.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:')) return '';
  return url;
}

function toInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function toTinyInt(value, fallback = 0) {
  return value ? 1 : fallback;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

let alertTransporter = null;
let mailWarningShown = false;
let lastVisitAlertAt = 0;

function getAlertTransporter() {
  if (!nodemailer || !MAIL_USER || !MAIL_PASS || !ALERT_EMAIL_TO) return null;
  if (alertTransporter) return alertTransporter;

  alertTransporter = nodemailer.createTransport({
    host: MAIL_HOST,
    port: MAIL_PORT,
    secure: MAIL_SECURE,
    auth: {
      user: MAIL_USER,
      pass: MAIL_PASS
    }
  });

  return alertTransporter;
}

function buildAlertEmail(title, fields = {}) {
  const rows = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .map(([label, value]) => `
      <tr>
        <td style="padding:10px 12px;color:#68f5d2;font-weight:700;border-bottom:1px solid rgba(104,245,210,.15);">${escapeHtml(label)}</td>
        <td style="padding:10px 12px;color:#eaf7ff;border-bottom:1px solid rgba(104,245,210,.15);white-space:pre-wrap;">${escapeHtml(value)}</td>
      </tr>
    `)
    .join('');

  const text = [
    title,
    '',
    ...Object.entries(fields).map(([label, value]) => `${label}: ${value || ''}`)
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;background:#061014;padding:24px;color:#eaf7ff;">
      <div style="max-width:640px;margin:auto;border:1px solid rgba(104,245,210,.35);border-radius:18px;overflow:hidden;background:#0b1820;">
        <div style="padding:20px 24px;background:linear-gradient(135deg,rgba(104,245,210,.18),rgba(77,166,255,.12));">
          <p style="margin:0 0 8px;color:#68f5d2;font-weight:800;letter-spacing:1px;text-transform:uppercase;">Portfolio Alert</p>
          <h2 style="margin:0;font-size:26px;color:#ffffff;">${escapeHtml(title)}</h2>
        </div>
        <table style="width:100%;border-collapse:collapse;">${rows}</table>
        <p style="padding:16px 24px;margin:0;color:#9db1bd;font-size:13px;">This alert was sent automatically from your portfolio website.</p>
      </div>
    </div>
  `;

  return { html, text };
}

async function sendEmailAlert(title, fields = {}) {
  const transporter = getAlertTransporter();
  if (!transporter) {
    if (!mailWarningShown) {
      console.warn('Mail alerts disabled. Add MAIL_USER, MAIL_PASS and ALERT_EMAIL_TO in Backend/.env');
      mailWarningShown = true;
    }
    return false;
  }

  const { html, text } = buildAlertEmail(title, fields);
  await transporter.sendMail({
    from: MAIL_FROM,
    to: ALERT_EMAIL_TO,
    subject: `Portfolio Alert: ${title}`,
    text,
    html
  });

  return true;
}

function queueEmailAlert(title, fields = {}) {
  sendEmailAlert(title, fields).catch((error) => {
    console.error('Email alert failed:', error.message);
  });
}

function queueVisitEmailAlert(fields = {}) {
  if (!ALERT_ON_VISIT) return;

  const now = Date.now();
  if (now - lastVisitAlertAt < ALERT_VISIT_THROTTLE_MS) return;

  lastVisitAlertAt = now;
  queueEmailAlert('New Website Activity', fields);
}

function normalizeCategory(value) {
  const category = cleanString(value, 20).toLowerCase();
  return ['ai', 'web', 'viz'].includes(category) ? category : 'web';
}

function slugifyText(value, max = 120) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
}

function encodeBase64Url(text) {
  return Buffer.from(String(text || ''), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeBase64Url(text) {
  const value = String(text || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4));
  return Buffer.from(value + pad, 'base64').toString('utf8');
}

function signAdminPayload(payloadObject = {}) {
  const payload = encodeBase64Url(JSON.stringify(payloadObject));
  const signature = crypto
    .createHmac('sha256', ADMIN_TOKEN_SECRET)
    .update(payload)
    .digest('hex');
  return `${payload}.${signature}`;
}

function createAdminToken() {
  const now = Date.now();
  const payload = {
    role: 'admin',
    iat: now,
    exp: now + ADMIN_TOKEN_TTL_MS
  };
  return signAdminPayload(payload);
}

function verifyAdminToken(token) {
  const value = String(token || '');
  const [payloadPart = '', signature = ''] = value.split('.');
  if (!payloadPart || !signature) return null;

  const expected = crypto
    .createHmac('sha256', ADMIN_TOKEN_SECRET)
    .update(payloadPart)
    .digest('hex');

  if (expected !== signature) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(payloadPart));
    if (!payload || payload.role !== 'admin') return null;
    if (!payload.exp || Date.now() >= Number(payload.exp)) return null;
    return payload;
  } catch (_error) {
    return null;
  }
}

function requireAdminAuth(req, res, next) {
  const rawAuth = String(req.get('authorization') || '');
  const token = rawAuth.toLowerCase().startsWith('bearer ') ? rawAuth.slice(7).trim() : '';
  const payload = verifyAdminToken(token);
  if (!payload) {
    return res.status(401).json({ success: false, error: 'Unauthorized admin access' });
  }
  req.adminAuth = payload;
  return next();
}

const DEFAULT_ABOUT_CONTENT = {
  tagline: 'Data Scientist | AI Enthusiast | Problem Solver',
  headline: 'Building data-driven products with real business impact',
  paragraph_1:
    "Hi, I'm Chandan. I turn raw data into useful insights and practical solutions.",
  paragraph_2:
    'From analytics dashboards to AI workflows, I focus on clarity, performance, and measurable outcomes.',
  paragraph_3:
    'I enjoy solving real problems through technology and creating products people can actually use.',
  experience_summary: '1+ Years of Hands-on Experience'
};

const DEFAULT_CONTACT_SETTINGS = {
  location_text: 'Indore, India',
  map_embed_url: 'https://www.google.com/maps?q=Indore%2C%20India&output=embed'
};

const DEFAULT_RESUME_CONTENT = {
  full_name: 'Chandan Kumar',
  headline: 'Data Scientist | AI Enthusiast | Problem Solver',
  email: 'chandankumar122c@gmail.com',
  phone: '',
  location: 'Indore, India',
  website: '',
  linkedin_url: 'https://www.linkedin.com/in/chandankumar122c',
  github_url: 'https://github.com/ck122c',
  summary:
    'I build data-driven products, dashboards, and AI-enabled web experiences focused on clarity, performance, and real business impact.',
  skills:
    'Python\nSQL\nPower BI\nExcel\nData Visualization\nHTML\nCSS\nJavaScript\nNode.js\nMySQL',
  experience:
    'Data Analyst / Builder | GT24 TECH / Freelance | 2025 - Present\nCreating analytics dashboards, AI utilities, and SQL-backed portfolio products.\n\nWeb Developer | Self Projects Lab | 2024 - 2025\nBuilt responsive frontend and backend projects with admin-managed content.',
  education:
    'Bachelor / Computer Science Track\nFocused on data analytics, programming, and practical AI projects.',
  projects:
    'Portfolio Website\nSQL-backed portfolio with dynamic admin panel, projects, blogs, reviews, and analytics.\n\nSales Dashboard\nInteractive Power BI dashboard for sales performance insights.',
  certifications:
    'Data Analytics Practice\nAI and Web Development Projects'
};

const DEFAULT_EXPERIENCES = [
  {
    year_label: '2025 - Present',
    company_name: 'GT24 TECH / Freelance',
    job_role: 'Data Analyst',
    position_title: 'Founder & Builder',
    description:
      'Creating analytics dashboards, AI utilities, and automation-first portfolio products.',
    display_order: 1
  },
  {
    year_label: '2024 - 2025',
    company_name: 'Self Projects Lab',
    job_role: 'Web Developer',
    position_title: 'Frontend + Backend Developer',
    description:
      'Built responsive websites with SQL-backed admin panels, dynamic cards, and production-ready UI.',
    display_order: 2
  },
  {
    year_label: '2023 - 2024',
    company_name: 'Academic + Internship Work',
    job_role: 'AI / Data Explorer',
    position_title: 'Project Contributor',
    description:
      'Worked on machine learning and dashboard projects with Python, SQL, and BI tooling.',
    display_order: 3
  }
];

function normalizeAboutContentInput(value = {}) {
  return {
    tagline: cleanString(value.tagline, 220),
    headline: cleanString(value.headline, 220),
    paragraph_1: cleanString(value.paragraph_1, 3000),
    paragraph_2: cleanString(value.paragraph_2, 3000),
    paragraph_3: cleanString(value.paragraph_3, 3000),
    experience_summary: cleanString(value.experience_summary, 160)
  };
}

function normalizeExperienceInput(value = {}) {
  return {
    year_label: cleanString(value.year_label, 60),
    company_name: cleanString(value.company_name, 160),
    job_role: cleanString(value.job_role, 160),
    position_title: cleanString(value.position_title, 160),
    description: cleanString(value.description, 1200),
    display_order: toInt(value.display_order, 0)
  };
}

function buildGoogleMapEmbedUrl(placeText = '') {
  const query = cleanString(placeText, 220);
  if (!query) return DEFAULT_CONTACT_SETTINGS.map_embed_url;
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

function extractIframeSrc(value = '') {
  const text = String(value || '');
  const match = text.match(/src\s*=\s*["']([^"']+)["']/i);
  return match ? String(match[1] || '').trim() : '';
}

function normalizeContactSettingsInput(value = {}) {
  const locationText = cleanString(value.location_text ?? value.locationText, 160);
  let mapEmbedRaw = String(value.map_embed_url ?? value.mapEmbedUrl ?? '').trim();

  if (/<iframe/i.test(mapEmbedRaw)) {
    mapEmbedRaw = extractIframeSrc(mapEmbedRaw);
  }

  let mapEmbedUrl = sanitizeUrl(mapEmbedRaw, 1200);
  if (mapEmbedUrl && !/^https?:\/\//i.test(mapEmbedUrl)) {
    mapEmbedUrl = '';
  }

  const resolvedLocation = locationText || DEFAULT_CONTACT_SETTINGS.location_text;
  return {
    location_text: resolvedLocation,
    map_embed_url: mapEmbedUrl || buildGoogleMapEmbedUrl(resolvedLocation)
  };
}

function normalizeResumeInput(value = {}) {
  return {
    full_name: cleanString(value.full_name, 160),
    headline: cleanString(value.headline, 220),
    email: cleanString(value.email, 180),
    phone: cleanString(value.phone, 80),
    location: cleanString(value.location, 160),
    website: sanitizeUrl(value.website, 500),
    linkedin_url: sanitizeUrl(value.linkedin_url, 500),
    github_url: sanitizeUrl(value.github_url, 500),
    summary: cleanMultilineText(value.summary, 5000),
    skills: cleanMultilineText(value.skills, 5000),
    experience: cleanMultilineText(value.experience, 12000),
    education: cleanMultilineText(value.education, 8000),
    projects: cleanMultilineText(value.projects, 10000),
    certifications: cleanMultilineText(value.certifications, 8000)
  };
}

function parseImageDataUrl(dataUrl) {
  const value = String(dataUrl || '');
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\n\r]+)$/);
  if (!match) return null;

  const mimeType = match[1].toLowerCase();
  const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
  if (!allowed.includes(mimeType)) return null;

  try {
    const bytes = Buffer.from(match[2], 'base64');
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return null;
    return {
      mimeType,
      bytes
    };
  } catch (_error) {
    return null;
  }
}

function parseResumeDataUrl(dataUrl) {
  const value = String(dataUrl || '');
  const match = value.match(/^data:([^;]+);base64,([A-Za-z0-9+/=\n\r]+)$/);
  if (!match) return null;

  const mimeType = match[1].toLowerCase();
  const allowed = [
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  if (!allowed.includes(mimeType)) return null;

  try {
    const bytes = Buffer.from(match[2], 'base64');
    if (!bytes.length || bytes.length > MAX_RESUME_BYTES) return null;
    return { mimeType, bytes };
  } catch (_error) {
    return null;
  }
}

function normalizeResumeUploadMeta(row = {}) {
  let feedback = [];
  try {
    feedback = Array.isArray(row.ats_feedback)
      ? row.ats_feedback
      : JSON.parse(row.ats_feedback || '[]');
  } catch (_error) {
    feedback = [];
  }

  return {
    id: toInt(row.id, 0),
    file_name: row.file_name || '',
    mime_type: row.mime_type || '',
    byte_size: toInt(row.byte_size, 0),
    ats_score: toInt(row.ats_score, 0),
    ats_feedback: feedback,
    updated_at: row.updated_at || row.created_at || null,
    download_url: row.id ? '/api/resume-upload/file' : ''
  };
}

function scoreAtsResume({ text = '', mimeType = '', fileName = '' } = {}) {
  const rawText = String(text || '');
  const normalized = rawText.toLowerCase();
  const words = normalized.match(/[a-z0-9+#.-]+/g) || [];
  const uniqueWords = new Set(words);
  const feedback = [];
  let score = 0;

  const hasEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(rawText);
  const hasPhone = /(\+?\d[\d\s().-]{7,}\d)/.test(rawText);
  const hasLinkedIn = /linkedin\.com/i.test(rawText);
  const hasGithub = /github\.com/i.test(rawText);

  if (hasEmail) score += 8; else feedback.push('Add a professional email address.');
  if (hasPhone) score += 7; else feedback.push('Add a reachable phone number.');
  if (hasLinkedIn || hasGithub) score += 8; else feedback.push('Add LinkedIn or GitHub profile links.');

  const sectionChecks = [
    ['summary', 'Add a clear professional summary section.'],
    ['skills', 'Add a dedicated skills section with role keywords.'],
    ['experience', 'Add an experience section with company, role, and dates.'],
    ['education', 'Add education details.'],
    ['projects', 'Add project details linked to your target role.']
  ];
  sectionChecks.forEach(([keyword, message]) => {
    if (normalized.includes(keyword)) score += 6;
    else feedback.push(message);
  });

  const skillKeywords = [
    'python', 'sql', 'excel', 'power bi', 'tableau', 'dashboard', 'analytics',
    'machine learning', 'javascript', 'node', 'mysql', 'api', 'data visualization'
  ];
  const matchedSkills = skillKeywords.filter((keyword) => normalized.includes(keyword));
  score += Math.min(15, matchedSkills.length * 3);
  if (matchedSkills.length < 5) {
    feedback.push('Add more target-role keywords such as Python, SQL, dashboards, analytics, APIs, or visualization tools.');
  }

  const actionVerbs = ['built', 'created', 'improved', 'optimized', 'analyzed', 'developed', 'automated', 'delivered', 'designed'];
  const matchedVerbs = actionVerbs.filter((verb) => normalized.includes(verb));
  score += Math.min(10, matchedVerbs.length * 2);
  if (matchedVerbs.length < 4) {
    feedback.push('Use stronger action verbs like built, automated, analyzed, optimized, and delivered.');
  }

  const hasMetrics = /(\d+%|\d+\+|\$\d+|\d+\s*(users|projects|dashboards|reports|hours|days|months|years))/i.test(rawText);
  if (hasMetrics) score += 10;
  else feedback.push('Add measurable impact: percentages, counts, time saved, users, dashboards, or project results.');

  if (words.length >= 280 && words.length <= 900) score += 10;
  else if (words.length < 280) feedback.push('Resume text is short; add more role-specific achievements and project details.');
  else feedback.push('Resume is long; keep it focused and easy for ATS to parse.');

  const safeFileName = String(fileName || '').toLowerCase();
  if (['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(mimeType)) {
    score += 7;
  } else {
    feedback.push('Upload PDF, DOCX, or TXT instead of image-based resume formats.');
  }
  if (!/\s{4,}|\|{3,}|-{5,}/.test(rawText)) score += 5;
  else feedback.push('Avoid heavy tables, repeated separators, or complex formatting.');

  if (safeFileName.includes('resume') || safeFileName.includes('cv')) score += 2;
  if (uniqueWords.size > 120) score += 3;

  const finalScore = Math.max(0, Math.min(100, score));
  if (finalScore >= 85) feedback.unshift('Strong ATS-friendly resume. Keep tailoring keywords for each job description.');
  else if (finalScore >= 70) feedback.unshift('Good resume. A few keyword and measurable-impact improvements can raise the score.');
  else feedback.unshift('Needs improvement. Add missing sections, keywords, links, and measurable achievements.');

  return {
    score: finalScore,
    feedback: feedback.slice(0, 8)
  };
}

function buildUploadPath(id) {
  return `/api/uploads/image/${id}`;
}

function buildAbsoluteUrl(req, pathValue) {
  const protocol = req.protocol || 'http';
  const host = req.get('host') || `localhost:${PORT}`;
  return `${protocol}://${host}${pathValue}`;
}

function extractUploadImageIdFromUrl(value) {
  const text = String(value || '');
  const match = text.match(/\/api\/uploads\/image\/(\d+)/i);
  if (!match) return 0;
  return toInt(match[1], 0);
}

async function q(sql, params = []) {
  const [rows] = await db.execute(sql, params);
  return rows;
}

async function tableHasRows(tableName) {
  const rows = await q(`SELECT COUNT(*) AS total FROM ${tableName}`);
  return Number(rows[0]?.total || 0) > 0;
}

async function ensureColumn(tableName, columnName, definitionSql) {
  const rows = await q(
    `SELECT COUNT(*) AS total
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [DB_NAME, tableName, columnName]
  );

  const exists = Number(rows[0]?.total || 0) > 0;
  if (!exists) {
    await q(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definitionSql}`);
  }
}

async function findUniqueSlug(tableName, titleValue, excludeId = 0) {
  const safeTable = String(tableName || '').trim();
  if (!['projects', 'blogs'].includes(safeTable)) return '';

  const base = slugifyText(titleValue, 110) || 'item';
  let candidate = base;
  let counter = 2;

  while (true) {
    const rows = await q(`SELECT id FROM ${safeTable} WHERE slug = ? LIMIT 1`, [candidate]);
    const foundId = toInt(rows[0]?.id, 0);
    if (!foundId || foundId === toInt(excludeId, 0)) {
      return candidate;
    }
    candidate = `${base}-${counter}`;
    counter += 1;
  }
}

async function backfillMissingSlugs(tableName) {
  const safeTable = String(tableName || '').trim();
  if (!['projects', 'blogs'].includes(safeTable)) return;

  const rows = await q(`SELECT id, title, slug FROM ${safeTable} ORDER BY id ASC`);
  for (const row of rows) {
    const id = toInt(row.id, 0);
    const existing = slugifyText(row.slug, 110);
    if (id && !existing) {
      const generated = await findUniqueSlug(safeTable, row.title || `item-${id}`, id);
      await q(`UPDATE ${safeTable} SET slug = ? WHERE id = ?`, [generated, id]);
    }
  }
}

async function cleanupImageIfUnused(imageId) {
  const safeId = toInt(imageId, 0);
  if (!safeId) return;

  const [projectRows, blogRows] = await Promise.all([
    q('SELECT COUNT(*) AS total FROM projects WHERE image_id = ?', [safeId]),
    q('SELECT COUNT(*) AS total FROM blogs WHERE image_id = ?', [safeId])
  ]);

  const projectCount = Number(projectRows[0]?.total || 0);
  const blogCount = Number(blogRows[0]?.total || 0);

  if (projectCount === 0 && blogCount === 0) {
    await q('DELETE FROM uploaded_images WHERE id = ?', [safeId]);
  }
}

/* ============================================================
   DB SCHEMA SECTION (AUTO CREATE TABLES + DEFAULT SEED)
   ============================================================ */
async function ensureSchema() {
  await q(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(160) NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS contact_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      location_text VARCHAR(160) NOT NULL,
      map_embed_url VARCHAR(1200) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      role VARCHAR(160) NULL,
      rating TINYINT NOT NULL,
      text TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS visits (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ip VARCHAR(120) NULL,
      page VARCHAR(255) NULL,
      time_spent BIGINT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS uploaded_images (
      id INT AUTO_INCREMENT PRIMARY KEY,
      owner_type VARCHAR(30) NULL,
      file_name VARCHAR(255) NULL,
      mime_type VARCHAR(120) NOT NULL,
      file_data LONGBLOB NOT NULL,
      byte_size INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS projects (
      id INT AUTO_INCREMENT PRIMARY KEY,
      category VARCHAR(20) NOT NULL DEFAULT 'web',
      category_label VARCHAR(60) NULL,
      title VARCHAR(180) NOT NULL,
      slug VARCHAR(220) NULL,
      tech VARCHAR(220) NULL,
      description TEXT NOT NULL,
      content LONGTEXT NULL,
      image_url VARCHAR(500) NULL,
      live_demo_url VARCHAR(500) NULL,
      github_url VARCHAR(500) NULL,
      linkedin_url VARCHAR(500) NULL,
      video_url VARCHAR(500) NULL,
      extra_label VARCHAR(80) NULL,
      extra_url VARCHAR(500) NULL,
      is_featured TINYINT NOT NULL DEFAULT 1,
      display_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS blogs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      slug VARCHAR(240) NULL,
      summary TEXT NOT NULL,
      content LONGTEXT NULL,
      image_url VARCHAR(500) NULL,
      read_more_url VARCHAR(500) NULL,
      github_url VARCHAR(500) NULL,
      linkedin_url VARCHAR(500) NULL,
      video_url VARCHAR(500) NULL,
      extra_label VARCHAR(80) NULL,
      extra_url VARCHAR(500) NULL,
      is_published TINYINT NOT NULL DEFAULT 1,
      display_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS about_content (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tagline VARCHAR(220) NOT NULL,
      headline VARCHAR(220) NOT NULL,
      paragraph_1 TEXT NOT NULL,
      paragraph_2 TEXT NULL,
      paragraph_3 TEXT NULL,
      experience_summary VARCHAR(160) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS about_experiences (
      id INT AUTO_INCREMENT PRIMARY KEY,
      year_label VARCHAR(60) NOT NULL,
      company_name VARCHAR(160) NOT NULL,
      job_role VARCHAR(160) NOT NULL,
      position_title VARCHAR(160) NOT NULL,
      description TEXT NULL,
      display_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  /* Resume builder data is admin-managed and rendered as a downloadable PDF page. */
  await q(`
    CREATE TABLE IF NOT EXISTS resume_content (
      id INT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(160) NOT NULL,
      headline VARCHAR(220) NOT NULL,
      email VARCHAR(180) NULL,
      phone VARCHAR(80) NULL,
      location VARCHAR(160) NULL,
      website VARCHAR(500) NULL,
      linkedin_url VARCHAR(500) NULL,
      github_url VARCHAR(500) NULL,
      summary TEXT NULL,
      skills TEXT NULL,
      experience LONGTEXT NULL,
      education LONGTEXT NULL,
      projects LONGTEXT NULL,
      certifications LONGTEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  /* Uploaded CV file + ATS analysis result for frontend score display. */
  await q(`
    CREATE TABLE IF NOT EXISTS resume_uploads (
      id INT AUTO_INCREMENT PRIMARY KEY,
      file_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(140) NOT NULL,
      file_data LONGBLOB NOT NULL,
      byte_size INT NOT NULL,
      ats_text LONGTEXT NULL,
      ats_score INT NOT NULL DEFAULT 0,
      ats_feedback JSON NULL,
      active TINYINT NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Existing DB compatibility columns
  await ensureColumn('projects', 'image_id', 'INT NULL AFTER image_url');
  await ensureColumn('projects', 'slug', 'VARCHAR(220) NULL AFTER title');
  await ensureColumn('projects', 'linkedin_url', 'VARCHAR(500) NULL AFTER github_url');
  await ensureColumn('projects', 'content', 'LONGTEXT NULL AFTER description');
  await ensureColumn('blogs', 'image_id', 'INT NULL AFTER image_url');
  await ensureColumn('blogs', 'slug', 'VARCHAR(240) NULL AFTER title');
  await ensureColumn('blogs', 'linkedin_url', 'VARCHAR(500) NULL AFTER github_url');
  await ensureColumn('about_content', 'tagline', 'VARCHAR(220) NOT NULL DEFAULT "" AFTER id');
  await ensureColumn('about_content', 'headline', 'VARCHAR(220) NOT NULL DEFAULT "" AFTER tagline');
  await ensureColumn('about_content', 'paragraph_1', 'TEXT NULL AFTER headline');
  await ensureColumn('about_content', 'paragraph_2', 'TEXT NULL AFTER paragraph_1');
  await ensureColumn('about_content', 'paragraph_3', 'TEXT NULL AFTER paragraph_2');
  await ensureColumn('about_content', 'experience_summary', 'VARCHAR(160) NOT NULL DEFAULT "" AFTER paragraph_3');
  await ensureColumn('about_experiences', 'year_label', 'VARCHAR(60) NOT NULL DEFAULT "" AFTER id');
  await ensureColumn('about_experiences', 'company_name', 'VARCHAR(160) NOT NULL DEFAULT "" AFTER year_label');
  await ensureColumn('about_experiences', 'job_role', 'VARCHAR(160) NOT NULL DEFAULT "" AFTER company_name');
  await ensureColumn('about_experiences', 'position_title', 'VARCHAR(160) NOT NULL DEFAULT "" AFTER job_role');
  await ensureColumn('about_experiences', 'description', 'TEXT NULL AFTER position_title');
  await ensureColumn('about_experiences', 'display_order', 'INT NOT NULL DEFAULT 0 AFTER description');
  await ensureColumn('contact_settings', 'location_text', 'VARCHAR(160) NOT NULL DEFAULT "Indore, India" AFTER id');
  await ensureColumn('contact_settings', 'map_embed_url', 'VARCHAR(1200) NOT NULL DEFAULT "" AFTER location_text');
  await ensureColumn('resume_content', 'full_name', 'VARCHAR(160) NOT NULL DEFAULT "" AFTER id');
  await ensureColumn('resume_content', 'headline', 'VARCHAR(220) NOT NULL DEFAULT "" AFTER full_name');
  await ensureColumn('resume_content', 'email', 'VARCHAR(180) NULL AFTER headline');
  await ensureColumn('resume_content', 'phone', 'VARCHAR(80) NULL AFTER email');
  await ensureColumn('resume_content', 'location', 'VARCHAR(160) NULL AFTER phone');
  await ensureColumn('resume_content', 'website', 'VARCHAR(500) NULL AFTER location');
  await ensureColumn('resume_content', 'linkedin_url', 'VARCHAR(500) NULL AFTER website');
  await ensureColumn('resume_content', 'github_url', 'VARCHAR(500) NULL AFTER linkedin_url');
  await ensureColumn('resume_content', 'summary', 'TEXT NULL AFTER github_url');
  await ensureColumn('resume_content', 'skills', 'TEXT NULL AFTER summary');
  await ensureColumn('resume_content', 'experience', 'LONGTEXT NULL AFTER skills');
  await ensureColumn('resume_content', 'education', 'LONGTEXT NULL AFTER experience');
  await ensureColumn('resume_content', 'projects', 'LONGTEXT NULL AFTER education');
  await ensureColumn('resume_content', 'certifications', 'LONGTEXT NULL AFTER projects');
  await ensureColumn('resume_uploads', 'file_name', 'VARCHAR(255) NOT NULL DEFAULT "" AFTER id');
  await ensureColumn('resume_uploads', 'mime_type', 'VARCHAR(140) NOT NULL DEFAULT "" AFTER file_name');
  await ensureColumn('resume_uploads', 'file_data', 'LONGBLOB NULL AFTER mime_type');
  await ensureColumn('resume_uploads', 'byte_size', 'INT NOT NULL DEFAULT 0 AFTER file_data');
  await ensureColumn('resume_uploads', 'ats_text', 'LONGTEXT NULL AFTER byte_size');
  await ensureColumn('resume_uploads', 'ats_score', 'INT NOT NULL DEFAULT 0 AFTER ats_text');
  await ensureColumn('resume_uploads', 'ats_feedback', 'JSON NULL AFTER ats_score');
  await ensureColumn('resume_uploads', 'active', 'TINYINT NOT NULL DEFAULT 1 AFTER ats_feedback');

  const projectsAlready = await tableHasRows('projects');
  if (!projectsAlready) {
    await q(
      `INSERT INTO projects
      (category, category_label, title, tech, description, image_url, image_id, live_demo_url, github_url, is_featured, display_order)
      VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'ai', 'AI', 'AI Chatbot', 'Python, NLP', 'Conversational AI chatbot trained on custom dataset.', 'image/AI UI.png', null, 'moreproject/project-ai.html', 'https://github.com/ck122c', 1, 1,
        'web', 'Web Development', 'Portfolio Website', 'HTML, CSS, JS, AI', 'Responsive personal portfolio website with modern UI.', 'image/Portfolio UI.png', null, 'moreproject/project-web.html', 'https://github.com/ck122c', 1, 1,
        'web', 'Web Development', 'Portfolio Website v2', 'HTML, CSS, JS', 'Alternate portfolio design with clean responsive layout.', 'image/Portfolio UI 2.png', null, 'moreproject/project-web-2.html', 'https://github.com/ck122c', 0, 2,
        'viz', 'Data Analyst', 'Sales Dashboard', 'Power BI, Excel, DAX', 'Interactive dashboard showing sales performance and analytics.', 'image/Pawer BI.png', null, 'moreproject/project-data.html', 'https://github.com/ck122c/Power-BI', 1, 1
      ]
    );
  }

  const blogsAlready = await tableHasRows('blogs');
  if (!blogsAlready) {
    await q(
      `INSERT INTO blogs
      (title, summary, content, image_url, image_id, read_more_url, is_published, display_order)
      VALUES
      (?, ?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'Getting Started with Machine Learning',
        'A beginner-friendly guide to understanding ML basics and practical applications.',
        'Machine Learning ki shuruaat data, features aur model selection se hoti hai. Is article me aap supervised vs unsupervised, train-test split, aur model evaluation ka practical flow seekhenge.',
        'image/AI UI.png',
        null,
        '#',
        1,
        1,

        'Top 5 Data Visualization Techniques',
        'Explore creative and effective ways to visualize your data for maximum impact.',
        'Visualization me story-telling bahut important hota hai. Bar chart, line chart, heatmap, scatter plot aur dashboard composition ka smart combination business insights ko clear banata hai.',
        'image/Pawer BI.png',
        null,
        '#',
        1,
        2,

        'The Future of AI in India',
        'A deep dive into how AI is transforming industries and creating opportunities in India.',
        'India me AI adoption fintech, healthtech, education aur manufacturing me rapidly grow kar raha hai. Skill development, responsible AI aur domain-specific implementation agle 5 saal me major role play karenge.',
        'image/Portfolio UI 2.png',
        null,
        '#',
        1,
        3
      ]
    );
  }

  await backfillMissingSlugs('projects');
  await backfillMissingSlugs('blogs');

  const aboutContentAlready = await tableHasRows('about_content');
  if (!aboutContentAlready) {
    await q(
      `INSERT INTO about_content
      (tagline, headline, paragraph_1, paragraph_2, paragraph_3, experience_summary)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        DEFAULT_ABOUT_CONTENT.tagline,
        DEFAULT_ABOUT_CONTENT.headline,
        DEFAULT_ABOUT_CONTENT.paragraph_1,
        DEFAULT_ABOUT_CONTENT.paragraph_2,
        DEFAULT_ABOUT_CONTENT.paragraph_3,
        DEFAULT_ABOUT_CONTENT.experience_summary
      ]
    );
  }

  const aboutExpAlready = await tableHasRows('about_experiences');
  if (!aboutExpAlready) {
    for (const item of DEFAULT_EXPERIENCES) {
      await q(
        `INSERT INTO about_experiences
        (year_label, company_name, job_role, position_title, description, display_order)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          item.year_label,
          item.company_name,
          item.job_role,
          item.position_title,
          item.description || null,
          toInt(item.display_order, 0)
        ]
      );
    }
  }

  const contactSettingsAlready = await tableHasRows('contact_settings');
  if (!contactSettingsAlready) {
    await q(
      `INSERT INTO contact_settings
      (location_text, map_embed_url)
      VALUES (?, ?)`,
      [DEFAULT_CONTACT_SETTINGS.location_text, DEFAULT_CONTACT_SETTINGS.map_embed_url]
    );
  }

  const resumeAlready = await tableHasRows('resume_content');
  if (!resumeAlready) {
    await q(
      `INSERT INTO resume_content
      (full_name, headline, email, phone, location, website, linkedin_url, github_url, summary, skills, experience, education, projects, certifications)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        DEFAULT_RESUME_CONTENT.full_name,
        DEFAULT_RESUME_CONTENT.headline,
        DEFAULT_RESUME_CONTENT.email,
        DEFAULT_RESUME_CONTENT.phone || null,
        DEFAULT_RESUME_CONTENT.location,
        DEFAULT_RESUME_CONTENT.website || null,
        DEFAULT_RESUME_CONTENT.linkedin_url || null,
        DEFAULT_RESUME_CONTENT.github_url || null,
        DEFAULT_RESUME_CONTENT.summary || null,
        DEFAULT_RESUME_CONTENT.skills || null,
        DEFAULT_RESUME_CONTENT.experience || null,
        DEFAULT_RESUME_CONTENT.education || null,
        DEFAULT_RESUME_CONTENT.projects || null,
        DEFAULT_RESUME_CONTENT.certifications || null
      ]
    );
  }

}

/* ============================================================
   UPLOAD APIs SECTION (IMAGE STORED IN SQL DB)
   ============================================================ */
app.post('/api/uploads/image', requireAdminAuth, async (req, res) => {
  try {
    const dataUrl = req.body?.dataUrl;
    const fileName = cleanString(req.body?.fileName, 255);
    const ownerType = cleanString(req.body?.ownerType, 30);

    const parsed = parseImageDataUrl(dataUrl);
    if (!parsed) {
      return res.status(400).json({
        success: false,
        error: 'Invalid image. Allowed: PNG/JPEG/JPG/WEBP/GIF and max size 5MB.'
      });
    }

    const result = await q(
      `INSERT INTO uploaded_images (owner_type, file_name, mime_type, file_data, byte_size)
       VALUES (?, ?, ?, ?, ?)`,
      [ownerType || null, fileName || null, parsed.mimeType, parsed.bytes, parsed.bytes.length]
    );

    const imageId = Number(result.insertId || 0);
    const imagePath = buildUploadPath(imageId);

    return res.status(201).json({
      success: true,
      image_id: imageId,
      image_url: imagePath,
      image_public_url: buildAbsoluteUrl(req, imagePath)
    });
  } catch (error) {
    console.error('❌ Upload Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to upload image' });
  }
});

app.get('/api/uploads/image/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, 0);
    if (!id) return res.status(400).send('Invalid image id');

    const rows = await q(
      'SELECT mime_type, file_data FROM uploaded_images WHERE id = ? LIMIT 1',
      [id]
    );

    if (!rows.length || !rows[0].file_data) {
      return res.status(404).send('Image not found');
    }

    res.setHeader('Content-Type', rows[0].mime_type || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(rows[0].file_data);
  } catch (error) {
    return res.status(500).send('Failed to load image');
  }
});

/* ============================================================
   CONTACT SETTINGS APIs SECTION
   ============================================================ */
app.get('/api/contact-settings', async (_req, res) => {
  try {
    const rows = await q('SELECT * FROM contact_settings ORDER BY id ASC LIMIT 1');
    const settings = rows[0] || { id: 0, ...DEFAULT_CONTACT_SETTINGS };
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.json({ success: true, settings });
  } catch (_error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch contact settings' });
  }
});

app.put('/api/contact-settings', requireAdminAuth, async (req, res) => {
  try {
    const payload = normalizeContactSettingsInput(req.body || {});
    const rows = await q('SELECT id FROM contact_settings ORDER BY id ASC LIMIT 1');
    const existingId = toInt(rows[0]?.id, 0);

    if (existingId) {
      await q(
        `UPDATE contact_settings
         SET location_text = ?, map_embed_url = ?
         WHERE id = ?`,
        [payload.location_text, payload.map_embed_url, existingId]
      );
    } else {
      await q(
        `INSERT INTO contact_settings
         (location_text, map_embed_url)
         VALUES (?, ?)`,
        [payload.location_text, payload.map_embed_url]
      );
    }

    return res.json({ success: true, message: 'Contact location updated' });
  } catch (_error) {
    return res.status(500).json({ success: false, error: 'Failed to update contact settings' });
  }
});

/* ============================================================
   RESUME BUILDER APIs SECTION (ADMIN MANAGED PDF CONTENT)
   ============================================================ */
app.get('/api/resume', async (_req, res) => {
  try {
    const [rows, uploadRows] = await Promise.all([
      q('SELECT * FROM resume_content ORDER BY id ASC LIMIT 1'),
      q(`SELECT id, file_name, mime_type, byte_size, ats_score, ats_feedback, created_at, updated_at
         FROM resume_uploads
         WHERE active = 1
         ORDER BY id DESC
         LIMIT 1`)
    ]);
    const resume = rows[0] || { id: 0, ...DEFAULT_RESUME_CONTENT };
    const upload = uploadRows[0] ? normalizeResumeUploadMeta(uploadRows[0]) : null;
    return res.json({ success: true, resume, upload });
  } catch (_error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch resume content' });
  }
});

app.put('/api/resume', requireAdminAuth, async (req, res) => {
  try {
    const payload = normalizeResumeInput(req.body || {});

    if (!payload.full_name || !payload.headline || !payload.summary) {
      return res.status(400).json({
        success: false,
        error: 'Full name, headline, and summary are required'
      });
    }

    const rows = await q('SELECT id FROM resume_content ORDER BY id ASC LIMIT 1');
    const existingId = toInt(rows[0]?.id, 0);
    const values = [
      payload.full_name,
      payload.headline,
      payload.email || null,
      payload.phone || null,
      payload.location || null,
      payload.website || null,
      payload.linkedin_url || null,
      payload.github_url || null,
      payload.summary || null,
      payload.skills || null,
      payload.experience || null,
      payload.education || null,
      payload.projects || null,
      payload.certifications || null
    ];

    if (existingId) {
      await q(
        `UPDATE resume_content
         SET full_name = ?, headline = ?, email = ?, phone = ?, location = ?, website = ?,
             linkedin_url = ?, github_url = ?, summary = ?, skills = ?, experience = ?,
             education = ?, projects = ?, certifications = ?
         WHERE id = ?`,
        [...values, existingId]
      );
    } else {
      await q(
        `INSERT INTO resume_content
         (full_name, headline, email, phone, location, website, linkedin_url, github_url, summary, skills, experience, education, projects, certifications)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        values
      );
    }

    return res.json({ success: true, message: 'Resume content updated' });
  } catch (_error) {
    return res.status(500).json({ success: false, error: 'Failed to update resume content' });
  }
});

app.get('/api/resume-upload', async (_req, res) => {
  try {
    const rows = await q(
      `SELECT id, file_name, mime_type, byte_size, ats_score, ats_feedback, created_at, updated_at
       FROM resume_uploads
       WHERE active = 1
       ORDER BY id DESC
       LIMIT 1`
    );
    return res.json({
      success: true,
      upload: rows[0] ? normalizeResumeUploadMeta(rows[0]) : null
    });
  } catch (_error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch uploaded resume' });
  }
});

app.get('/api/resume-upload/file', async (_req, res) => {
  try {
    const rows = await q(
      `SELECT file_name, mime_type, file_data
       FROM resume_uploads
       WHERE active = 1
       ORDER BY id DESC
       LIMIT 1`
    );

    if (!rows.length || !rows[0].file_data) {
      return res.status(404).send('Resume file not found');
    }

    const safeFileName = cleanString(rows[0].file_name, 255) || 'resume.pdf';
    res.setHeader('Content-Type', rows[0].mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName.replace(/"/g, '')}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(rows[0].file_data);
  } catch (_error) {
    return res.status(500).send('Failed to download resume');
  }
});

app.post('/api/resume-upload', requireAdminAuth, async (req, res) => {
  try {
    const dataUrl = req.body?.dataUrl;
    const fileName = cleanString(req.body?.fileName, 255);
    let atsText = cleanMultilineText(req.body?.ats_text, 30000);

    const parsed = parseResumeDataUrl(dataUrl);
    if (!parsed || !fileName) {
      return res.status(400).json({
        success: false,
        error: 'Upload a PDF, DOC, DOCX, or TXT resume file under 8MB'
      });
    }

    if (!atsText && parsed.mimeType === 'text/plain') {
      atsText = parsed.bytes.toString('utf8').slice(0, 30000);
    }

    if (!atsText) {
      const rows = await q('SELECT * FROM resume_content ORDER BY id ASC LIMIT 1');
      const resume = rows[0] || DEFAULT_RESUME_CONTENT;
      atsText = [
        resume.full_name,
        resume.headline,
        resume.email,
        resume.phone,
        resume.location,
        resume.website,
        resume.linkedin_url,
        resume.github_url,
        resume.summary,
        resume.skills,
        resume.experience,
        resume.education,
        resume.projects,
        resume.certifications
      ].filter(Boolean).join('\n\n');
    }

    const analysis = scoreAtsResume({
      text: atsText,
      mimeType: parsed.mimeType,
      fileName
    });

    await q('UPDATE resume_uploads SET active = 0 WHERE active = 1');
    const result = await q(
      `INSERT INTO resume_uploads
       (file_name, mime_type, file_data, byte_size, ats_text, ats_score, ats_feedback, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        fileName,
        parsed.mimeType,
        parsed.bytes,
        parsed.bytes.length,
        atsText || null,
        analysis.score,
        JSON.stringify(analysis.feedback)
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Resume uploaded and ATS score generated',
      upload: normalizeResumeUploadMeta({
        id: result.insertId,
        file_name: fileName,
        mime_type: parsed.mimeType,
        byte_size: parsed.bytes.length,
        ats_score: analysis.score,
        ats_feedback: analysis.feedback
      })
    });
  } catch (error) {
    console.error('❌ Resume Upload Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to upload resume' });
  }
});

app.delete('/api/resume-upload', requireAdminAuth, async (_req, res) => {
  try {
    await q('UPDATE resume_uploads SET active = 0 WHERE active = 1');
    return res.json({ success: true, message: 'Uploaded resume removed' });
  } catch (_error) {
    return res.status(500).json({ success: false, error: 'Failed to remove uploaded resume' });
  }
});

/* ============================================================
   CONTACT APIs SECTION
   ============================================================ */
app.post('/api/contact', async (req, res) => {
  try {
    const name = cleanString(req.body?.name, 120);
    const email = cleanString(req.body?.email, 160);
    const message = cleanString(req.body?.message, 2000);

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, error: 'All fields required' });
    }

    await q('INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)', [name, email, message]);
    queueEmailAlert('New Contact Form Submission', {
      Name: name,
      Email: email,
      Message: message,
      Page: cleanString(req.headers.referer, 255) || 'Contact section',
      Time: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    });

    return res.json({ success: true, message: 'Message saved' });
  } catch (error) {
    console.error('❌ Contact Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to save contact' });
  }
});

app.get('/api/contact', requireAdminAuth, async (_req, res) => {
  try {
    const rows = await q('SELECT * FROM contacts ORDER BY id DESC');
    return res.json(rows);
  } catch (_error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch contacts' });
  }
});

app.delete('/api/contact/:id', requireAdminAuth, async (req, res) => {
  try {
    await q('DELETE FROM contacts WHERE id = ?', [toInt(req.params.id, 0)]);
    return res.json({ success: true });
  } catch (_error) {
    return res.status(500).json({ success: false, error: 'Failed to delete contact' });
  }
});

/* ============================================================
   REVIEWS APIs SECTION
   ============================================================ */
app.post('/api/reviews', async (req, res) => {
  try {
    const name = cleanString(req.body?.name, 120);
    const role = cleanString(req.body?.role, 160);
    const text = cleanString(req.body?.text, 1000);
    const rating = Math.max(1, Math.min(5, toInt(req.body?.rating, 5)));

    if (!name || !text) {
      return res.status(400).json({ success: false, error: 'Name and review required' });
    }

    await q('INSERT INTO reviews (name, role, text, rating) VALUES (?, ?, ?, ?)', [name, role || null, text, rating]);
    queueEmailAlert('New Review Submitted', {
      Name: name,
      Role: role || 'Not provided',
      Rating: `${rating} / 5`,
      Review: text,
      Page: cleanString(req.headers.referer, 255) || 'Review section',
      Time: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    });

    return res.json({ success: true, message: 'Review added' });
  } catch (error) {
    console.error('❌ Review Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to save review' });
  }
});

app.get('/api/reviews', async (_req, res) => {
  try {
    const rows = await q('SELECT * FROM reviews ORDER BY id DESC');
    return res.json(rows);
  } catch (_error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch reviews' });
  }
});

app.put('/api/reviews/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = toInt(req.params.id, 0);
    const name = cleanString(req.body?.name, 120);
    const role = cleanString(req.body?.role, 160);
    const text = cleanString(req.body?.text, 1000);
    const rating = Math.max(1, Math.min(5, toInt(req.body?.rating, 5)));

    if (!id || !name || !text) {
      return res.status(400).json({ success: false, error: 'Invalid review data' });
    }

    await q('UPDATE reviews SET name = ?, role = ?, rating = ?, text = ? WHERE id = ?', [name, role || null, rating, text, id]);
    return res.json({ success: true });
  } catch (_error) {
    return res.status(500).json({ success: false, error: 'Failed to update review' });
  }
});

app.delete('/api/reviews/:id', requireAdminAuth, async (req, res) => {
  try {
    await q('DELETE FROM reviews WHERE id = ?', [toInt(req.params.id, 0)]);
    return res.json({ success: true });
  } catch (_error) {
    return res.status(500).json({ success: false, error: 'Failed to delete review' });
  }
});

/* ============================================================
   ABOUT APIs SECTION (ADMIN MANAGED)
   ============================================================ */
app.get('/api/about', async (_req, res) => {
  try {
    const [aboutRows, expRows] = await Promise.all([
      q('SELECT * FROM about_content ORDER BY id ASC LIMIT 1'),
      q('SELECT * FROM about_experiences ORDER BY display_order ASC, id ASC')
    ]);

    const about = aboutRows[0] || {
      ...DEFAULT_ABOUT_CONTENT,
      id: 0
    };

    return res.json({
      success: true,
      about,
      experiences: expRows
    });
  } catch (_error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch about content' });
  }
});

app.put('/api/about', requireAdminAuth, async (req, res) => {
  try {
    const payload = normalizeAboutContentInput(req.body || {});

    if (!payload.headline || !payload.paragraph_1 || !payload.experience_summary) {
      return res.status(400).json({
        success: false,
        error: 'Headline, paragraph 1, and experience summary are required'
      });
    }

    const rows = await q('SELECT id FROM about_content ORDER BY id ASC LIMIT 1');
    const existingId = toInt(rows[0]?.id, 0);

    if (existingId) {
      await q(
        `UPDATE about_content
         SET tagline = ?, headline = ?, paragraph_1 = ?, paragraph_2 = ?, paragraph_3 = ?, experience_summary = ?
         WHERE id = ?`,
        [
          payload.tagline || DEFAULT_ABOUT_CONTENT.tagline,
          payload.headline,
          payload.paragraph_1,
          payload.paragraph_2 || null,
          payload.paragraph_3 || null,
          payload.experience_summary,
          existingId
        ]
      );
    } else {
      await q(
        `INSERT INTO about_content
         (tagline, headline, paragraph_1, paragraph_2, paragraph_3, experience_summary)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          payload.tagline || DEFAULT_ABOUT_CONTENT.tagline,
          payload.headline,
          payload.paragraph_1,
          payload.paragraph_2 || null,
          payload.paragraph_3 || null,
          payload.experience_summary
        ]
      );
    }

    return res.json({ success: true, message: 'About section updated' });
  } catch (_error) {
    return res.status(500).json({ success: false, error: 'Failed to update about section' });
  }
});

app.post('/api/about/experiences', requireAdminAuth, async (req, res) => {
  try {
    const payload = normalizeExperienceInput(req.body || {});
    if (!payload.year_label || !payload.company_name || !payload.job_role || !payload.position_title) {
      return res.status(400).json({
        success: false,
        error: 'Year, company, job role, and position are required'
      });
    }

    await q(
      `INSERT INTO about_experiences
      (year_label, company_name, job_role, position_title, description, display_order)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        payload.year_label,
        payload.company_name,
        payload.job_role,
        payload.position_title,
        payload.description || null,
        payload.display_order
      ]
    );

    return res.status(201).json({ success: true, message: 'Experience added' });
  } catch (_error) {
    return res.status(500).json({ success: false, error: 'Failed to add experience' });
  }
});

app.put('/api/about/experiences/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = toInt(req.params.id, 0);
    if (!id) return res.status(400).json({ success: false, error: 'Invalid experience id' });

    const payload = normalizeExperienceInput(req.body || {});
    if (!payload.year_label || !payload.company_name || !payload.job_role || !payload.position_title) {
      return res.status(400).json({
        success: false,
        error: 'Year, company, job role, and position are required'
      });
    }

    await q(
      `UPDATE about_experiences
       SET year_label = ?, company_name = ?, job_role = ?, position_title = ?, description = ?, display_order = ?
       WHERE id = ?`,
      [
        payload.year_label,
        payload.company_name,
        payload.job_role,
        payload.position_title,
        payload.description || null,
        payload.display_order,
        id
      ]
    );

    return res.json({ success: true, message: 'Experience updated' });
  } catch (_error) {
    return res.status(500).json({ success: false, error: 'Failed to update experience' });
  }
});

app.delete('/api/about/experiences/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = toInt(req.params.id, 0);
    if (!id) return res.status(400).json({ success: false, error: 'Invalid experience id' });
    await q('DELETE FROM about_experiences WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Experience deleted' });
  } catch (_error) {
    return res.status(500).json({ success: false, error: 'Failed to delete experience' });
  }
});

/* ============================================================
   PROJECT APIs SECTION (ADMIN MANAGED)
   ============================================================ */
app.get('/api/projects', async (req, res) => {
  try {
    const category = cleanString(req.query.category, 20).toLowerCase();
    const featuredOnly = String(req.query.featured || '') === '1';

    let sql = 'SELECT * FROM projects WHERE 1=1';
    const params = [];

    if (['ai', 'web', 'viz'].includes(category)) {
      sql += ' AND category = ?';
      params.push(category);
    }

    if (featuredOnly) {
      sql += ' AND is_featured = 1';
    }

    sql += ' ORDER BY display_order ASC, id DESC';

    const rows = await q(sql, params);
    return res.json(rows);
  } catch (error) {
    console.error('❌ Projects Fetch Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch projects' });
  }
});

app.get('/api/projects/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, 0);
    if (!id) return res.status(400).json({ success: false, error: 'Invalid project id' });

    const rows = await q('SELECT * FROM projects WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    return res.json({ success: true, project: rows[0] });
  } catch (_error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch project' });
  }
});

app.get('/api/projects/slug/:slug', async (req, res) => {
  try {
    const slug = slugifyText(req.params.slug, 110);
    if (!slug) return res.status(400).json({ success: false, error: 'Invalid project slug' });

    const rows = await q('SELECT * FROM projects WHERE slug = ? LIMIT 1', [slug]);
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    return res.json({ success: true, project: rows[0] });
  } catch (_error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch project by slug' });
  }
});

app.post('/api/projects', requireAdminAuth, async (req, res) => {
  try {
    const payload = {
      category: normalizeCategory(req.body?.category),
      category_label: cleanString(req.body?.category_label, 60),
      title: cleanString(req.body?.title, 180),
      tech: cleanString(req.body?.tech, 220),
      description: cleanString(req.body?.description, 2000),
      content: cleanMultilineText(req.body?.content, 12000),
      image_url: sanitizeUrl(req.body?.image_url, 500),
      image_id: toInt(req.body?.image_id, 0),
      live_demo_url: sanitizeUrl(req.body?.live_demo_url, 500),
      github_url: sanitizeUrl(req.body?.github_url, 500),
      linkedin_url: sanitizeUrl(req.body?.linkedin_url, 500),
      video_url: sanitizeUrl(req.body?.video_url, 500),
      extra_label: cleanString(req.body?.extra_label, 80),
      extra_url: sanitizeUrl(req.body?.extra_url, 500),
      is_featured: toTinyInt(req.body?.is_featured, 0),
      display_order: toInt(req.body?.display_order, 0)
    };

    if (!payload.title || !payload.description) {
      return res.status(400).json({ success: false, error: 'Title and description are required' });
    }

    const normalizedImageId = payload.image_id > 0
      ? payload.image_id
      : extractUploadImageIdFromUrl(payload.image_url || '') || null;
    const projectSlug = await findUniqueSlug('projects', payload.title);

    await q(
      `INSERT INTO projects
      (category, category_label, title, slug, tech, description, content, image_url, image_id, live_demo_url, github_url, linkedin_url, video_url, extra_label, extra_url, is_featured, display_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.category,
        payload.category_label || null,
        payload.title,
        projectSlug || null,
        payload.tech || null,
        payload.description,
        payload.content || null,
        payload.image_url || null,
        normalizedImageId,
        payload.live_demo_url || null,
        payload.github_url || null,
        payload.linkedin_url || null,
        payload.video_url || null,
        payload.extra_label || null,
        payload.extra_url || null,
        payload.is_featured,
        payload.display_order
      ]
    );

    return res.status(201).json({ success: true, message: 'Project added successfully' });
  } catch (error) {
    console.error('❌ Project Add Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to add project' });
  }
});

app.put('/api/projects/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = toInt(req.params.id, 0);
    if (!id) return res.status(400).json({ success: false, error: 'Invalid project id' });

    const currentRows = await q('SELECT image_id, image_url FROM projects WHERE id = ? LIMIT 1', [id]);
    if (!currentRows.length) return res.status(404).json({ success: false, error: 'Project not found' });

    const oldImageId = toInt(currentRows[0]?.image_id, 0) || extractUploadImageIdFromUrl(currentRows[0]?.image_url);

    const payload = {
      category: normalizeCategory(req.body?.category),
      category_label: cleanString(req.body?.category_label, 60),
      title: cleanString(req.body?.title, 180),
      tech: cleanString(req.body?.tech, 220),
      description: cleanString(req.body?.description, 2000),
      content: cleanMultilineText(req.body?.content, 12000),
      image_url: sanitizeUrl(req.body?.image_url, 500),
      image_id: toInt(req.body?.image_id, 0),
      live_demo_url: sanitizeUrl(req.body?.live_demo_url, 500),
      github_url: sanitizeUrl(req.body?.github_url, 500),
      linkedin_url: sanitizeUrl(req.body?.linkedin_url, 500),
      video_url: sanitizeUrl(req.body?.video_url, 500),
      extra_label: cleanString(req.body?.extra_label, 80),
      extra_url: sanitizeUrl(req.body?.extra_url, 500),
      is_featured: toTinyInt(req.body?.is_featured, 0),
      display_order: toInt(req.body?.display_order, 0)
    };

    if (!payload.title || !payload.description) {
      return res.status(400).json({ success: false, error: 'Title and description are required' });
    }

    const newImageId = payload.image_id > 0
      ? payload.image_id
      : extractUploadImageIdFromUrl(payload.image_url || '') || null;
    const projectSlug = await findUniqueSlug('projects', payload.title, id);

    await q(
      `UPDATE projects
      SET category = ?, category_label = ?, title = ?, slug = ?, tech = ?, description = ?, content = ?, image_url = ?, image_id = ?,
          live_demo_url = ?, github_url = ?, linkedin_url = ?, video_url = ?, extra_label = ?, extra_url = ?,
          is_featured = ?, display_order = ?
      WHERE id = ?`,
      [
        payload.category,
        payload.category_label || null,
        payload.title,
        projectSlug || null,
        payload.tech || null,
        payload.description,
        payload.content || null,
        payload.image_url || null,
        newImageId,
        payload.live_demo_url || null,
        payload.github_url || null,
        payload.linkedin_url || null,
        payload.video_url || null,
        payload.extra_label || null,
        payload.extra_url || null,
        payload.is_featured,
        payload.display_order,
        id
      ]
    );

    if (oldImageId && oldImageId !== (newImageId || 0)) {
      await cleanupImageIfUnused(oldImageId);
    }

    return res.json({ success: true, message: 'Project updated successfully' });
  } catch (error) {
    console.error('❌ Project Update Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update project' });
  }
});

app.delete('/api/projects/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = toInt(req.params.id, 0);
    const rows = await q('SELECT image_id, image_url FROM projects WHERE id = ? LIMIT 1', [id]);
    const imageId = toInt(rows[0]?.image_id, 0) || extractUploadImageIdFromUrl(rows[0]?.image_url);

    await q('DELETE FROM projects WHERE id = ?', [id]);

    if (imageId) {
      await cleanupImageIfUnused(imageId);
    }

    return res.json({ success: true, message: 'Project deleted' });
  } catch (_error) {
    return res.status(500).json({ success: false, error: 'Failed to delete project' });
  }
});

/* ============================================================
   BLOG APIs SECTION (ADMIN MANAGED)
   ============================================================ */
app.get('/api/blogs', async (req, res) => {
  try {
    const publishedOnly = String(req.query.published || '') === '1';
    const latestSort = String(req.query.latest || '') === '1';
    const limit = Math.max(0, toInt(req.query.limit, 0));

    let sql = 'SELECT * FROM blogs WHERE 1=1';
    const params = [];

    if (publishedOnly) {
      sql += ' AND is_published = 1';
    }

    sql += latestSort ? ' ORDER BY id DESC' : ' ORDER BY display_order ASC, id DESC';

    if (limit > 0) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    const rows = await q(sql, params);
    return res.json(rows);
  } catch (error) {
    console.error('❌ Blogs Fetch Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch blogs' });
  }
});

app.get('/api/blogs/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, 0);
    if (!id) return res.status(400).json({ success: false, error: 'Invalid blog id' });

    const rows = await q('SELECT * FROM blogs WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Blog not found' });
    }

    return res.json({ success: true, blog: rows[0] });
  } catch (_error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch blog detail' });
  }
});

app.get('/api/blogs/slug/:slug', async (req, res) => {
  try {
    const slug = slugifyText(req.params.slug, 110);
    if (!slug) return res.status(400).json({ success: false, error: 'Invalid blog slug' });

    const rows = await q('SELECT * FROM blogs WHERE slug = ? LIMIT 1', [slug]);
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Blog not found' });
    }
    return res.json({ success: true, blog: rows[0] });
  } catch (_error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch blog by slug' });
  }
});

app.post('/api/blogs', requireAdminAuth, async (req, res) => {
  try {
    const payload = {
      title: cleanString(req.body?.title, 200),
      summary: cleanString(req.body?.summary, 2000),
      content: cleanMultilineText(req.body?.content, 10000),
      image_url: sanitizeUrl(req.body?.image_url, 500),
      image_id: toInt(req.body?.image_id, 0),
      read_more_url: sanitizeUrl(req.body?.read_more_url, 500),
      github_url: sanitizeUrl(req.body?.github_url, 500),
      linkedin_url: sanitizeUrl(req.body?.linkedin_url, 500),
      video_url: sanitizeUrl(req.body?.video_url, 500),
      extra_label: cleanString(req.body?.extra_label, 80),
      extra_url: sanitizeUrl(req.body?.extra_url, 500),
      is_published: toTinyInt(req.body?.is_published, 0),
      display_order: toInt(req.body?.display_order, 0)
    };

    if (!payload.title || !payload.summary) {
      return res.status(400).json({ success: false, error: 'Title and summary are required' });
    }

    const normalizedImageId = payload.image_id > 0
      ? payload.image_id
      : extractUploadImageIdFromUrl(payload.image_url || '') || null;
    const blogSlug = await findUniqueSlug('blogs', payload.title);

    await q(
      `INSERT INTO blogs
      (title, slug, summary, content, image_url, image_id, read_more_url, github_url, linkedin_url, video_url, extra_label, extra_url, is_published, display_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.title,
        blogSlug || null,
        payload.summary,
        payload.content || null,
        payload.image_url || null,
        normalizedImageId,
        payload.read_more_url || null,
        payload.github_url || null,
        payload.linkedin_url || null,
        payload.video_url || null,
        payload.extra_label || null,
        payload.extra_url || null,
        payload.is_published,
        payload.display_order
      ]
    );

    return res.status(201).json({ success: true, message: 'Blog added successfully' });
  } catch (error) {
    console.error('❌ Blog Add Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to add blog' });
  }
});

app.put('/api/blogs/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = toInt(req.params.id, 0);
    if (!id) return res.status(400).json({ success: false, error: 'Invalid blog id' });

    const currentRows = await q('SELECT image_id, image_url FROM blogs WHERE id = ? LIMIT 1', [id]);
    if (!currentRows.length) return res.status(404).json({ success: false, error: 'Blog not found' });

    const oldImageId = toInt(currentRows[0]?.image_id, 0) || extractUploadImageIdFromUrl(currentRows[0]?.image_url);

    const payload = {
      title: cleanString(req.body?.title, 200),
      summary: cleanString(req.body?.summary, 2000),
      content: cleanMultilineText(req.body?.content, 10000),
      image_url: sanitizeUrl(req.body?.image_url, 500),
      image_id: toInt(req.body?.image_id, 0),
      read_more_url: sanitizeUrl(req.body?.read_more_url, 500),
      github_url: sanitizeUrl(req.body?.github_url, 500),
      linkedin_url: sanitizeUrl(req.body?.linkedin_url, 500),
      video_url: sanitizeUrl(req.body?.video_url, 500),
      extra_label: cleanString(req.body?.extra_label, 80),
      extra_url: sanitizeUrl(req.body?.extra_url, 500),
      is_published: toTinyInt(req.body?.is_published, 0),
      display_order: toInt(req.body?.display_order, 0)
    };

    if (!payload.title || !payload.summary) {
      return res.status(400).json({ success: false, error: 'Title and summary are required' });
    }

    const newImageId = payload.image_id > 0
      ? payload.image_id
      : extractUploadImageIdFromUrl(payload.image_url || '') || null;
    const blogSlug = await findUniqueSlug('blogs', payload.title, id);

    await q(
      `UPDATE blogs
      SET title = ?, slug = ?, summary = ?, content = ?, image_url = ?, image_id = ?, read_more_url = ?, github_url = ?, linkedin_url = ?,
          video_url = ?, extra_label = ?, extra_url = ?, is_published = ?, display_order = ?
      WHERE id = ?`,
      [
        payload.title,
        blogSlug || null,
        payload.summary,
        payload.content || null,
        payload.image_url || null,
        newImageId,
        payload.read_more_url || null,
        payload.github_url || null,
        payload.linkedin_url || null,
        payload.video_url || null,
        payload.extra_label || null,
        payload.extra_url || null,
        payload.is_published,
        payload.display_order,
        id
      ]
    );

    if (oldImageId && oldImageId !== (newImageId || 0)) {
      await cleanupImageIfUnused(oldImageId);
    }

    return res.json({ success: true, message: 'Blog updated successfully' });
  } catch (error) {
    console.error('❌ Blog Update Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update blog' });
  }
});

app.delete('/api/blogs/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = toInt(req.params.id, 0);
    const rows = await q('SELECT image_id, image_url FROM blogs WHERE id = ? LIMIT 1', [id]);
    const imageId = toInt(rows[0]?.image_id, 0) || extractUploadImageIdFromUrl(rows[0]?.image_url);

    await q('DELETE FROM blogs WHERE id = ?', [id]);

    if (imageId) {
      await cleanupImageIfUnused(imageId);
    }

    return res.json({ success: true, message: 'Blog deleted' });
  } catch (_error) {
    return res.status(500).json({ success: false, error: 'Failed to delete blog' });
  }
});

/* ============================================================
   ADMIN LOGIN + STATS SECTION
   ============================================================ */
app.post('/api/admin/login', (req, res) => {
  const password = normalizeAdminPassword(req.body?.password);

  if (!password) {
    return res.status(400).json({ success: false, error: 'Password required' });
  }

  if (ADMIN_PASS_ALIASES.has(password)) {
    const token = createAdminToken();
    const payload = verifyAdminToken(token);
    return res.json({
      success: true,
      token,
      expiresAt: Number(payload?.exp || 0)
    });
  }

  return res.status(401).json({ success: false });
});

app.get('/api/admin/session', requireAdminAuth, (req, res) => {
  return res.json({
    success: true,
    expiresAt: Number(req.adminAuth?.exp || 0)
  });
});

app.get('/api/stats', requireAdminAuth, async (_req, res) => {
  try {
    const [contacts, reviews, projects, blogs] = await Promise.all([
      q('SELECT COUNT(*) AS total FROM contacts'),
      q('SELECT COUNT(*) AS total FROM reviews'),
      q('SELECT COUNT(*) AS total FROM projects'),
      q('SELECT COUNT(*) AS total FROM blogs')
    ]);

    return res.json({
      contacts: Number(contacts[0]?.total || 0),
      reviews: Number(reviews[0]?.total || 0),
      projects: Number(projects[0]?.total || 0),
      blogs: Number(blogs[0]?.total || 0)
    });
  } catch (_error) {
    return res.status(500).json({ success: false, error: 'Failed to load stats' });
  }
});

/* ============================================================
   VISITOR TRACKING + ANALYTICS SECTION
   ============================================================ */
app.post('/api/visit', async (req, res) => {
  try {
    const ip = cleanString(req.ip, 120);
    const page = cleanString(req.body?.page, 255) || '/';
    await q('INSERT INTO visits (ip, page) VALUES (?, ?)', [ip, page]);
    queueVisitEmailAlert({
      Activity: 'New visitor opened the website',
      Page: page,
      IP: ip,
      Browser: cleanString(req.headers['user-agent'], 255),
      Time: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('Visit Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to track visit' });
  }
});

app.post('/api/visit-time', async (req, res) => {
  try {
    const page = cleanString(req.body?.page, 255) || '/';
    const time = Math.max(0, toInt(req.body?.time, 0));
    await q('INSERT INTO visits (page, time_spent) VALUES (?, ?)', [page, time]);
    return res.json({ success: true });
  } catch (error) {
    console.error('Time Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to track time' });
  }
});

app.get('/api/analytics', requireAdminAuth, async (_req, res) => {
  try {
    const [totalRows, timeRows, pageRows] = await Promise.all([
      q('SELECT COUNT(*) AS total FROM visits'),
      q('SELECT SUM(time_spent) AS totalTime FROM visits'),
      q('SELECT page, COUNT(*) AS views FROM visits GROUP BY page ORDER BY views DESC')
    ]);

    return res.json({
      totalVisits: Number(totalRows[0]?.total || 0),
      totalTime: Number(timeRows[0]?.totalTime || 0),
      pages: pageRows
    });
  } catch (_error) {
    return res.status(500).json({ success: false, error: 'Failed to load analytics' });
  }
});

/* ============================================================
   CLEAN URL FRONTEND ROUTES SECTION
   ============================================================ */
app.get('/projects', (_req, res) => {
  return res.sendFile(path.join(FRONTEND_DIR, 'moreproject', 'more-projects.html'));
});

app.get('/blogs', (_req, res) => {
  return res.sendFile(path.join(FRONTEND_DIR, 'morebloge', 'more-blog.html'));
});

app.get('/resume', (_req, res) => {
  return res.sendFile(path.join(FRONTEND_DIR, 'resume', 'resume.html'));
});

/* ============================================================
   BOOTSTRAP SECTION
   ============================================================ */
async function startServer() {
  try {
    await q('SELECT 1');
    console.log('✅ MySQL Connected');

    await ensureSchema();
    console.log('✅ DB schema ready');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Server startup failed:', error.message || error);
    process.exit(1);
  }
}

startServer();


// node Backend/server.js. / npm --prefix Backend // start  Backend server start 


// cd "/Users/chandankumar/ Scorce Code/Portfolio/Backend"
// npm start

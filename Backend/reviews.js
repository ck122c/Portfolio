const express = require('express');
const fs = require('fs');
const path = require('path');

const reviewRouter = express.Router();

const DATA_DIR = path.join(__dirname, 'data');
const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json');
const MAX_REVIEW_TEXT_LENGTH = 500;
const MAX_ROLE_LENGTH = 80;
const MAX_NAME_LENGTH = 60;

const defaultReviews = [
  {
    id: 'seed-1',
    name: 'Rahul Sharma',
    role: 'Project Manager, XYZ Corp',
    rating: 5,
    text: "Chandan's data analysis skills are exceptional. He transformed raw data into valuable insights that helped us make strategic decisions.",
    createdAt: '2026-04-20T12:00:00.000Z'
  },
  {
    id: 'seed-2',
    name: 'Ananya Verma',
    role: 'Data Scientist, ABC Ltd',
    rating: 5,
    text: 'An AI enthusiast with an eye for detail. Chandan delivered an innovative ML model that boosted our product efficiency.',
    createdAt: '2026-04-21T12:00:00.000Z'
  },
  {
    id: 'seed-3',
    name: 'Amit Patel',
    role: 'CTO, InnovateTech',
    rating: 4,
    text: 'Creative, reliable, and highly skilled in AI/ML. Working with Chandan was a fantastic experience.',
    createdAt: '2026-04-22T12:00:00.000Z'
  }
];

function ensureReviewsFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(REVIEWS_FILE)) {
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify(defaultReviews, null, 2), 'utf8');
  }
}

function readReviews() {
  ensureReviewsFile();

  try {
    const raw = fs.readFileSync(REVIEWS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to read reviews file:', error);
    return [];
  }
}

function writeReviews(reviews) {
  fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviews, null, 2), 'utf8');
}

function sanitizeString(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function validateReviewPayload(payload) {
  const name = sanitizeString(payload.name);
  const role = sanitizeString(payload.role);
  const text = sanitizeString(payload.text);
  const ratingNum = Number(payload.rating);
  const rating = Number.isFinite(ratingNum) ? Math.round(ratingNum) : NaN;

  if (!name) return { ok: false, message: 'Name is required.' };
  if (name.length > MAX_NAME_LENGTH) return { ok: false, message: `Name must be <= ${MAX_NAME_LENGTH} characters.` };
  if (!text) return { ok: false, message: 'Review text is required.' };
  if (text.length > MAX_REVIEW_TEXT_LENGTH) return { ok: false, message: `Review text must be <= ${MAX_REVIEW_TEXT_LENGTH} characters.` };
  if (role.length > MAX_ROLE_LENGTH) return { ok: false, message: `Role must be <= ${MAX_ROLE_LENGTH} characters.` };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, message: 'Rating must be between 1 and 5.' };

  return {
    ok: true,
    data: { name, role, text, rating }
  };
}

function listReviews() {
  return readReviews()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 50);
}

function getReviewCount() {
  return readReviews().length;
}

reviewRouter.get('/', (_req, res) => {
  return res.json({
    success: true,
    reviews: listReviews()
  });
});

reviewRouter.post('/', (req, res) => {
  const validation = validateReviewPayload(req.body || {});

  if (!validation.ok) {
    return res.status(400).json({
      success: false,
      message: validation.message
    });
  }

  const { name, role, text, rating } = validation.data;
  const newReview = {
    id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    role,
    text,
    rating,
    createdAt: new Date().toISOString()
  };

  const reviews = readReviews();
  reviews.unshift(newReview);
  writeReviews(reviews.slice(0, 100));

  return res.status(201).json({
    success: true,
    message: 'Review added successfully.',
    review: newReview
  });
});

module.exports = {
  reviewRouter,
  ensureReviewsFile,
  getReviewCount
};

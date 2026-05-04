/* ============================================================
   ADMIN DASHBOARD CLIENT SECTION
   ============================================================ */
const API_ROOT = window.location.protocol === "file:" ? "http://localhost:5001" : window.location.origin;
const API = `${API_ROOT}/api`;
const state = {
  contacts: [],
  reviews: [],
  projects: [],
  blogs: [],
  aboutContent: null,
  aboutExperiences: [],
  contactSettings: null,
  resumeContent: null,
  resumeUpload: null
};

let editingProjectId = null;
let editingBlogId = null;
let editingExperienceId = null;
let activeAdminModule = "";

const ADMIN_MODULES = ["contacts", "reviews", "projects", "blogs", "about", "resume"];
const DEFAULT_CONTACT_SETTINGS = {
  location_text: "Indore, India",
  map_embed_url: "https://www.google.com/maps?q=Indore%2C%20India&output=embed"
};

const ADMIN_TOKEN_KEY = "admin_token";
const ADMIN_TOKEN_EXP_KEY = "admin_token_exp";

function getAdminToken() {
  return String(localStorage.getItem(ADMIN_TOKEN_KEY) || "").trim();
}

function isTokenExpired() {
  const raw = Number(localStorage.getItem(ADMIN_TOKEN_EXP_KEY) || 0);
  if (!raw) return false;
  return Date.now() >= raw;
}

function clearAdminSession() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_TOKEN_EXP_KEY);
  localStorage.removeItem("admin");
}

if (!getAdminToken() || isTokenExpired()) {
  clearAdminSession();
  window.location.href = "login.html";
}

setInterval(() => {
  const now = new Date();
  document.getElementById("time").innerText = now.toLocaleTimeString("en-GB");
}, 1000);

function setActiveAdminModule(moduleKey, options = {}) {
  const { scroll = true } = options;
  const safeModule = String(moduleKey || "").toLowerCase();
  if (!ADMIN_MODULES.includes(safeModule)) return;

  const moduleSections = Array.from(document.querySelectorAll(".admin-section[data-admin-module]"));
  const moduleButtons = Array.from(document.querySelectorAll(".access-btn[data-admin-target]"));
  const statusEl = document.getElementById("accessStatus");

  moduleSections.forEach((section) => {
    const match = section.dataset.adminModule === safeModule;
    section.classList.toggle("active", match);
  });

  moduleButtons.forEach((btn) => {
    const match = btn.dataset.adminTarget === safeModule;
    btn.classList.toggle("active", match);
  });

  activeAdminModule = safeModule;

  if (statusEl) {
    const pretty = safeModule.charAt(0).toUpperCase() + safeModule.slice(1);
    statusEl.innerText = `${pretty} module access is open.`;
  }

  if (scroll) {
    const activeSection = document.querySelector(`.admin-section[data-admin-module="${safeModule}"]`);
    if (activeSection) {
      activeSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
}

function initAdminAccessSelector() {
  const moduleButtons = Array.from(document.querySelectorAll(".access-btn[data-admin-target]"));
  if (!moduleButtons.length) return;

  const statusEl = document.getElementById("accessStatus");
  if (statusEl) {
    statusEl.innerText = "Select one module to open its access panel.";
  }

  moduleButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      setActiveAdminModule(btn.dataset.adminTarget, { scroll: true });
    });
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shortText(value, limit = 80) {
  const text = String(value || "").trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function cleanDashboardText(value, max = 300) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function buildMapEmbedFromLocation(locationText = "") {
  const query = cleanDashboardText(locationText, 220) || DEFAULT_CONTACT_SETTINGS.location_text;
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

function extractIframeSrc(value = "") {
  const text = String(value || "");
  const match = text.match(/src\s*=\s*["']([^"']+)["']/i);
  return match ? String(match[1] || "").trim() : "";
}

function safeMapUrl(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  const lower = text.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:")) return "";
  if (!lower.startsWith("http://") && !lower.startsWith("https://")) return "";
  return text;
}

async function toJson(response) {
  let data = null;
  try {
    data = await response.json();
  } catch (_err) {
    data = null;
  }
  if (!response.ok) {
    const message = data?.error || data?.message || `Request failed (${response.status})`;
    throw new Error(message);
  }
  return data;
}

async function adminApiFetch(url, options = {}) {
  const token = getAdminToken();
  if (!token || isTokenExpired()) {
    clearAdminSession();
    window.location.href = "login.html";
    throw new Error("Admin session expired. Please login again.");
  }

  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  return window.fetch(url, {
    ...options,
    headers
  });
}

function linkCell(item) {
  const links = [];
  if (item.live_demo_url) links.push(`<a href="${escapeHtml(item.live_demo_url)}" target="_blank" rel="noopener">Live</a>`);
  if (item.read_more_url) links.push(`<a href="${escapeHtml(item.read_more_url)}" target="_blank" rel="noopener">Read</a>`);
  if (item.github_url) links.push(`<a href="${escapeHtml(item.github_url)}" target="_blank" rel="noopener">GitHub</a>`);
  if (item.linkedin_url) links.push(`<a href="${escapeHtml(item.linkedin_url)}" target="_blank" rel="noopener">LinkedIn</a>`);
  if (item.video_url) links.push(`<a href="${escapeHtml(item.video_url)}" target="_blank" rel="noopener">Video</a>`);
  if (item.extra_url && item.extra_label) links.push(`<a href="${escapeHtml(item.extra_url)}" target="_blank" rel="noopener">${escapeHtml(item.extra_label)}</a>`);
  return `<span class="links-wrap">${links.join(" ") || "-"}</span>`;
}

/* ============================================================
   PROJECT DETAIL URL SECTION (ADMIN -> VIEW PROJECT)
   ============================================================ */
function buildAdminProjectDetailUrl(project = {}) {
  const slug = String(project.slug || "").trim();
  if (slug) {
    return `../moreproject/project-detail.html?slug=${encodeURIComponent(slug)}`;
  }
  const id = Number(project.id || 0);
  if (!id) return "";
  return `../moreproject/project-detail.html?id=${encodeURIComponent(String(id))}`;
}

function updateImageMeta(metaId, imageId, imageUrl) {
  const metaEl = document.getElementById(metaId);
  if (!metaEl) return;
  if (imageId && imageUrl) {
    metaEl.innerText = `SQL Image linked (ID: ${imageId})`;
    return;
  }
  if (imageUrl) {
    metaEl.innerText = "Manual image URL/path in use";
    return;
  }
  metaEl.innerText = "No image selected";
}

function setProjectImageSelection(imageId, imageUrl) {
  document.getElementById("project-image-id").value = imageId ? String(imageId) : "";
  document.getElementById("project-image").value = imageUrl || "";
  updateImageMeta("projectImageMeta", imageId, imageUrl);
}

function setBlogImageSelection(imageId, imageUrl) {
  document.getElementById("blog-image-id").value = imageId ? String(imageId) : "";
  document.getElementById("blog-image").value = imageUrl || "";
  updateImageMeta("blogImageMeta", imageId, imageUrl);
}

function clearProjectImageSelection() {
  setProjectImageSelection("", "");
  document.getElementById("project-image-file").value = "";
}

function clearBlogImageSelection() {
  setBlogImageSelection("", "");
  document.getElementById("blog-image-file").value = "";
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read selected file"));
    reader.readAsDataURL(file);
  });
}

async function uploadImageToSql(file, ownerType) {
  const dataUrl = await fileToDataUrl(file);
  const response = await adminApiFetch(`${API}/uploads/image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dataUrl,
      fileName: file.name || "",
      ownerType
    })
  });
  const data = await toJson(response);
  return {
    imageId: Number(data.image_id || 0),
    imageUrl: data.image_url || ""
  };
}

/* ============================================================
   TABLE RENDER SECTION
   ============================================================ */
function renderContacts() {
  let html = "<tr><th>Name</th><th>Email</th><th>Message</th><th>Action</th></tr>";
  if (!state.contacts.length) {
    html += "<tr><td colspan='4'>No contacts yet.</td></tr>";
  } else {
    state.contacts.forEach((d) => {
      html += `<tr>
        <td>${escapeHtml(d.name)}</td>
        <td style="color:rgba(0, 255, 204, 0.7)">${escapeHtml(d.email)}</td>
        <td>${escapeHtml(shortText(d.message, 140))}</td>
        <td>
          <button class="action-btn btn-delete" onclick="deleteContact(${Number(d.id)})">Delete</button>
        </td>
      </tr>`;
    });
  }
  document.getElementById("contactTable").innerHTML = html;
}

function renderReviews() {
  let html = "<tr><th>Name</th><th>Role</th><th>Review</th><th>Rating</th><th>Actions</th></tr>";
  if (!state.reviews.length) {
    html += "<tr><td colspan='5'>No reviews yet.</td></tr>";
  } else {
    state.reviews.forEach((d) => {
      const nameEncoded = encodeURIComponent(d.name || "");
      const roleEncoded = encodeURIComponent(d.role || "");
      const textEncoded = encodeURIComponent(d.text || "");
      html += `<tr>
        <td>${escapeHtml(d.name)}</td>
        <td>${escapeHtml(d.role || "-")}</td>
        <td>${escapeHtml(shortText(d.text, 120))}</td>
        <td style="color:var(--warning)">${Number(d.rating) || 0} / 5</td>
        <td>
          <button class="action-btn btn-edit" onclick="editReview(${Number(d.id)}, '${nameEncoded}', '${roleEncoded}', ${Number(d.rating) || 5}, '${textEncoded}')">Edit</button>
          <button class="action-btn btn-delete" onclick="deleteReview(${Number(d.id)})">Delete</button>
        </td>
      </tr>`;
    });
  }
  document.getElementById("reviewTable").innerHTML = html;
}

function renderProjects() {
  let html = "<tr><th>ID</th><th>Category</th><th>Title</th><th>Tech</th><th>Featured</th><th>Links</th><th>Actions</th></tr>";
  if (!state.projects.length) {
    html += "<tr><td colspan='7'>No projects yet.</td></tr>";
  } else {
    state.projects.forEach((d) => {
      const detailUrl = buildAdminProjectDetailUrl(d);
      html += `<tr>
        <td>${Number(d.id)}</td>
        <td>${escapeHtml(d.category)} (${escapeHtml(d.category_label || "-")})</td>
        <td>${escapeHtml(d.title)}</td>
        <td>${escapeHtml(shortText(d.tech, 60))}</td>
        <td>${Number(d.is_featured) === 1 ? "Yes" : "No"}</td>
        <td>${linkCell(d)}</td>
        <td>
          ${detailUrl ? `<a class="action-btn btn-view" href="${detailUrl}" target="_blank" rel="noopener">View</a>` : ""}
          <button class="action-btn btn-edit" onclick="editProject(${Number(d.id)})">Edit</button>
          <button class="action-btn btn-delete" onclick="deleteProject(${Number(d.id)})">Delete</button>
        </td>
      </tr>`;
    });
  }
  document.getElementById("projectTable").innerHTML = html;
}

function renderBlogs() {
  let html = "<tr><th>ID</th><th>Title</th><th>Summary</th><th>Published</th><th>Links</th><th>Actions</th></tr>";
  if (!state.blogs.length) {
    html += "<tr><td colspan='6'>No blogs yet.</td></tr>";
  } else {
    state.blogs.forEach((d) => {
      html += `<tr>
        <td>${Number(d.id)}</td>
        <td>${escapeHtml(d.title)}</td>
        <td>${escapeHtml(shortText(d.summary, 120))}</td>
        <td>${Number(d.is_published) === 1 ? "Yes" : "No"}</td>
        <td>${linkCell(d)}</td>
        <td>
          <button class="action-btn btn-edit" onclick="editBlog(${Number(d.id)})">Edit</button>
          <button class="action-btn btn-delete" onclick="deleteBlog(${Number(d.id)})">Delete</button>
        </td>
      </tr>`;
    });
  }
  document.getElementById("blogTable").innerHTML = html;
}

function renderAboutExperiences() {
  const tableEl = document.getElementById("aboutExperienceTable");
  if (!tableEl) return;

  let html = "<tr><th>ID</th><th>Year</th><th>Company</th><th>Role</th><th>Position</th><th>Order</th><th>Actions</th></tr>";
  if (!state.aboutExperiences.length) {
    html += "<tr><td colspan='7'>No experience items yet.</td></tr>";
  } else {
    state.aboutExperiences.forEach((item) => {
      html += `<tr>
        <td>${Number(item.id)}</td>
        <td>${escapeHtml(item.year_label || "-")}</td>
        <td>${escapeHtml(item.company_name || "-")}</td>
        <td>${escapeHtml(item.job_role || "-")}</td>
        <td>${escapeHtml(item.position_title || "-")}</td>
        <td>${Number(item.display_order) || 0}</td>
        <td>
          <button class="action-btn btn-edit" onclick="editExperience(${Number(item.id)})">Edit</button>
          <button class="action-btn btn-delete" onclick="deleteExperience(${Number(item.id)})">Delete</button>
        </td>
      </tr>`;
    });
  }
  tableEl.innerHTML = html;
}

function renderAllTables() {
  renderContacts();
  renderReviews();
  renderProjects();
  renderBlogs();
  renderAboutExperiences();
}

function normalizeAboutResponse(payload = {}) {
  const about = payload.about || {};
  const experiences = Array.isArray(payload.experiences) ? payload.experiences : [];
  return {
    about: {
      tagline: String(about.tagline || ""),
      headline: String(about.headline || ""),
      paragraph_1: String(about.paragraph_1 || ""),
      paragraph_2: String(about.paragraph_2 || ""),
      paragraph_3: String(about.paragraph_3 || ""),
      experience_summary: String(about.experience_summary || "")
    },
    experiences
  };
}

function normalizeContactSettingsResponse(payload = {}) {
  const settings = payload?.settings || payload || {};
  const locationText = cleanDashboardText(settings.location_text || settings.locationText, 160) || DEFAULT_CONTACT_SETTINGS.location_text;

  let mapRaw = String(settings.map_embed_url || settings.mapEmbedUrl || "").trim();
  if (/<iframe/i.test(mapRaw)) {
    mapRaw = extractIframeSrc(mapRaw);
  }
  const mapEmbedUrl = safeMapUrl(mapRaw) || buildMapEmbedFromLocation(locationText);

  return {
    location_text: locationText,
    map_embed_url: mapEmbedUrl
  };
}

function normalizeResumeResponse(payload = {}) {
  const resume = payload?.resume || payload || {};
  return {
    full_name: String(resume.full_name || ""),
    headline: String(resume.headline || ""),
    email: String(resume.email || ""),
    phone: String(resume.phone || ""),
    location: String(resume.location || ""),
    website: String(resume.website || ""),
    linkedin_url: String(resume.linkedin_url || ""),
    github_url: String(resume.github_url || ""),
    summary: String(resume.summary || ""),
    skills: String(resume.skills || ""),
    experience: String(resume.experience || ""),
    education: String(resume.education || ""),
    projects: String(resume.projects || ""),
    certifications: String(resume.certifications || "")
  };
}

function normalizeResumeUploadResponse(payload = {}) {
  const upload = payload?.upload || payload || null;
  if (!upload) return null;

  let feedback = upload.ats_feedback || [];
  if (typeof feedback === "string") {
    try {
      feedback = JSON.parse(feedback);
    } catch (_error) {
      feedback = [];
    }
  }

  return {
    id: Number(upload.id || 0),
    file_name: String(upload.file_name || ""),
    mime_type: String(upload.mime_type || ""),
    byte_size: Number(upload.byte_size || 0),
    ats_score: Number(upload.ats_score || 0),
    ats_feedback: Array.isArray(feedback) ? feedback : [],
    download_url: String(upload.download_url || "/api/resume-upload/file")
  };
}

function formatDuration(msValue) {
  const totalMs = Math.max(0, Number(msValue || 0));
  const totalSec = Math.floor(totalMs / 1000);
  if (totalSec < 60) return `${totalSec} sec`;
  const totalMin = Math.floor(totalSec / 60);
  if (totalMin < 60) return `${totalMin} min`;
  const totalHr = Math.floor(totalMin / 60);
  const remMin = totalMin % 60;
  return `${totalHr}h ${remMin}m`;
}

function populateAboutForm() {
  const about = state.aboutContent || {};

  const tagEl = document.getElementById("about-tagline-input");
  const headlineEl = document.getElementById("about-headline-input");
  const p1El = document.getElementById("about-p1-input");
  const p2El = document.getElementById("about-p2-input");
  const p3El = document.getElementById("about-p3-input");
  const summaryEl = document.getElementById("about-exp-summary-input");

  if (!tagEl || !headlineEl || !p1El || !summaryEl) return;

  tagEl.value = about.tagline || "";
  headlineEl.value = about.headline || "";
  p1El.value = about.paragraph_1 || "";
  p2El.value = about.paragraph_2 || "";
  p3El.value = about.paragraph_3 || "";
  summaryEl.value = about.experience_summary || "";
}

function populateContactSettingsForm() {
  const inputLocation = document.getElementById("contact-location-input");
  const inputMap = document.getElementById("contact-map-input");
  const preview = document.getElementById("contactMapPreview");
  if (!inputLocation || !inputMap || !preview) return;

  const settings = state.contactSettings || { ...DEFAULT_CONTACT_SETTINGS };
  inputLocation.value = settings.location_text || DEFAULT_CONTACT_SETTINGS.location_text;
  inputMap.value = settings.map_embed_url || buildMapEmbedFromLocation(inputLocation.value);
  preview.src = inputMap.value;
}

function formatFileSize(bytes = 0) {
  const size = Number(bytes || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function populateResumeUploadForm() {
  const metaEl = document.getElementById("resumeUploadMeta");
  if (!metaEl) return;

  const upload = state.resumeUpload;
  if (!upload || !upload.id) {
    metaEl.innerText = "No resume uploaded";
    return;
  }

  metaEl.innerText = `Uploaded: ${upload.file_name} | ${formatFileSize(upload.byte_size)} | ATS Score: ${upload.ats_score}/100`;
}

/* ============================================================
   LOAD DATA SECTION
   ============================================================ */
async function loadDashboardData() {
  try {
    const [statsRes, analyticsRes, contactsRes, reviewsRes, projectsRes, blogsRes, aboutRes, contactSettingsRes, resumeRes] = await Promise.all([
      adminApiFetch(`${API}/stats`),
      adminApiFetch(`${API}/analytics`),
      adminApiFetch(`${API}/contact`),
      adminApiFetch(`${API}/reviews`),
      adminApiFetch(`${API}/projects`),
      adminApiFetch(`${API}/blogs`),
      adminApiFetch(`${API}/about`),
      adminApiFetch(`${API}/contact-settings?t=${Date.now()}`, { cache: "no-store" }),
      adminApiFetch(`${API}/resume?t=${Date.now()}`, { cache: "no-store" })
    ]);

    const [stats, analytics, contacts, reviews, projects, blogs, aboutData, contactSettingsData, resumeData] = await Promise.all([
      toJson(statsRes),
      toJson(analyticsRes),
      toJson(contactsRes),
      toJson(reviewsRes),
      toJson(projectsRes),
      toJson(blogsRes),
      toJson(aboutRes),
      toJson(contactSettingsRes),
      toJson(resumeRes)
    ]);

    document.getElementById("contactCount").innerText = Number(stats.contacts || 0);
    document.getElementById("reviewCount").innerText = Number(stats.reviews || 0);
    document.getElementById("projectCount").innerText = Number(stats.projects || 0);
    document.getElementById("blogCount").innerText = Number(stats.blogs || 0);
    document.getElementById("visitCount").innerText = Number(analytics.totalVisits || 0);
    document.getElementById("timeSpent").innerText = formatDuration(analytics.totalTime || 0);

    state.contacts = Array.isArray(contacts) ? contacts : [];
    state.reviews = Array.isArray(reviews) ? reviews : [];
    state.projects = Array.isArray(projects) ? projects : [];
    state.blogs = Array.isArray(blogs) ? blogs : [];
    const normalizedAbout = normalizeAboutResponse(aboutData || {});
    state.aboutContent = normalizedAbout.about;
    state.aboutExperiences = normalizedAbout.experiences;
    state.contactSettings = normalizeContactSettingsResponse(contactSettingsData || {});
    state.resumeContent = normalizeResumeResponse(resumeData || {});
    state.resumeUpload = normalizeResumeUploadResponse(resumeData?.upload || null);

    renderAllTables();
    populateAboutForm();
    populateContactSettingsForm();
    populateResumeUploadForm();
  } catch (error) {
    console.error("Dashboard Load Error:", error);
    alert(`❌ ${error.message}`);
  }
}

/* ============================================================
   CONTACT + REVIEW ACTION SECTION
   ============================================================ */
async function deleteContact(id) {
  if (!confirm("Delete this message permanently?")) return;
  await toJson(await adminApiFetch(`${API}/contact/${id}`, { method: "DELETE" }));
  loadDashboardData();
}

async function deleteReview(id) {
  if (!confirm("Are you sure you want to delete this review?")) return;
  await toJson(await adminApiFetch(`${API}/reviews/${id}`, { method: "DELETE" }));
  loadDashboardData();
}

async function editReview(id, nameEncoded, roleEncoded, rating, textEncoded) {
  const name = decodeURIComponent(nameEncoded || "");
  const role = decodeURIComponent(roleEncoded || "");
  const text = decodeURIComponent(textEncoded || "");

  const newName = prompt("Update Name:", name);
  const newRole = prompt("Update Role:", role || "");
  const newText = prompt("Update Feedback:", text);
  const newRating = prompt("Update Rating (1-5):", rating);

  if (!newName || !newText) return;

  await toJson(await adminApiFetch(`${API}/reviews/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: newName,
      role: newRole,
      rating: Number(newRating) || 5,
      text: newText
    })
  }));

  loadDashboardData();
}

const contactMapInputEl = document.getElementById("contact-map-input");
if (contactMapInputEl) {
  contactMapInputEl.addEventListener("input", () => {
    const preview = document.getElementById("contactMapPreview");
    if (!preview) return;
    const raw = String(contactMapInputEl.value || "").trim();
    const extracted = /<iframe/i.test(raw) ? extractIframeSrc(raw) : raw;
    const safeUrl = safeMapUrl(extracted);
    if (safeUrl) preview.src = safeUrl;
  });
}

const contactSettingsForm = document.getElementById("contactSettingsForm");
if (contactSettingsForm) {
  contactSettingsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById("contactSettingsStatus");
    const locationEl = document.getElementById("contact-location-input");
    const mapEl = document.getElementById("contact-map-input");
    if (!statusEl || !locationEl || !mapEl) return;

    const locationText = cleanDashboardText(locationEl.value, 160);
    const mapRawInput = String(mapEl.value || "").trim();
    const extractedMap = /<iframe/i.test(mapRawInput) ? extractIframeSrc(mapRawInput) : mapRawInput;
    const mapEmbedUrl = safeMapUrl(extractedMap) || buildMapEmbedFromLocation(locationText);

    if (!locationText) {
      statusEl.innerText = "❌ Location text is required.";
      return;
    }

    try {
      statusEl.innerText = "Saving location settings...";
      await toJson(await adminApiFetch(`${API}/contact-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location_text: locationText,
          map_embed_url: mapEmbedUrl
        })
      }));
      statusEl.innerText = "✅ Contact location updated.";
      loadDashboardData();
    } catch (error) {
      statusEl.innerText = `❌ ${error.message}`;
    }
  });
}

/* ============================================================
   PROJECT FORM + ACTION SECTION
   ============================================================ */
function projectPayloadFromForm() {
  const imageUrl = document.getElementById("project-image").value.trim();
  const imageId = Number(document.getElementById("project-image-id").value || 0);
  const isUploadedSqlImage = imageId > 0 && imageUrl.includes(`/api/uploads/image/${imageId}`);

  return {
    category: document.getElementById("project-category").value,
    category_label: document.getElementById("project-category-label").value.trim(),
    title: document.getElementById("project-title").value.trim(),
    tech: document.getElementById("project-tech").value.trim(),
    description: document.getElementById("project-description").value.trim(),
    content: document.getElementById("project-content").value.trim(),
    image_url: imageUrl,
    image_id: isUploadedSqlImage ? imageId : null,
    live_demo_url: document.getElementById("project-live").value.trim(),
    github_url: document.getElementById("project-github").value.trim(),
    linkedin_url: document.getElementById("project-linkedin").value.trim(),
    video_url: document.getElementById("project-video").value.trim(),
    extra_label: document.getElementById("project-extra-label").value.trim(),
    extra_url: document.getElementById("project-extra-url").value.trim(),
    is_featured: document.getElementById("project-featured").checked,
    display_order: Number(document.getElementById("project-order").value || 0)
  };
}

function resetProjectForm() {
  editingProjectId = null;
  document.getElementById("projectForm").reset();
  document.getElementById("project-featured").checked = true;
  document.getElementById("project-order").value = 0;
  clearProjectImageSelection();
  document.getElementById("projectSubmitBtn").innerText = "Add Project";
  document.getElementById("projectStatus").innerText = "";
}

async function editProject(id) {
  const project = state.projects.find((item) => Number(item.id) === Number(id));
  if (!project) return;

  editingProjectId = Number(id);
  document.getElementById("project-category").value = project.category || "web";
  document.getElementById("project-category-label").value = project.category_label || "";
  document.getElementById("project-title").value = project.title || "";
  document.getElementById("project-tech").value = project.tech || "";
  document.getElementById("project-description").value = project.description || "";
  document.getElementById("project-content").value = project.content || "";
  setProjectImageSelection(Number(project.image_id) || "", project.image_url || "");
  document.getElementById("project-image-file").value = "";
  document.getElementById("project-live").value = project.live_demo_url || "";
  document.getElementById("project-github").value = project.github_url || "";
  document.getElementById("project-linkedin").value = project.linkedin_url || "";
  document.getElementById("project-video").value = project.video_url || "";
  document.getElementById("project-extra-label").value = project.extra_label || "";
  document.getElementById("project-extra-url").value = project.extra_url || "";
  document.getElementById("project-featured").checked = Number(project.is_featured) === 1;
  document.getElementById("project-order").value = Number(project.display_order) || 0;

  document.getElementById("projectSubmitBtn").innerText = "Update Project";
  document.getElementById("projectStatus").innerText = `Editing project ID: ${id}`;
  window.scrollTo({ top: document.getElementById("projectForm").offsetTop - 20, behavior: "smooth" });
}

async function deleteProject(id) {
  if (!confirm("Delete this project?")) return;
  await toJson(await adminApiFetch(`${API}/projects/${id}`, { method: "DELETE" }));
  if (editingProjectId === Number(id)) resetProjectForm();
  loadDashboardData();
}

document.getElementById("projectForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = projectPayloadFromForm();
  const statusEl = document.getElementById("projectStatus");

  if (!payload.title || !payload.description) {
    statusEl.innerText = "❌ Title and description required.";
    return;
  }

  try {
    const projectImageFile = document.getElementById("project-image-file").files?.[0];
    if (projectImageFile) {
      statusEl.innerText = "Uploading project image...";
      const upload = await uploadImageToSql(projectImageFile, "project");
      setProjectImageSelection(upload.imageId, upload.imageUrl);
      document.getElementById("project-image-file").value = "";
    }

    const freshPayload = projectPayloadFromForm();
    statusEl.innerText = editingProjectId ? "Updating project..." : "Adding project...";

    const endpoint = editingProjectId ? `${API}/projects/${editingProjectId}` : `${API}/projects`;
    const method = editingProjectId ? "PUT" : "POST";

    await toJson(await adminApiFetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(freshPayload)
    }));

    statusEl.innerText = editingProjectId ? "✅ Project updated." : "✅ Project added.";
    resetProjectForm();
    loadDashboardData();
  } catch (error) {
    statusEl.innerText = `❌ ${error.message}`;
  }
});

/* ============================================================
   BLOG FORM + ACTION SECTION
   ============================================================ */
function blogPayloadFromForm() {
  const imageUrl = document.getElementById("blog-image").value.trim();
  const imageId = Number(document.getElementById("blog-image-id").value || 0);
  const isUploadedSqlImage = imageId > 0 && imageUrl.includes(`/api/uploads/image/${imageId}`);

  return {
    title: document.getElementById("blog-title").value.trim(),
    summary: document.getElementById("blog-summary").value.trim(),
    content: document.getElementById("blog-content").value.trim(),
    image_url: imageUrl,
    image_id: isUploadedSqlImage ? imageId : null,
    read_more_url: document.getElementById("blog-read-more").value.trim(),
    github_url: document.getElementById("blog-github").value.trim(),
    linkedin_url: document.getElementById("blog-linkedin").value.trim(),
    video_url: document.getElementById("blog-video").value.trim(),
    extra_label: document.getElementById("blog-extra-label").value.trim(),
    extra_url: document.getElementById("blog-extra-url").value.trim(),
    is_published: document.getElementById("blog-published").checked,
    display_order: Number(document.getElementById("blog-order").value || 0)
  };
}

function resetBlogForm() {
  editingBlogId = null;
  document.getElementById("blogForm").reset();
  document.getElementById("blog-published").checked = true;
  document.getElementById("blog-order").value = 0;
  clearBlogImageSelection();
  document.getElementById("blogSubmitBtn").innerText = "Add Blog";
  document.getElementById("blogStatus").innerText = "";
}

async function editBlog(id) {
  const blog = state.blogs.find((item) => Number(item.id) === Number(id));
  if (!blog) return;

  editingBlogId = Number(id);
  document.getElementById("blog-title").value = blog.title || "";
  document.getElementById("blog-summary").value = blog.summary || "";
  document.getElementById("blog-content").value = blog.content || "";
  setBlogImageSelection(Number(blog.image_id) || "", blog.image_url || "");
  document.getElementById("blog-image-file").value = "";
  document.getElementById("blog-read-more").value = blog.read_more_url || "";
  document.getElementById("blog-github").value = blog.github_url || "";
  document.getElementById("blog-linkedin").value = blog.linkedin_url || "";
  document.getElementById("blog-video").value = blog.video_url || "";
  document.getElementById("blog-extra-label").value = blog.extra_label || "";
  document.getElementById("blog-extra-url").value = blog.extra_url || "";
  document.getElementById("blog-published").checked = Number(blog.is_published) === 1;
  document.getElementById("blog-order").value = Number(blog.display_order) || 0;

  document.getElementById("blogSubmitBtn").innerText = "Update Blog";
  document.getElementById("blogStatus").innerText = `Editing blog ID: ${id}`;
  window.scrollTo({ top: document.getElementById("blogForm").offsetTop - 20, behavior: "smooth" });
}

async function deleteBlog(id) {
  if (!confirm("Delete this blog?")) return;
  await toJson(await adminApiFetch(`${API}/blogs/${id}`, { method: "DELETE" }));
  if (editingBlogId === Number(id)) resetBlogForm();
  loadDashboardData();
}

document.getElementById("blogForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = blogPayloadFromForm();
  const statusEl = document.getElementById("blogStatus");

  if (!payload.title || !payload.summary) {
    statusEl.innerText = "❌ Title and summary required.";
    return;
  }

  try {
    const blogImageFile = document.getElementById("blog-image-file").files?.[0];
    if (blogImageFile) {
      statusEl.innerText = "Uploading blog image...";
      const upload = await uploadImageToSql(blogImageFile, "blog");
      setBlogImageSelection(upload.imageId, upload.imageUrl);
      document.getElementById("blog-image-file").value = "";
    }

    const freshPayload = blogPayloadFromForm();
    statusEl.innerText = editingBlogId ? "Updating blog..." : "Adding blog...";

    const endpoint = editingBlogId ? `${API}/blogs/${editingBlogId}` : `${API}/blogs`;
    const method = editingBlogId ? "PUT" : "POST";

    await toJson(await adminApiFetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(freshPayload)
    }));

    statusEl.innerText = editingBlogId ? "✅ Blog updated." : "✅ Blog added.";
    resetBlogForm();
    loadDashboardData();
  } catch (error) {
    statusEl.innerText = `❌ ${error.message}`;
  }
});

/* ============================================================
   ABOUT + EXPERIENCE FORM SECTION
   ============================================================ */
function aboutContentPayloadFromForm() {
  return {
    tagline: document.getElementById("about-tagline-input").value.trim(),
    headline: document.getElementById("about-headline-input").value.trim(),
    paragraph_1: document.getElementById("about-p1-input").value.trim(),
    paragraph_2: document.getElementById("about-p2-input").value.trim(),
    paragraph_3: document.getElementById("about-p3-input").value.trim(),
    experience_summary: document.getElementById("about-exp-summary-input").value.trim()
  };
}

function experiencePayloadFromForm() {
  return {
    year_label: document.getElementById("exp-year-input").value.trim(),
    company_name: document.getElementById("exp-company-input").value.trim(),
    job_role: document.getElementById("exp-role-input").value.trim(),
    position_title: document.getElementById("exp-position-input").value.trim(),
    description: document.getElementById("exp-description-input").value.trim(),
    display_order: Number(document.getElementById("exp-order-input").value || 0)
  };
}

function resetExperienceForm() {
  editingExperienceId = null;
  document.getElementById("experienceForm").reset();
  document.getElementById("exp-order-input").value = 0;
  document.getElementById("experienceSubmitBtn").innerText = "Add Experience";
  document.getElementById("experienceStatus").innerText = "";
}

async function editExperience(id) {
  const experience = state.aboutExperiences.find((item) => Number(item.id) === Number(id));
  if (!experience) return;

  editingExperienceId = Number(id);
  document.getElementById("exp-year-input").value = experience.year_label || "";
  document.getElementById("exp-company-input").value = experience.company_name || "";
  document.getElementById("exp-role-input").value = experience.job_role || "";
  document.getElementById("exp-position-input").value = experience.position_title || "";
  document.getElementById("exp-description-input").value = experience.description || "";
  document.getElementById("exp-order-input").value = Number(experience.display_order) || 0;
  document.getElementById("experienceSubmitBtn").innerText = "Update Experience";
  document.getElementById("experienceStatus").innerText = `Editing experience ID: ${id}`;
  window.scrollTo({ top: document.getElementById("experienceForm").offsetTop - 20, behavior: "smooth" });
}

async function deleteExperience(id) {
  if (!confirm("Delete this experience item?")) return;
  await toJson(await adminApiFetch(`${API}/about/experiences/${id}`, { method: "DELETE" }));
  if (editingExperienceId === Number(id)) resetExperienceForm();
  loadDashboardData();
}

document.getElementById("aboutContentForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const statusEl = document.getElementById("aboutContentStatus");
  const payload = aboutContentPayloadFromForm();

  if (!payload.headline || !payload.paragraph_1 || !payload.experience_summary) {
    statusEl.innerText = "❌ Headline, paragraph 1 and experience summary are required.";
    return;
  }

  try {
    statusEl.innerText = "Saving about content...";
    await toJson(await adminApiFetch(`${API}/about`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }));
    statusEl.innerText = "✅ About content updated.";
    loadDashboardData();
  } catch (error) {
    statusEl.innerText = `❌ ${error.message}`;
  }
});

document.getElementById("experienceForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const statusEl = document.getElementById("experienceStatus");
  const payload = experiencePayloadFromForm();

  if (!payload.year_label || !payload.company_name || !payload.job_role || !payload.position_title) {
    statusEl.innerText = "❌ Year, company, role, and position are required.";
    return;
  }

  try {
    statusEl.innerText = editingExperienceId ? "Updating experience..." : "Adding experience...";

    const endpoint = editingExperienceId
      ? `${API}/about/experiences/${editingExperienceId}`
      : `${API}/about/experiences`;
    const method = editingExperienceId ? "PUT" : "POST";

    await toJson(await adminApiFetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }));

    statusEl.innerText = editingExperienceId ? "✅ Experience updated." : "✅ Experience added.";
    resetExperienceForm();
    loadDashboardData();
  } catch (error) {
    statusEl.innerText = `❌ ${error.message}`;
  }
});

/* ============================================================
   ATS RESUME UPLOAD SECTION
   ============================================================ */
function clearResumeUploadSelection() {
  const fileEl = document.getElementById("resume-file");
  if (fileEl) fileEl.value = "";
}

async function fileToPlainText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read text file"));
    reader.readAsText(file);
  });
}

const resumeFileInput = document.getElementById("resume-file");
if (resumeFileInput) {
  resumeFileInput.addEventListener("change", async () => {
    const file = resumeFileInput.files?.[0];
    const metaEl = document.getElementById("resumeUploadMeta");
    const atsTextEl = document.getElementById("resume-ats-text");
    if (!file || !metaEl) return;

    metaEl.innerText = `Selected: ${file.name} | ${formatFileSize(file.size)}`;

    if (file.type === "text/plain" && atsTextEl) {
      try {
        atsTextEl.value = await fileToPlainText(file);
      } catch (_error) {
        // Text paste is optional; upload still works.
      }
    }
  });
}

const resumeUploadForm = document.getElementById("resumeUploadForm");
if (resumeUploadForm) {
  resumeUploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById("resumeUploadStatus");
    const fileEl = document.getElementById("resume-file");
    const atsTextEl = document.getElementById("resume-ats-text");
    const file = fileEl?.files?.[0];

    if (!file) {
      statusEl.innerText = "❌ Please choose a resume file first.";
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      statusEl.innerText = "❌ Resume file must be under 8MB.";
      return;
    }

    try {
      statusEl.innerText = "Uploading resume and calculating ATS score...";
      const dataUrl = await fileToDataUrl(file);
      const data = await toJson(await adminApiFetch(`${API}/resume-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataUrl,
          fileName: file.name || "resume",
          ats_text: atsTextEl?.value || ""
        })
      }));

      state.resumeUpload = normalizeResumeUploadResponse(data.upload || null);
      populateResumeUploadForm();
      statusEl.innerText = `✅ Resume uploaded. ATS Score: ${state.resumeUpload?.ats_score || 0}/100`;
      clearResumeUploadSelection();
      loadDashboardData();
    } catch (error) {
      statusEl.innerText = `❌ ${error.message}`;
    }
  });
}

async function deleteUploadedResume() {
  const statusEl = document.getElementById("resumeUploadStatus");
  if (!confirm("Remove uploaded CV from frontend?")) return;

  try {
    if (statusEl) statusEl.innerText = "Removing uploaded CV...";
    await toJson(await adminApiFetch(`${API}/resume-upload`, { method: "DELETE" }));
    state.resumeUpload = null;
    populateResumeUploadForm();
    if (statusEl) statusEl.innerText = "✅ Uploaded CV removed.";
    loadDashboardData();
  } catch (error) {
    if (statusEl) statusEl.innerText = `❌ ${error.message}`;
  }
}

function logout() {
  const returnUrl = sessionStorage.getItem("admin_return_url") || localStorage.getItem("admin_return_url");
  clearAdminSession();
  sessionStorage.removeItem("admin_return_url");
  localStorage.removeItem("admin_return_url");
  const targetUrl = returnUrl || "../index.html";

  if (window.opener && !window.opener.closed) {
    window.opener.location.href = targetUrl;
    window.opener.focus();
    window.close();

    setTimeout(() => {
      window.location.href = targetUrl;
    }, 250);
    return;
  }

  window.location.href = targetUrl;
}

initAdminAccessSelector();
setActiveAdminModule("contacts", { scroll: false });
loadDashboardData();
setInterval(loadDashboardData, 15000);
clearProjectImageSelection();
clearBlogImageSelection();
resetExperienceForm();

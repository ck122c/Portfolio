const API_ROOT = window.location.protocol === "file:" ? "http://localhost:5001" : window.location.origin;
const API_URL = `${API_ROOT}/api/resume`;

const fallbackResume = {
  full_name: "Chandan Kumar",
  headline: "Data Scientist | AI Enthusiast | Problem Solver",
  email: "chandankumar122c@gmail.com",
  phone: "",
  location: "Indore, India",
  website: "",
  linkedin_url: "https://www.linkedin.com/in/chandankumar122c",
  github_url: "https://github.com/ck122c",
  summary:
    "I build data-driven products, dashboards, and AI-enabled web experiences focused on clarity, performance, and real business impact.",
  skills: "Python\nSQL\nPower BI\nExcel\nData Visualization\nHTML\nCSS\nJavaScript\nNode.js\nMySQL",
  experience:
    "Data Analyst / Builder | GT24 TECH / Freelance | 2025 - Present\nCreating analytics dashboards, AI utilities, and SQL-backed portfolio products.",
  education: "Computer Science and data analytics focused learning path.",
  projects: "Portfolio Website\nSQL-backed portfolio with dynamic admin panel.",
  certifications: "Data Analytics Practice\nAI and Web Development Projects"
};

const fallbackUpload = null;
const downloadButton = document.getElementById("downloadCvFileBtn");
let activeDownloadUrl = "";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function splitSkills(value = "") {
  return String(value || "")
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitBlocks(value = "") {
  return String(value || "")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function linkLine(label, value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const isUrl = /^https?:\/\//i.test(text);
  const safeText = escapeHtml(text);
  return isUrl
    ? `<a href="${safeText}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`
    : `<span>${safeText}</span>`;
}

function contactLine(value) {
  const text = String(value || "").trim();
  return text ? `<span>${escapeHtml(text)}</span>` : "";
}

function renderRichSection(title, value) {
  const blocks = splitBlocks(value);
  if (!blocks.length) return "";

  const content = blocks.map((block) => {
    const lines = block.split("\n");
    const heading = lines.shift() || "";
    const body = lines.join("\n").trim();
    return `<div class="resume-block">
      <strong>${escapeHtml(heading)}</strong>
      ${body ? `<span>${escapeHtml(body)}</span>` : ""}
    </div>`;
  }).join("");

  return `<section class="resume-section">
    <h2>${escapeHtml(title)}</h2>
    ${content}
  </section>`;
}

function renderPlainSection(title, value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return `<section class="resume-section">
    <h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(text)}</p>
  </section>`;
}

function normalizeUpload(upload = null) {
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
    file_name: String(upload.file_name || ""),
    mime_type: String(upload.mime_type || ""),
    byte_size: Number(upload.byte_size || 0),
    ats_score: Number(upload.ats_score || 0),
    ats_feedback: Array.isArray(feedback) ? feedback : [],
    download_url: String(upload.download_url || "/api/resume-upload/file")
  };
}

function formatFileSize(bytes = 0) {
  const size = Number(bytes || 0);
  if (!size) return "Size unavailable";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getResumeType(upload = {}) {
  const mime = String(upload.mime_type || "").toLowerCase();
  const file = String(upload.file_name || "").toLowerCase();
  if (mime.includes("pdf") || file.endsWith(".pdf")) return "ATS Friendly PDF Resume";
  if (mime.includes("word") || file.endsWith(".doc") || file.endsWith(".docx")) return "Word Resume";
  if (mime.includes("text") || file.endsWith(".txt")) return "Plain Text ATS Resume";
  return "Uploaded Resume";
}

function getJobRole(resume = {}) {
  const headline = String(resume.headline || "").trim();
  if (!headline) return "Data / AI Role";
  return headline.split("|").map((item) => item.trim()).filter(Boolean)[0] || headline;
}

function buildResumePreview(upload = null, resume = fallbackResume) {
  const normalized = normalizeUpload(upload);
  if (!normalized) return "";

  const previewUrl = `${API_ROOT}/api/resume-upload/preview`;
  const canPreviewInline = /pdf/i.test(normalized.mime_type) || /\.pdf$/i.test(normalized.file_name);

  return `<section class="cv-preview-card">
    <div class="cv-preview-info">
      <span class="ats-kicker">CV Preview</span>
      <h2>${escapeHtml(getResumeType(normalized))}</h2>
      <div class="cv-meta-grid">
        <span><strong>Job Role</strong>${escapeHtml(getJobRole(resume))}</span>
        <span><strong>File Type</strong>${escapeHtml(getResumeType(normalized))}</span>
        <span><strong>File Size</strong>${escapeHtml(formatFileSize(normalized.byte_size))}</span>
      </div>
    </div>
    ${
      canPreviewInline
        ? `<iframe class="cv-preview-frame" src="${escapeHtml(previewUrl)}#toolbar=0" title="CV preview"></iframe>`
        : `<div class="cv-preview-fallback">
            <strong>Preview not available for this file type</strong>
            <p>DOC/DOCX files browser me direct preview nahi hote. ATS score aur details upar dikh rahe hain; download button se file open kar sakte ho.</p>
          </div>`
    }
  </section>`;
}

function renderAtsPanel(upload) {
  if (!upload) {
    updateDownloadButton(null);
    return `<section class="ats-panel">
      <div class="ats-score-wrap">
        <span class="ats-kicker">Download CV</span>
        <strong>--<small>/100</small></strong>
        <p>No uploaded CV found</p>
      </div>
      <div class="ats-tips">
        <h2>Upload CV from Admin</h2>
        <p>Admin panel se ATS friendly PDF/DOCX/TXT resume upload karo. Upload ke baad yahan score, tips, aur direct download button show hoga.</p>
        <a href="../admin/login.html" class="download-uploaded-btn muted-action">Open Admin</a>
      </div>
    </section>`;
  }

  const score = Math.max(0, Math.min(100, Number(upload.ats_score || 0)));
  const tips = upload.ats_feedback.length
    ? upload.ats_feedback
    : ["Keep your resume simple, keyword-rich, and measurable."];
  const downloadUrl = /^https?:\/\//i.test(upload.download_url)
    ? upload.download_url
    : `${API_ROOT}${upload.download_url || "/api/resume-upload/file"}`;
  updateDownloadButton(downloadUrl, upload.file_name || "CV");

  return `<section class="ats-panel">
    <div class="ats-score-wrap">
      <span class="ats-kicker">Download Ready</span>
      <strong>${score}<small>/100</small></strong>
      <p>${escapeHtml(upload.file_name || "Uploaded resume")}</p>
    </div>
    <div class="ats-tips">
      <h2>Your CV is ready</h2>
      <p class="ats-download-copy">Admin uploaded CV is connected to this page. Use the button below to download the exact uploaded file.</p>
      <ul>${tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join("")}</ul>
      <a href="${escapeHtml(downloadUrl)}" class="download-uploaded-btn" download>Download Uploaded CV</a>
    </div>
  </section>`;
}

function updateDownloadButton(downloadUrl, fileName = "CV") {
  activeDownloadUrl = downloadUrl || "";
  if (!downloadButton) return;

  if (!activeDownloadUrl) {
    downloadButton.href = "#";
    downloadButton.textContent = "Upload CV First";
    downloadButton.classList.add("is-disabled");
    downloadButton.removeAttribute("download");
    return;
  }

  downloadButton.href = activeDownloadUrl;
  downloadButton.textContent = "Download CV";
  downloadButton.classList.remove("is-disabled");
  downloadButton.setAttribute("download", fileName);
}

function renderResume(resume, upload = fallbackUpload) {
  const skills = splitSkills(resume.skills);
  const contacts = [
    contactLine(resume.email),
    contactLine(resume.phone),
    contactLine(resume.location),
    linkLine("Portfolio", resume.website),
    linkLine("LinkedIn", resume.linkedin_url),
    linkLine("GitHub", resume.github_url)
  ].filter(Boolean).join("");

  document.getElementById("resumePage").innerHTML = `
    <header class="resume-head">
      <div>
        <h1 class="resume-name">${escapeHtml(resume.full_name)}</h1>
        <p class="resume-headline">${escapeHtml(resume.headline)}</p>
      </div>
      <div class="resume-contact">${contacts}</div>
    </header>

    ${renderAtsPanel(normalizeUpload(upload))}
    ${buildResumePreview(upload, resume)}

    <div class="resume-grid">
      <aside>
        ${skills.length ? `<section class="resume-section">
          <h2>Skills</h2>
          <ul class="skill-list">${skills.map((skill) => `<li>${escapeHtml(skill)}</li>`).join("")}</ul>
        </section>` : ""}
        ${renderPlainSection("Education", resume.education)}
        ${renderPlainSection("Certifications", resume.certifications)}
      </aside>

      <article>
        ${renderPlainSection("Profile", resume.summary)}
        ${renderRichSection("Experience", resume.experience)}
        ${renderRichSection("Projects", resume.projects)}
      </article>
    </div>
  `;
}

async function loadResume() {
  try {
    const response = await fetch(`${API_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Resume API not available");
    const data = await response.json();
    renderResume(data.resume || fallbackResume, data.upload || null);
  } catch (_error) {
    renderResume(fallbackResume, fallbackUpload);
  }
}

if (downloadButton) {
  downloadButton.addEventListener("click", (event) => {
    if (activeDownloadUrl) return;
    event.preventDefault();
    alert("Admin panel se pehle CV upload karo, phir yahan download active hoga.");
  });
}

const resumeBackBtn = document.getElementById("resumeBackBtn");
if (resumeBackBtn) {
  resumeBackBtn.addEventListener("click", (event) => {
    if (window.history.length <= 1) return;
    event.preventDefault();
    window.history.back();
  });
}

loadResume();

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
    ats_score: Number(upload.ats_score || 0),
    ats_feedback: Array.isArray(feedback) ? feedback : [],
    download_url: String(upload.download_url || "/api/resume-upload/file")
  };
}

function renderAtsPanel(upload) {
  if (!upload) {
    return `<section class="ats-panel">
      <div>
        <span class="ats-kicker">ATS CV</span>
        <h2>No uploaded resume yet</h2>
        <p>Admin panel se PDF/DOCX resume upload karo, yahan score aur improvement tips dikh jayenge.</p>
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

  return `<section class="ats-panel">
    <div class="ats-score-wrap">
      <span class="ats-kicker">Uploaded CV Score</span>
      <strong>${score}<small>/100</small></strong>
      <p>${escapeHtml(upload.file_name || "Uploaded resume")}</p>
    </div>
    <div class="ats-tips">
      <h2>How to improve score</h2>
      <ul>${tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join("")}</ul>
      <a href="${escapeHtml(downloadUrl)}" class="download-uploaded-btn">Download Uploaded CV</a>
    </div>
  </section>`;
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

document.getElementById("downloadPdfBtn").addEventListener("click", () => {
  window.print();
});

document.getElementById("resumeBackBtn").addEventListener("click", () => {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  window.location.href = "../index.html#about";
});

loadResume();

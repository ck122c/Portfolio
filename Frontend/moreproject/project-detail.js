/* ============================================================
   PROJECT DETAIL PAGE SCRIPT SECTION
   - View Project button se aane wale project ka full detail yahan load hota hai.
   ============================================================ */
(() => {
  "use strict";

  /* ================= API + QUERY SECTION ================= */
  const params = new URLSearchParams(window.location.search);
  const projectId = Number(params.get("id") || 0);
  const projectSlugFromQuery = String(params.get("slug") || "").trim();
  const projectSlugFromPath = (() => {
    const match = window.location.pathname.match(/\/project\/([^/?#]+)/i);
    return match ? decodeURIComponent(match[1] || "").trim() : "";
  })();
  const projectSlug = projectSlugFromPath || projectSlugFromQuery;
  const apiBaseCandidates = Array.from(new Set([
    typeof window.__API_BASE__ === "string" ? window.__API_BASE__ : "",
    "http://localhost:5001",
    "http://127.0.0.1:5001"
  ].filter(Boolean)));

  /* ================= DOM SECTION ================= */
  const titleEl = document.getElementById("projectTitle");
  const techEl = document.getElementById("projectTech");
  const imageEl = document.getElementById("projectHeroImage");
  const descriptionEl = document.getElementById("projectDescription");
  const contentEl = document.getElementById("projectContent");
  const actionsEl = document.getElementById("projectActions");

  /* ================= HELPERS SECTION ================= */
  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeProject(row = {}) {
    return {
      id: Number(row.id || 0),
      slug: row.slug || "",
      title: row.title || "Untitled Project",
      tech: row.tech || "",
      description: row.description || "",
      content: row.content || "",
      imageUrl: row.imageUrl || row.image_url || "",
      liveDemoUrl: row.liveDemoUrl || row.live_demo_url || row.demo_url || "",
      githubUrl: row.githubUrl || row.github_url || "",
      linkedinUrl: row.linkedinUrl || row.linkedin_url || "",
      videoUrl: row.videoUrl || row.video_url || "",
      extraLabel: row.extraLabel || row.extra_label || "",
      extraUrl: row.extraUrl || row.extra_url || ""
    };
  }

  function resolveImagePath(rawPath = "") {
    if (!rawPath) return "../image/Portfolio UI.png";
    if (/^https?:\/\//i.test(rawPath)) return rawPath;

    if (rawPath.startsWith("/api/uploads/image/") || rawPath.startsWith("api/uploads/image/")) {
      const apiBase = apiBaseCandidates[0] || "http://localhost:5001";
      const normalizedPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
      return `${apiBase}${normalizedPath}`;
    }

    if (rawPath.startsWith("../")) return rawPath;
    if (rawPath.startsWith("./")) return rawPath.replace(/^\.\//, "");
    return `../${rawPath}`;
  }

  function resolveDemoPath(rawPath = "") {
    const value = String(rawPath || "").trim();
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith("../") || value.startsWith("./")) return value;
    if (value.startsWith("moreproject/")) return value.replace(/^moreproject\//, "");
    return value;
  }

  function createLink(url, label, ghost = false) {
    if (!url || !label) return "";
    const isExternal = /^https?:\/\//i.test(url);
    const target = isExternal ? ' target="_blank" rel="noopener"' : "";
    const className = ghost ? "project-action-btn ghost" : "project-action-btn";
    return `<a class="${className}" href="${escapeHtml(url)}"${target}>${escapeHtml(label)}</a>`;
  }

  /* ================= API FETCH SECTION ================= */
  async function fetchProjectById(id) {
    for (const base of apiBaseCandidates) {
      try {
        const response = await fetch(`${base}/api/projects/${id}`);
        if (!response.ok) continue;

        const data = await response.json();
        if (data?.success && data?.project) {
          return normalizeProject(data.project);
        }
      } catch (_error) {
        // try next API base
      }
    }
    return null;
  }

  async function fetchProjectBySlug(slug) {
    const safeSlug = String(slug || "").trim();
    if (!safeSlug) return null;

    for (const base of apiBaseCandidates) {
      try {
        const response = await fetch(`${base}/api/projects/slug/${encodeURIComponent(safeSlug)}`);
        if (!response.ok) continue;
        const data = await response.json();
        if (data?.success && data?.project) {
          return normalizeProject(data.project);
        }
      } catch (_error) {
        // try next API base
      }
    }
    return null;
  }

  /* ================= RENDER SECTION ================= */
  function renderProject(project) {
    const safeProject = normalizeProject(project);
    document.title = `${safeProject.title} | Project Detail`;

    titleEl.textContent = safeProject.title;
    techEl.textContent = `Tech: ${safeProject.tech || "N/A"}`;
    descriptionEl.textContent = safeProject.description || "Project summary not available yet.";
    if (contentEl) {
      const fullContent = String(safeProject.content || "");
      contentEl.textContent = fullContent || safeProject.description || "Project detail not available yet.";
    }
    imageEl.src = resolveImagePath(safeProject.imageUrl);
    imageEl.alt = safeProject.title;

    const actions = [
      createLink(resolveDemoPath(safeProject.liveDemoUrl), "Live Demo", true),
      createLink(safeProject.githubUrl, "GitHub", true),
      createLink(safeProject.linkedinUrl, "LinkedIn", true),
      createLink(safeProject.videoUrl, "Video", true),
      createLink(safeProject.extraUrl, safeProject.extraLabel || "More", true)
    ].filter(Boolean);

    actionsEl.innerHTML = actions.join("");
  }

  function renderNotFound() {
    renderProject({
      title: "Project not found",
      tech: "N/A",
      description: "This project detail is not available. Please go back and try another project.",
      content: "This project detail is not available. Please go back and try another project.",
      image_url: "../image/Portfolio UI.png"
    });
  }

  function initAnalyticsTracking() {
    const startedAt = Date.now();
    let sent = false;

    function apiUrl(pathValue = "/api/visit") {
      const base = apiBaseCandidates[0] || "http://localhost:5001";
      return `${base}${pathValue}`;
    }

    fetch(apiUrl("/api/visit"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: window.location.pathname })
    }).catch(() => {});

    function flush() {
      if (sent) return;
      sent = true;
      const payload = JSON.stringify({
        time: Math.max(0, Date.now() - startedAt),
        page: window.location.pathname
      });
      const target = apiUrl("/api/visit-time");

      try {
        const blob = new Blob([payload], { type: "application/json" });
        if (navigator.sendBeacon && navigator.sendBeacon(target, blob)) return;
      } catch (_error) {
        // fallback fetch
      }

      fetch(target, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true
      }).catch(() => {});
    }

    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
  }

  /* ================= BOOTSTRAP SECTION ================= */
  async function init() {
    if (projectSlug) {
      const project = await fetchProjectBySlug(projectSlug);
      if (project) {
        renderProject(project);
        return;
      }
    }

    if (projectId > 0) {
      const project = await fetchProjectById(projectId);
      if (project) {
        renderProject(project);
        return;
      }
    }

    const fallbackProject = {
      title: params.get("title") || "",
      tech: params.get("tech") || "",
      description: params.get("description") || "",
      content: params.get("content") || "",
      image_url: params.get("image") || "",
      live_demo_url: params.get("live") || "",
      github_url: params.get("github") || "",
      linkedin_url: params.get("linkedin") || "",
      video_url: params.get("video") || "",
      extra_label: params.get("extraLabel") || "",
      extra_url: params.get("extraUrl") || ""
    };

    if (fallbackProject.title || fallbackProject.description || fallbackProject.image_url) {
      renderProject(fallbackProject);
      return;
    }

    renderNotFound();
  }

  initAnalyticsTracking();
  init();
})();

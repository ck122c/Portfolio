/* ============================================================
   MORE PROJECTS PAGE SCRIPT (DB POWERED)
   - Admin panel se add kiye projects yahan auto-list honge.
   ============================================================ */
(() => {
  "use strict";

  /* ================= BASE DATA + DOM SECTION ================= */
  const fallbackProjects = Array.isArray(window.PROJECTS_DATA) ? window.PROJECTS_DATA.slice() : [];
  const apiBaseCandidates = Array.from(new Set([
    typeof window.__API_BASE__ === "string" ? window.__API_BASE__ : "",
    "http://localhost:5001",
    "http://127.0.0.1:5001"
  ].filter(Boolean)));

  const grid = document.getElementById("allProjectsGrid");
  const tabs = Array.from(document.querySelectorAll("#allProjectsFilterTabs .filter-btn"));
  const meta = document.getElementById("projectsMeta");
  const searchInput = document.getElementById("allProjectsSearch");

  if (!grid || !tabs.length) return;

  /* ================= HELPERS SECTION ================= */
  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeProject(project = {}) {
    return {
      id: project.id || "",
      slug: project.slug || "",
      category: String(project.category || "web").toLowerCase(),
      categoryLabel: project.categoryLabel || project.category_label || "Project",
      title: project.title || "Untitled Project",
      tech: project.tech || "",
      description: project.description || "",
      content: project.content || "",
      image: project.image || project.image_url || "",
      demoUrl: project.demoUrl || project.demo_url || project.live_demo_url || "",
      githubUrl: project.githubUrl || project.github_url || "",
      linkedinUrl: project.linkedinUrl || project.linkedin_url || "",
      videoUrl: project.videoUrl || project.video_url || "",
      extraUrl: project.extraUrl || project.extra_url || "",
      extraLabel: project.extraLabel || project.extra_label || ""
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
    if (!rawPath) return "#";
    if (rawPath.startsWith("http://") || rawPath.startsWith("https://")) return rawPath;
    if (rawPath.startsWith("../") || rawPath.startsWith("./")) return rawPath;
    if (rawPath.startsWith("moreproject/")) return rawPath.replace(/^moreproject\//, "");
    return rawPath;
  }

  function buildProjectDetailUrl(project) {
    const params = new URLSearchParams({
      slug: project.slug || "",
      id: String(project.id || ""),
      title: project.title || "",
      tech: project.tech || "",
      description: project.description || "",
      content: project.content || "",
      image: project.image || "",
      live: project.demoUrl || "",
      github: project.githubUrl || "",
      linkedin: project.linkedinUrl || "",
      video: project.videoUrl || "",
      extraLabel: project.extraLabel || "",
      extraUrl: project.extraUrl || ""
    });
    return `project-detail.html?${params.toString()}`;
  }

  function actionButtons(project) {
    const buttons = [];
    buttons.push(`<a class="btn btn-primary" href="${escapeHtml(buildProjectDetailUrl(project))}">View Project</a>`);

    if (project.demoUrl) {
      buttons.push(`<a class="btn btn-primary" href="${escapeHtml(resolveDemoPath(project.demoUrl))}">Live Demo</a>`);
    }
    if (project.githubUrl) {
      buttons.push(`<a class="btn btn-ghost" href="${escapeHtml(project.githubUrl)}" target="_blank" rel="noopener">GitHub</a>`);
    }
    if (project.linkedinUrl) {
      buttons.push(`<a class="btn btn-ghost" href="${escapeHtml(project.linkedinUrl)}" target="_blank" rel="noopener">LinkedIn</a>`);
    }
    if (project.videoUrl) {
      buttons.push(`<a class="btn btn-ghost" href="${escapeHtml(project.videoUrl)}" target="_blank" rel="noopener">Video</a>`);
    }
    if (project.extraUrl && project.extraLabel) {
      buttons.push(`<a class="btn btn-ghost" href="${escapeHtml(project.extraUrl)}" target="_blank" rel="noopener">${escapeHtml(project.extraLabel)}</a>`);
    }

    return buttons.join("");
  }

  /* ================= CARD TEMPLATE SECTION ================= */
  function projectCardTemplate(project) {
    return `
      <article class="project-card ${project.category || ""}">
        <img src="${escapeHtml(resolveImagePath(project.image))}" alt="${escapeHtml(project.title)}" loading="lazy" />
        <div class="project-info">
          <span class="project-category">${escapeHtml(project.categoryLabel || "Project")}</span>
          <h3>${escapeHtml(project.title)}</h3>
          <p class="project-tech"><strong>Tech:</strong> ${escapeHtml(project.tech || "N/A")}</p>
          <p class="project-desc">${escapeHtml(project.description || "No description added yet.")}</p>
          <div class="project-links">
            ${actionButtons(project)}
          </div>
        </div>
      </article>
    `;
  }

  /* ================= DATA FETCH SECTION ================= */
  async function fetchProjectsFromApi() {
    for (const base of apiBaseCandidates) {
      try {
        const response = await fetch(`${base}/api/projects`);
        if (!response.ok) continue;
        const data = await response.json();
        if (Array.isArray(data)) return data.map(normalizeProject);
      } catch (_error) {
        // try next API base
      }
    }
    return [];
  }

  /* ================= RENDER SECTION ================= */
  let allProjects = fallbackProjects.map(normalizeProject);
  let activeFilter = "all";
  let searchTerm = "";

  function matchesSearch(project, query = "") {
    const q = String(query || "").toLowerCase().trim();
    if (!q) return true;
    const bag = [
      project.title,
      project.tech,
      project.description,
      project.categoryLabel,
      project.category
    ].join(" ").toLowerCase();
    return bag.includes(q);
  }

  function renderProjects(filter = "all", query = "") {
    const filtered = (filter === "all"
      ? allProjects
      : allProjects.filter((project) => project.category === filter))
      .filter((project) => matchesSearch(project, query));

    if (!filtered.length) {
      grid.innerHTML = '<div class="empty-state">Is category me abhi project add nahi hua hai.</div>';
      if (meta) meta.textContent = "0 projects";
      return;
    }

    grid.innerHTML = filtered.map(projectCardTemplate).join("");
    if (meta) meta.textContent = `${filtered.length} project${filtered.length > 1 ? "s" : ""} showing`;
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activeFilter = tab.getAttribute("data-filter") || "all";
      tabs.forEach((btn) => btn.classList.remove("active"));
      tab.classList.add("active");
      renderProjects(activeFilter, searchTerm);
    });
  });

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      searchTerm = String(searchInput.value || "").trim();
      renderProjects(activeFilter, searchTerm);
    });
  }

  async function loadData() {
    renderProjects(activeFilter, searchTerm);
    const dbProjects = await fetchProjectsFromApi();
    if (dbProjects.length) {
      allProjects = dbProjects;
      activeFilter = tabs.find((btn) => btn.classList.contains("active"))?.getAttribute("data-filter") || "all";
      renderProjects(activeFilter, searchTerm);
    }
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

  initAnalyticsTracking();
  loadData();
})();

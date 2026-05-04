/* ============================================================
   MORE BLOG PAGE SCRIPT (DB POWERED)
   - Shows all published blogs (unlimited)
   - Admin-added blogs automatically appear here
   ============================================================ */
(() => {
  "use strict";

  const fallbackBlogs = Array.isArray(window.BLOGS_DATA) ? window.BLOGS_DATA.slice() : [];
  const apiBaseCandidates = Array.from(new Set([
    typeof window.__API_BASE__ === "string" ? window.__API_BASE__ : "",
    "http://localhost:5001",
    "http://127.0.0.1:5001"
  ].filter(Boolean)));

  const grid = document.getElementById("allBlogsGrid");
  const meta = document.getElementById("blogsMeta");
  const searchInput = document.getElementById("allBlogsSearch");

  if (!grid) return;

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeBlog(blog = {}) {
    return {
      id: Number(blog.id || 0),
      slug: blog.slug || "",
      title: blog.title || "Untitled Blog",
      summary: blog.summary || blog.description || "",
      content: blog.content || "",
      imageUrl: blog.imageUrl || blog.image_url || blog.image || "",
      readMoreUrl: blog.readMoreUrl || blog.read_more_url || blog.blogUrl || "",
      githubUrl: blog.githubUrl || blog.github_url || "",
      linkedinUrl: blog.linkedinUrl || blog.linkedin_url || "",
      videoUrl: blog.videoUrl || blog.video_url || "",
      extraUrl: blog.extraUrl || blog.extra_url || "",
      extraLabel: blog.extraLabel || blog.extra_label || ""
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

  function linkButton(url, label, extraClass = "", openInNewTab = true) {
    if (!url || !label) return "";
    const classes = `btn ${extraClass}`.trim();
    const isExternal = /^https?:\/\//i.test(url);
    const targetAttrs = openInNewTab && isExternal ? ' target="_blank" rel="noopener"' : "";
    return `<a href="${escapeHtml(url)}" class="${classes}"${targetAttrs}>${escapeHtml(label)}</a>`;
  }

  function buildReadMoreUrl(blog) {
    const params = new URLSearchParams({
      slug: blog.slug || "",
      id: String(blog.id || ""),
      title: blog.title || "",
      summary: blog.summary || "",
      content: blog.content || blog.summary || "",
      image: blog.imageUrl || ""
    });

    return `blog-detail.html?${params.toString()}`;
  }

  function blogCardTemplate(blog) {
    const readMoreUrl = buildReadMoreUrl(blog);
    const actions = [
      linkButton(readMoreUrl, "Read More", "btn-primary", false),
      linkButton(blog.githubUrl, "GitHub", "btn-ghost"),
      linkButton(blog.linkedinUrl, "LinkedIn", "btn-ghost"),
      linkButton(blog.videoUrl, "Video", "btn-ghost"),
      linkButton(blog.extraUrl, blog.extraLabel, "btn-ghost")
    ].filter(Boolean).join("");

    return `
      <article class="blog-card">
        <img src="${escapeHtml(resolveImagePath(blog.imageUrl))}" alt="${escapeHtml(blog.title)}" loading="lazy" />
        <div class="blog-info">
          <h3>${escapeHtml(blog.title)}</h3>
          <p class="blog-desc">${escapeHtml(blog.summary || "No summary available yet.")}</p>
          <div class="blog-links">${actions || '<a class="btn btn-primary" href="#">Read More</a>'}</div>
        </div>
      </article>
    `;
  }

  async function fetchBlogsFromApi() {
    for (const base of apiBaseCandidates) {
      try {
        const response = await fetch(`${base}/api/blogs?published=1&latest=1`);
        if (!response.ok) continue;

        const data = await response.json();
        if (Array.isArray(data)) {
          return data.map(normalizeBlog);
        }
      } catch (_error) {
        // try next api base
      }
    }

    return [];
  }

  function matchesBlogSearch(blog, query = "") {
    const q = String(query || "").toLowerCase().trim();
    if (!q) return true;
    const bag = [
      blog.title,
      blog.summary,
      blog.content
    ].join(" ").toLowerCase();
    return bag.includes(q);
  }

  function renderBlogs(blogs, query = "") {
    if (!Array.isArray(blogs) || !blogs.length) {
      grid.innerHTML = '<div class="empty-state">No blogs published yet.</div>';
      if (meta) meta.textContent = "0 blogs";
      return;
    }

    const sorted = blogs.slice()
      .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
      .filter((blog) => matchesBlogSearch(blog, query));

    if (!sorted.length) {
      grid.innerHTML = '<div class="empty-state">No blogs match your search.</div>';
      if (meta) meta.textContent = "0 blogs";
      return;
    }
    grid.innerHTML = sorted.map(blogCardTemplate).join("");
    if (meta) meta.textContent = `${sorted.length} blog${sorted.length > 1 ? "s" : ""} published`;
    animateBlogCards();
  }

  function animateBlogCards() {
    const cards = Array.from(grid.querySelectorAll(".blog-card"));
    cards.forEach((card, index) => {
      card.classList.remove("is-visible");
      const delay = Math.min(index * 70, 420);
      setTimeout(() => {
        card.classList.add("is-visible");
      }, delay);
    });
  }

  async function loadBlogs() {
    const fallbackNormalized = fallbackBlogs.map(normalizeBlog);
    let searchTerm = String(searchInput?.value || "").trim();
    renderBlogs(fallbackNormalized, searchTerm);

    const apiBlogs = await fetchBlogsFromApi();
    if (apiBlogs.length) {
      renderBlogs(apiBlogs, searchTerm);
    }

    if (searchInput) {
      const finalBlogs = apiBlogs.length ? apiBlogs : fallbackNormalized;
      searchInput.addEventListener("input", () => {
        searchTerm = String(searchInput.value || "").trim();
        renderBlogs(finalBlogs, searchTerm);
      });
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
  loadBlogs();
})();

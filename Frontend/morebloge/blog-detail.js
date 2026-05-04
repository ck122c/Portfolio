/* ============================================================
   BLOG DETAIL PAGE SCRIPT SECTION
   - Read More button se aane wale blog ka full detail yahan load hota hai.
   ============================================================ */
(() => {
  "use strict";

  /* ================= API + QUERY SECTION ================= */
  const params = new URLSearchParams(window.location.search);
  const blogId = Number(params.get("id") || 0);
  const blogSlugFromQuery = String(params.get("slug") || "").trim();
  const blogSlugFromPath = (() => {
    const match = window.location.pathname.match(/\/blog\/([^/?#]+)/i);
    return match ? decodeURIComponent(match[1] || "").trim() : "";
  })();
  const blogSlug = blogSlugFromPath || blogSlugFromQuery;
  const apiBaseCandidates = Array.from(new Set([
    typeof window.__API_BASE__ === "string" ? window.__API_BASE__ : "",
    "http://localhost:5001",
    "http://127.0.0.1:5001"
  ].filter(Boolean)));

  /* ================= DOM SECTION ================= */
  const titleEl = document.getElementById("blogTitle");
  const summaryEl = document.getElementById("blogSummary");
  const imageEl = document.getElementById("blogHeroImage");
  const contentEl = document.getElementById("blogContent");
  const actionsEl = document.getElementById("blogActions");

  /* ================= HELPERS SECTION ================= */
  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
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

  function normalizeBlog(row = {}) {
    return {
      id: Number(row.id || 0),
      slug: row.slug || "",
      title: row.title || "Untitled Blog",
      summary: row.summary || "",
      content: row.content || "",
      imageUrl: row.imageUrl || row.image_url || "",
      readMoreUrl: row.readMoreUrl || row.read_more_url || "",
      githubUrl: row.githubUrl || row.github_url || "",
      linkedinUrl: row.linkedinUrl || row.linkedin_url || "",
      videoUrl: row.videoUrl || row.video_url || "",
      extraUrl: row.extraUrl || row.extra_url || "",
      extraLabel: row.extraLabel || row.extra_label || ""
    };
  }

  function createLink(url, label, ghost = false) {
    if (!url || !label) return "";
    const isExternal = /^https?:\/\//i.test(url);
    const target = isExternal ? ' target="_blank" rel="noopener"' : "";
    const className = ghost ? "blog-action-btn ghost" : "blog-action-btn";
    return `<a class="${className}" href="${escapeHtml(url)}"${target}>${escapeHtml(label)}</a>`;
  }

  /* ================= API FETCH SECTION ================= */
  async function fetchBlogById(id) {
    for (const base of apiBaseCandidates) {
      try {
        const response = await fetch(`${base}/api/blogs/${id}`);
        if (!response.ok) continue;

        const data = await response.json();
        if (data?.success && data?.blog) {
          return normalizeBlog(data.blog);
        }
      } catch (_error) {
        // next API candidate
      }
    }
    return null;
  }

  async function fetchBlogBySlug(slug) {
    const safeSlug = String(slug || "").trim();
    if (!safeSlug) return null;

    for (const base of apiBaseCandidates) {
      try {
        const response = await fetch(`${base}/api/blogs/slug/${encodeURIComponent(safeSlug)}`);
        if (!response.ok) continue;

        const data = await response.json();
        if (data?.success && data?.blog) {
          return normalizeBlog(data.blog);
        }
      } catch (_error) {
        // next API candidate
      }
    }
    return null;
  }

  /* ================= RENDER SECTION ================= */
  function renderBlog(blog) {
    const safeBlog = normalizeBlog(blog);

    document.title = `${safeBlog.title} | Blog Detail`;
    titleEl.textContent = safeBlog.title;
    summaryEl.textContent = safeBlog.summary || "No summary added yet.";
    imageEl.src = resolveImagePath(safeBlog.imageUrl);
    imageEl.alt = safeBlog.title;

    const fullContent = String(safeBlog.content || "");
    contentEl.textContent = fullContent || safeBlog.summary || "Blog detail not available yet.";

    const actions = [
      createLink(safeBlog.readMoreUrl, "Source Link", true),
      createLink(safeBlog.videoUrl, "Video", true),
      createLink(safeBlog.githubUrl, "GitHub", true),
      createLink(safeBlog.linkedinUrl, "LinkedIn", true),
      createLink(safeBlog.extraUrl, safeBlog.extraLabel || "More", true)
    ].filter(Boolean);

    actionsEl.innerHTML = actions.join("");
  }

  function renderNotFound() {
    renderBlog({
      title: "Blog not found",
      summary: "This blog detail is not available.",
      content: "Please go back and try another blog post.",
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
    if (blogSlug) {
      const blog = await fetchBlogBySlug(blogSlug);
      if (blog) {
        renderBlog(blog);
        return;
      }
    }

    if (blogId > 0) {
      const blog = await fetchBlogById(blogId);
      if (blog) {
        renderBlog(blog);
        return;
      }
    }

    const fallbackBlog = {
      title: params.get("title") || "",
      summary: params.get("summary") || "",
      content: params.get("content") || "",
      image_url: params.get("image") || ""
    };

    if (fallbackBlog.title || fallbackBlog.summary || fallbackBlog.content || fallbackBlog.image_url) {
      renderBlog(fallbackBlog);
      return;
    }

    renderNotFound();
  }

  initAnalyticsTracking();
  init();
})();

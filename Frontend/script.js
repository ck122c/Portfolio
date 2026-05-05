/* ==========================================================================
   HOME PROJECTS FEATURE SECTION (DB POWERED)
   - Admin panel me add kiye project yahan auto-render honge.
   - Home page par category wise featured project show hoga.
   - More Project page ke liye links + extra/video/github buttons support.
   ========================================================================== */
function initProjectFilter() {
  const featuredGrid = document.querySelector("#featuredProjectsGrid");
  const filterBtns = Array.from(document.querySelectorAll("#projects .filter-tabs .filter-btn[data-filter]"));
  const projectsSearchInput = document.querySelector("#projectsSearchInput");
  const fallbackProjects = Array.isArray(window.PROJECTS_DATA) ? window.PROJECTS_DATA : [];
  const apiBaseCandidates = Array.from(new Set([
    typeof window.__API_BASE__ === "string" ? window.__API_BASE__ : "",
    "http://localhost:5001",
    "http://127.0.0.1:5001"
  ].filter(Boolean)));

  if (!featuredGrid || !filterBtns.length) return;

  const categoryOrder = ["ai", "web", "viz"];
  let featuredProjects = [];
  let activeFilter = "all";
  let projectSearchTerm = "";

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
      categoryLabel: project.categoryLabel || project.category_label || "",
      title: project.title || "Untitled Project",
      tech: project.tech || "",
      description: project.description || "",
      content: project.content || "",
      image: project.image || project.image_url || "",
      demoUrl: project.demoUrl || project.demo_url || project.live_demo_url || "",
      githubUrl: project.githubUrl || project.github_url || "",
      linkedinUrl: project.linkedinUrl || project.linkedin_url || "",
      videoUrl: project.videoUrl || project.video_url || "",
      extraLabel: project.extraLabel || project.extra_label || "",
      extraUrl: project.extraUrl || project.extra_url || "",
      isFeatured: Number(project.isFeatured ?? project.is_featured ?? 0),
      displayOrder: Number(project.displayOrder ?? project.display_order ?? 0)
    };
  }

  function resolveImagePath(rawPath = "") {
    if (!rawPath) return "image/Portfolio UI.png";
    if (/^https?:\/\//i.test(rawPath)) return rawPath;
    if (rawPath.startsWith("/api/uploads/image/") || rawPath.startsWith("api/uploads/image/")) {
      const apiBase = apiBaseCandidates[0] || "http://localhost:5001";
      const normalizedPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
      return `${apiBase}${normalizedPath}`;
    }
    if (rawPath.startsWith("../")) return rawPath.replace(/^\.\.\//, "");
    if (rawPath.startsWith("./")) return rawPath.replace(/^\.\//, "");
    return rawPath;
  }

  function resolveDemoPath(rawPath = "") {
    if (!rawPath) return "#";
    if (rawPath.includes("/") || rawPath.startsWith("http://") || rawPath.startsWith("https://")) return rawPath;
    return `moreproject/${rawPath}`;
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
    return `moreproject/project-detail.html?${params.toString()}`;
  }

  function actionButtons(project) {
    const buttons = [];
    buttons.push(`<a href="${escapeHtml(buildProjectDetailUrl(project))}" class="btn project-link">View Project</a>`);

    if (project.demoUrl) {
      buttons.push(`<a href="${escapeHtml(resolveDemoPath(project.demoUrl))}" class="btn project-link">Live Demo</a>`);
    }
    if (project.githubUrl) {
      buttons.push(`<a href="${escapeHtml(project.githubUrl)}" target="_blank" rel="noopener" class="btn">GitHub</a>`);
    }
    if (project.linkedinUrl) {
      buttons.push(`<a href="${escapeHtml(project.linkedinUrl)}" target="_blank" rel="noopener" class="btn">LinkedIn</a>`);
    }
    if (project.videoUrl) {
      buttons.push(`<a href="${escapeHtml(project.videoUrl)}" target="_blank" rel="noopener" class="btn">Video</a>`);
    }
    if (project.extraUrl && project.extraLabel) {
      buttons.push(`<a href="${escapeHtml(project.extraUrl)}" target="_blank" rel="noopener" class="btn">${escapeHtml(project.extraLabel)}</a>`);
    }

    return buttons.join("");
  }

  function createProjectCard(project) {
    return `
      <div class="project-card ${project.category}">
        <img src="${escapeHtml(resolveImagePath(project.image))}" alt="${escapeHtml(project.title)}" class="project-screenshot" loading="lazy" />
        <div class="project-info">
          <h3>${escapeHtml(project.title)}</h3>
          <p><strong>Tech:</strong> ${escapeHtml(project.tech || "N/A")}</p>
          <p>${escapeHtml(project.description || "No description available.")}</p>
          <div class="project-links">
            ${actionButtons(project)}
          </div>
        </div>
      </div>
    `;
  }

  function pickFeatured(projects) {
    return categoryOrder
      .map((category) => {
        const inCategory = projects.filter((item) => item.category === category);
        const featuredInCategory = inCategory.find((item) => Number(item.isFeatured) === 1);
        return featuredInCategory || inCategory[0] || null;
      })
      .filter(Boolean);
  }

  function matchesProjectSearch(project, query = "") {
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

  function renderFeatured(filter = "all", searchTerm = "") {
    const projectsToRender = (filter === "all"
      ? featuredProjects
      : featuredProjects.filter((project) => project.category === filter))
      .filter((project) => matchesProjectSearch(project, searchTerm));

    if (!projectsToRender.length) {
      featuredGrid.innerHTML = '<p style="color:#ccc;text-align:center;">No project found for this search.</p>';
      return;
    }

    featuredGrid.innerHTML = projectsToRender.map(createProjectCard).join("");
  }

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      activeFilter = btn.getAttribute("data-filter") || "all";
      filterBtns.forEach((tab) => tab.classList.remove("active"));
      btn.classList.add("active");
      renderFeatured(activeFilter, projectSearchTerm);
    });
  });

  if (projectsSearchInput) {
    projectsSearchInput.addEventListener("input", () => {
      projectSearchTerm = String(projectsSearchInput.value || "").trim();
      renderFeatured(activeFilter, projectSearchTerm);
    });
  }

  async function fetchProjectsFromApi() {
    for (const base of apiBaseCandidates) {
      try {
        const response = await fetch(`${base}/api/projects`);
        if (!response.ok) continue;
        const data = await response.json();
        if (Array.isArray(data)) return data.map(normalizeProject);
      } catch (_error) {
        // Try next base
      }
    }
    return [];
  }

  async function loadProjects() {
    const fallbackNormalized = fallbackProjects.map(normalizeProject);
    featuredProjects = pickFeatured(fallbackNormalized);
    renderFeatured(activeFilter, projectSearchTerm);

    const dbProjects = await fetchProjectsFromApi();
    if (dbProjects.length) {
      featuredProjects = pickFeatured(dbProjects);
      const activeBtn = filterBtns.find((btn) => btn.classList.contains("active"));
      activeFilter = activeBtn?.getAttribute("data-filter") || "all";
      renderFeatured(activeFilter, projectSearchTerm);
    }
  }

  loadProjects();
}



(() => {
  "use strict";

  /* -----------------------------
     Helpers
     ----------------------------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* -----------------------------
     Mobile Navbar Toggle
     - toggles mobile nav open/close
     - closes nav when any nav link is clicked
     ----------------------------- */
  function initMobileNavbar() {
    const hamburger = $(".hamburger");
    const navLinks = $(".nav-links");

    if (!hamburger || !navLinks) return;

    hamburger.addEventListener("click", () => {
      navLinks.classList.toggle("active");
      hamburger.classList.toggle("open"); // for hamburger animation
    });

    // Close menu when any nav link is clicked (mobile)
    $$(".nav-links a").forEach(link =>
      link.addEventListener("click", () => {
        navLinks.classList.remove("active");
        hamburger.classList.remove("open");
      })
    );
  }

  /* -----------------------------
     Active Navbar Link
     - Underlines the nav item for the section currently in view
     ----------------------------- */
  function initActiveNavbar() {
    const navItems = $$(".nav-links a[href^='#']:not(.btn)");
    const sectionIds = navItems
      .map((link) => String(link.getAttribute("href") || "").replace("#", ""))
      .filter(Boolean);
    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    if (!navItems.length || !sections.length) return;

    function setActiveNav(id) {
      navItems.forEach((link) => {
        const linkId = String(link.getAttribute("href") || "").replace("#", "");
        link.classList.toggle("active", linkId === id);
      });
    }

    navItems.forEach((link) => {
      link.addEventListener("click", () => {
        const id = String(link.getAttribute("href") || "").replace("#", "");
        if (id) setActiveNav(id);
      });
    });

    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (visible?.target?.id) {
        setActiveNav(visible.target.id);
      }
    }, {
      root: null,
      rootMargin: "-34% 0px -54% 0px",
      threshold: [0.08, 0.18, 0.32, 0.5]
    });

    sections.forEach((section) => observer.observe(section));
    setActiveNav((window.location.hash || "#home").replace("#", "") || "home");
  }

  /* -----------------------------
     Hire Me Modal
     - Opens premium WhatsApp + Email quick action panel
     ----------------------------- */
  function initHireModal() {
    const hireBtn = $("#hireMeBtn");
    const modal = $("#hireModal");
    if (!hireBtn || !modal) return;

    const closeEls = $$("[data-hire-close]", modal);

    function openModal(event) {
      event.preventDefault();
      modal.classList.add("active");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("hire-modal-open");
    }

    function closeModal() {
      modal.classList.remove("active");
      modal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("hire-modal-open");
    }

    hireBtn.addEventListener("click", openModal);
    closeEls.forEach((el) => el.addEventListener("click", closeModal));

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && modal.classList.contains("active")) {
        closeModal();
      }
    });
  }

  /* -----------------------------
     Admin Return URL
     - Saves the exact portfolio page/section before opening admin
     ----------------------------- */
  function initAdminReturnUrl() {
    const adminLink = $("#adminAccessLink");
    if (!adminLink) return;

    adminLink.addEventListener("click", (event) => {
      event.preventDefault();
      sessionStorage.setItem("admin_return_url", window.location.href);
      localStorage.setItem("admin_return_url", window.location.href);
      const adminTab = window.open(adminLink.href, "_blank");
      if (adminTab) {
        adminTab.focus();
        return;
      }
      window.location.href = adminLink.href;
    });
  }

  /* -----------------------------
     Typing Effect
     - Rotates through an array of roles and types/deletes text
     - Requires an element with id="typing-text"
     ----------------------------- */
  function initTypingEffect() {
    const el = $("#typing-text");
    if (!el) return;

    const roles = ["Engineer...", "Freelancer...", "YouTuber..."];
    let roleIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let timer = null;

    function step() {
      const current = roles[roleIndex];
      // update text
      el.textContent = isDeleting
        ? current.substring(0, Math.max(0, charIndex--))
        : current.substring(0, Math.min(current.length, charIndex++));

      // state transitions
      if (!isDeleting && charIndex === current.length) {
        isDeleting = true;
        timer = setTimeout(step, 1000); // pause before deleting
      } else if (isDeleting && charIndex < 0) {
        isDeleting = false;
        roleIndex = (roleIndex + 1) % roles.length;
        charIndex = 0;
        timer = setTimeout(step, 300);
      } else {
        timer = setTimeout(step, isDeleting ? 70 : 120);
      }
    }

    step();
  }

  /* -----------------------------
     Particles (background)
     - Uses particles.js (third party)
     - Element: <div id="particles-js"></div>
     - Include particles.js script in HTML before this script
     ----------------------------- */
  function initParticles() {
    if (!window.particlesJS || !$("#particles-js")) return;

    particlesJS("particles-js", {
      particles: {
        number: { value: 80, density: { enable: true, value_area: 800 } },
        color: { value: "#00ffcc" },
        shape: { type: "circle" },
        opacity: { value: 0.5, random: true },
        size: { value: 3, random: true },
        line_linked: {
          enable: true,
          distance: 150,
          color: "#00ffcc",
          opacity: 0.4,
          width: 1
        },
        move: { enable: true, speed: 3 }
      },
      interactivity: {
        detect_on: "canvas",
        events: {
          onhover: { enable: true, mode: "repulse" },
          onclick: { enable: true, mode: "push" }
        },
        modes: {
          repulse: { distance: 100 },
          push: { particles_nb: 4 }
        }
      },
      retina_detect: true
    });
  }

  /* -----------------------------
     About Section Data Loader
     - Loads about text + experience cards from backend
     - Uses fallback when backend is not reachable
     ----------------------------- */
  async function initAboutSection() {
    const taglineEl = $("#aboutTagline");
    const headlineEl = $("#aboutHeadline");
    const para1El = $("#aboutParagraph1");
    const para2El = $("#aboutParagraph2");
    const para3El = $("#aboutParagraph3");
    const summaryEl = $("#aboutExperienceSummary");
    const expListEl = $("#aboutExperienceList");

    if (!taglineEl || !headlineEl || !para1El || !summaryEl || !expListEl) return;

    const apiBaseCandidates = Array.from(new Set([
      typeof window.__API_BASE__ === "string" ? window.__API_BASE__ : "",
      "http://localhost:5001",
      "http://127.0.0.1:5001"
    ].filter(Boolean)));

    const fallbackAbout = {
      tagline: "Data Scientist | AI Enthusiast | Problem Solver",
      headline: "Building data-driven products with real business impact",
      paragraph_1: "Hi, I’m Chandan. I turn raw data into useful insights and practical solutions.",
      paragraph_2: "From analytics dashboards to AI workflows, I focus on clarity, performance, and measurable outcomes.",
      paragraph_3: "I enjoy solving real problems through technology and creating products people can actually use.",
      experience_summary: "1+ Years of Hands-on Experience"
    };

    const fallbackExperiences = [
      {
        year_label: "2025 - Present",
        company_name: "GT24 TECH / Freelance",
        job_role: "Data Analyst",
        position_title: "Founder & Builder",
        description: "Building analytics, AI, and admin-driven web products."
      },
      {
        year_label: "2024 - 2025",
        company_name: "Self Projects Lab",
        job_role: "Web Developer",
        position_title: "Frontend + Backend Developer",
        description: "Created modern UI with SQL-backed dynamic content."
      }
    ];

    function escapeHtml(value) {
      return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function normalizeAbout(value = {}) {
      return {
        tagline: value.tagline || fallbackAbout.tagline,
        headline: value.headline || fallbackAbout.headline,
        paragraph_1: value.paragraph_1 || fallbackAbout.paragraph_1,
        paragraph_2: value.paragraph_2 || fallbackAbout.paragraph_2,
        paragraph_3: value.paragraph_3 || fallbackAbout.paragraph_3,
        experience_summary: value.experience_summary || fallbackAbout.experience_summary
      };
    }

    function normalizeExperience(value = {}) {
      return {
        year_label: value.year_label || "",
        company_name: value.company_name || "",
        job_role: value.job_role || "",
        position_title: value.position_title || "",
        description: value.description || ""
      };
    }

    function renderAbout(aboutData, experiencesData) {
      taglineEl.textContent = aboutData.tagline;
      headlineEl.textContent = aboutData.headline;
      para1El.textContent = aboutData.paragraph_1;
      if (para2El) para2El.textContent = aboutData.paragraph_2 || "";
      if (para3El) para3El.textContent = aboutData.paragraph_3 || "";
      summaryEl.textContent = aboutData.experience_summary;

      const safeExperiences = Array.isArray(experiencesData) && experiencesData.length
        ? experiencesData
        : fallbackExperiences;

      expListEl.innerHTML = safeExperiences.map((item) => `
        <article class="about-v3-exp-card">
          <p class="about-v3-exp-year">${escapeHtml(item.year_label)}</p>
          <h5 class="about-v3-exp-role">${escapeHtml(item.position_title || item.job_role)}</h5>
          <p class="about-v3-exp-company">${escapeHtml(item.company_name)}</p>
          <p class="about-v3-exp-meta">${escapeHtml(item.job_role)}</p>
          ${item.description ? `<p class="about-v3-exp-desc">${escapeHtml(item.description)}</p>` : ""}
        </article>
      `).join("");
    }

    renderAbout(normalizeAbout(fallbackAbout), fallbackExperiences.map(normalizeExperience));

    for (const base of apiBaseCandidates) {
      try {
        const response = await fetch(`${base}/api/about`);
        if (!response.ok) continue;
        const data = await response.json();

        const aboutData = normalizeAbout(data?.about || {});
        const experiences = Array.isArray(data?.experiences)
          ? data.experiences.map(normalizeExperience)
          : [];

        renderAbout(aboutData, experiences);
        break;
      } catch (_error) {
        // Try next base
      }
    }
  }

  /* -----------------------------
     About Section Entrance Animation
     - Triggers on scroll when section becomes visible
     ----------------------------- */
  function initAboutAnimation() {
    const aboutSection = $(".about-v3");
    const aboutMedia = $(".about-v3-media");
    const aboutContent = $(".about-v3-content");
    if (!aboutSection || !aboutMedia || !aboutContent) return;

    aboutMedia.style.opacity = "0";
    aboutMedia.style.transform = "translateX(-48px)";
    aboutMedia.style.transition = "all 0.7s ease-out";

    aboutContent.style.opacity = "0";
    aboutContent.style.transform = "translateX(48px)";
    aboutContent.style.transition = "all 0.7s ease-out 0.2s";

    function animateIfVisible() {
      const top = aboutSection.getBoundingClientRect().top;
      if (top < window.innerHeight - 100) {
        aboutMedia.style.opacity = "1";
        aboutMedia.style.transform = "translateX(0)";
        aboutContent.style.opacity = "1";
        aboutContent.style.transform = "translateX(0)";
        window.removeEventListener("scroll", animateIfVisible);
      }
    }

    window.addEventListener("scroll", animateIfVisible);
    animateIfVisible();
  }

  /* -----------------------------
     Skills Progress Bars Animation
     - Elements with .progress and data-progress attribute
     ----------------------------- */
  function initProgressBars() {
    const bars = $$(".progress");
    if (!bars.length) return;

    function animate() {
      bars.forEach(bar => {
        const top = bar.getBoundingClientRect().top;
        if (top < window.innerHeight - 50) {
          const target = parseInt(bar.getAttribute("data-progress"), 10) || 0;
          bar.style.width = target + "%";
        }
      });
    }

    window.addEventListener("scroll", animate);
    animate();
  }

  /* -----------------------------
     Timeline Intersection Animation
     - Items with .timeline-item get .visible when in view
     ----------------------------- */
  function initTimelineObserver() {
    const items = $$(".timeline-item");
    if (!items.length) return;

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) entry.target.classList.add("visible");
        });
      },
      { threshold: 0.3 }
    );

    items.forEach(item => observer.observe(item));
  }

  /* --------------------------------------------------------------------------
   Testimonials Slider Function
   Kaam: Backend se reviews lana, slider dikhana aur naye reviews add karna.
   -------------------------------------------------------------------------- */
function initTestimonials() {
    // 1. DOM Elements ko select karna
    const slider = $("#testimonialSlider"); // Jahan cards dikhenge
    const nav = $("#testimonialNav");       // Dots (navigation) ke liye
    const reviewForm = $("#review-form");   // Input form
    const statusEl = $("#review-form-status"); // Success/Error message dikhane ke liye
    const isReviewListEnabled = Boolean(slider && nav); // Check ki slider HTML mein hai ya nahi

    if (!reviewForm) return;

    // 2. API Connection Settings
    // Backend localhost par chal raha hai
    const apiBaseCandidates = Array.from(new Set([
        typeof window.__API_BASE__ === "string" ? window.__API_BASE__ : "",
        "http://localhost:5001",
    ].filter(Boolean)));

    // 3. Fallback Data
    // Agar backend se data na mile, toh ye default reviews dikhayega
    const fallbackReviews = [   
        { name: "Rahul Sharma", role: "Project Manager", rating: 5, text: "Excellent skills!" },
        { name: "Ananya Verma", role: "Data Scientist", rating: 5, text: "Innovative models." },
        { name: "Amit Patel", role: "CTO", rating: 4, text: "Fantastic experience." }
    ];

    let reviews = fallbackReviews.slice(); // Reviews store karne ke liye array
    let index = 0;                         // Current dikhne wale review ka number
    let slideInterval = null;              // Auto-slide timing control karne ke liye
    let dotTargets = [];                   // Map shown dots to real review indices (max 3)

    // 4. Utility Functions
    // XSS attack se bachne ke liye HTML characters ko clean karna
    const escapeHtml = (value) =>
        String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // Rating number (5) ko stars (★★★★★) mein badalna
    const starString = (rating) => {
        const safeRating = Math.min(5, Math.max(1, Number(rating) || 5));
        return "★".repeat(safeRating) + "☆".repeat(5 - safeRating);
    };

    // Form ke niche success ya error message dikhana
    function showStatus(message, type = "") {
        if (!statusEl) return;
        statusEl.className = `review-form-status ${type}`.trim();
        statusEl.textContent = message;
    }

    // 5. Slider Logic
    // Auto-sliding rokna
    function stopAutoSlide() {
        if (slideInterval) { clearInterval(slideInterval); slideInterval = null; }
    }

    // Har 6 second mein agla review dikhana
    function startAutoSlide() {
        stopAutoSlide();
        if (reviews.length <= 1) return;
        slideInterval = setInterval(() => {
            index = (index + 1) % reviews.length;
            showTestimonial(index);
        }, 6000);
    }

    // CSS classes toggle karke card ko screen par "active" dikhana
    function showTestimonial(n) {
        if (!isReviewListEnabled) return;
        const cards = $$(".testimonial-card", slider);
      const dots = $$(".dot", nav);
      cards.forEach((card, i) => card.classList.toggle("active", i === n));

      // Determine which dot should be active for the current review index
      if (!dotTargets.length) {
        dots.forEach((dot, i) => dot.classList.toggle("active", i === n));
        return;
      }

      let activeDotIndex = 0;
      if (reviews.length <= 3) {
        activeDotIndex = n; // one-to-one mapping
      } else {
        if (n === 0) activeDotIndex = 0;
        else if (n === reviews.length - 1) activeDotIndex = dotTargets.length - 1;
        else activeDotIndex = 1; // all middle items map to center dot
      }

      dots.forEach((dot, i) => dot.classList.toggle("active", i === activeDotIndex));
    }

    // 6. UI Rendering (Sabse Important)
    // 'reviews' array ko HTML mein badal kar screen par render karna
    function renderReviews() {
        if (!isReviewListEnabled) return;
        if (!reviews.length) {
            slider.innerHTML = '<p>No reviews yet.</p>';
            return;
        }

        // Card ka HTML structure banana
        slider.innerHTML = reviews.map((review, i) => `
            <div class="testimonial-card ${i === index ? "active" : ""}">
                <p>"${escapeHtml(review.text)}"</p>
                <div class="testimonial-author">
                    <h4>${escapeHtml(review.name)} <span>(${escapeHtml(review.role)})</span></h4>
                    <div class="stars">${starString(review.rating)}</div>
                </div>
            </div>
        `).join("");

        // Build dot targets (limit to max 3 dots)
        if (reviews.length <= 3) {
          dotTargets = reviews.map((_, i) => i);
        } else {
          const mid = Math.floor((reviews.length - 1) / 2);
          dotTargets = [0, mid, reviews.length - 1];
        }

        // Render dots (each dot stores its real target index in data-target)
        nav.innerHTML = dotTargets.map((t, i) => `<span class="dot ${dotTargets[i] === index ? "active" : ""}" data-target="${t}" data-dot-index="${i}"></span>`).join("");

        // Dots par click karne ka event (map to real review index)
        $$(".dot", nav).forEach((dot) => {
          dot.addEventListener("click", () => {
            const target = Number(dot.dataset.target);
            if (!Number.isFinite(target)) return;
            index = target;
            showTestimonial(index);
            startAutoSlide();
          });
        });
        startAutoSlide();
    }

    // 7. API Handling
    // Backend se data mangne ya bhejne ka main function
    async function requestReviewApi(endpointPath, options = undefined) {
        for (const base of apiBaseCandidates) {
            try {
                const url = new URL(endpointPath, base).toString();
                return await fetch(url, options);
            } catch (error) { continue; }
        }
    }

    // Backend se reviews LOAD karna
    async function loadReviews() {
        if (!isReviewListEnabled) return;
        try {
            const res = await requestReviewApi("/api/reviews");
            const data = await res.json();
            
            // Check: Kya data array hai ya object?
            const fetched = Array.isArray(data) ? data : (data.reviews || []);
            if (fetched.length > 0) reviews = fetched;
            
            renderReviews(); // UI update karein
        } catch (error) {
            renderReviews(); // Error aane par fallback dikhayein
        }
    }

    // 8. Form Submission (Naya Review add karna)
    reviewForm.addEventListener("submit", async (e) => {
        e.preventDefault(); // Page refresh hone se rokna

        // Form values nikalna
        const name = $("#review-name").value.trim();
        const role = $("#review-role").value.trim();
        const rating = Number($("#review-rating").value);
        const text = $("#review-text").value.trim();

        try {
            showStatus("Submitting...", "");
            // Backend ko POST request bhejna
            const res = await requestReviewApi("/api/reviews", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, role, rating, text })
            });

            if (res.ok) {
                reviewForm.reset();
                showStatus("Success!", "success");
                index = 0; // Slider ko pehle card par set karein
                await loadReviews(); // Naya review dikhane ke liye firse fetch karein
            }
        } catch (error) {
            showStatus("Error submitting.", "error");
        }
    });

    // 9. Initial Load
    // Page load hote hi reviews render karna aur backend se fetch karna
    if (isReviewListEnabled) {
        renderReviews();
        loadReviews();
    }
}

  /* -----------------------------
     Blog Cards Fade-in (IntersectionObserver)
     ----------------------------- */
  function initBlogObserver(blogCards = $$(".blog-card")) {
    if (!blogCards.length) return;

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("fade-in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );

    blogCards.forEach(card => observer.observe(card));
  }

  /* -----------------------------
     Blog Section (DB Powered)
     - Admin panel se add kiye blog cards same UI me render honge
     ----------------------------- */
  async function initBlogsSection() {
    const blogGrid = $("#blogGrid");
    const newBlogsBtn = $("#newBlogsBtn");
    const moreBlogsBtn = $("#moreBlogsBtn");
    const blogSearchInput = $("#blogSearchInput");
    if (!blogGrid) return;

    const apiBaseCandidates = Array.from(new Set([
      typeof window.__API_BASE__ === "string" ? window.__API_BASE__ : "",
      "http://localhost:5001",
      "http://127.0.0.1:5001"
    ].filter(Boolean)));

    const fallbackBlogs = [
      {
        id: 3,
        title: "The Future of AI in India",
        summary: "A deep dive into how AI is transforming industries and creating opportunities in India.",
        image_url: "image/Portfolio UI 2.png",
        content: "AI adoption in India is growing rapidly across fintech, health-tech, education, and manufacturing."
      },
      {
        id: 2,
        title: "Top 5 Data Visualization Techniques",
        summary: "Explore creative and effective ways to visualize your data for maximum impact.",
        image_url: "image/Pawer BI.png",
        content: "Clear visual storytelling turns complex analysis into fast business decisions."
      },
      {
        id: 1,
        title: "Getting Started with Machine Learning",
        summary: "A beginner-friendly guide to understanding ML basics and practical applications.",
        image_url: "image/AI UI.png",
        content: "Machine Learning starts with good data, clean features, and practical model evaluation."
      }
    ];

    const escapeHtml = (value) =>
      String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");

    function normalizeBlog(row = {}) {
      return {
        id: Number(row.id || 0),
        slug: row.slug || "",
        createdAt: row.createdAt || row.created_at || "",
        title: row.title || "Untitled Blog",
        summary: row.summary || "",
        content: row.content || "",
        imageUrl: row.imageUrl || row.image_url || "",
        readMoreUrl: row.readMoreUrl || row.read_more_url || "",
        videoUrl: row.videoUrl || row.video_url || "",
        githubUrl: row.githubUrl || row.github_url || "",
        linkedinUrl: row.linkedinUrl || row.linkedin_url || "",
        extraUrl: row.extraUrl || row.extra_url || "",
        extraLabel: row.extraLabel || row.extra_label || ""
      };
    }

    function resolveImagePath(rawPath = "") {
      if (!rawPath) return "image/Portfolio UI.png";
      if (/^https?:\/\//i.test(rawPath)) return rawPath;
      if (rawPath.startsWith("/api/uploads/image/") || rawPath.startsWith("api/uploads/image/")) {
        const apiBase = apiBaseCandidates[0] || "http://localhost:5001";
        const normalizedPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
        return `${apiBase}${normalizedPath}`;
      }
      if (rawPath.startsWith("../")) return rawPath.replace(/^\.\.\//, "");
      if (rawPath.startsWith("./")) return rawPath.replace(/^\.\//, "");
      return rawPath;
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
      return `morebloge/blog-detail.html?${params.toString()}`;
    }

    function blogCardTemplate(blog) {
      const readMoreUrl = buildReadMoreUrl(blog);
      const actions = [
        linkButton(readMoreUrl, "Read More", "", false),
        linkButton(blog.githubUrl, "GitHub"),
        linkButton(blog.linkedinUrl, "LinkedIn"),
        linkButton(blog.videoUrl, "Video"),
        linkButton(blog.extraUrl, blog.extraLabel)
      ].filter(Boolean).join("");

      return `
        <article class="project-card blog-project-card">
          <img src="${escapeHtml(resolveImagePath(blog.imageUrl))}" alt="${escapeHtml(blog.title)}" class="project-screenshot blog-img" loading="lazy" />
          <div class="project-info blog-content">
            <h3>${escapeHtml(blog.title)}</h3>
            <p>${escapeHtml(blog.summary || "No summary available yet.")}</p>
            <div class="project-links">${actions || '<a href="#" class="btn">Read More</a>'}</div>
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
          if (Array.isArray(data)) return data.map(normalizeBlog);
        } catch (_error) {
          // try next base
        }
      }
      return [];
    }

    function toTimestamp(value) {
      const t = Date.parse(String(value || ""));
      return Number.isFinite(t) ? t : 0;
    }

    function sortNewest(blogs = []) {
      return blogs.slice().sort((a, b) => {
        const timeDiff = toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
        if (timeDiff !== 0) return timeDiff;
        return Number(b.id || 0) - Number(a.id || 0);
      });
    }

    function latestBlogs(blogs = [], limit = 3) {
      return sortNewest(blogs).slice(0, limit);
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

    function renderBlogs(cards = [], query = "") {
      const filteredCards = cards.filter((blog) => matchesBlogSearch(blog, query));

      if (!filteredCards.length) {
        blogGrid.innerHTML = '<p style="color:#ccc;text-align:center;">No blog found for this search.</p>';
        return;
      }

      blogGrid.innerHTML = filteredCards.map(blogCardTemplate).join("");
      initBlogObserver($$(".blog-card, .blog-project-card", blogGrid));
    }

    function renderNewBlogs(query = "") {
      renderBlogs(latestBlogs(allBlogs), query);
    }

    function renderAllBlogPreview(query = "") {
      renderBlogs(sortNewest(allBlogs), query);
    }

    let blogSearchTerm = "";

    if (blogSearchInput) {
      blogSearchInput.addEventListener("input", () => {
        blogSearchTerm = String(blogSearchInput.value || "").trim();
        const isNewMode = newBlogsBtn?.classList.contains("active");
        if (isNewMode) renderNewBlogs(blogSearchTerm);
        else renderAllBlogPreview(blogSearchTerm);
      });
    }

    function setBlogActionState(activeKey = "new") {
      if (newBlogsBtn) newBlogsBtn.classList.toggle("active", activeKey === "new");
      if (moreBlogsBtn) moreBlogsBtn.classList.toggle("active", activeKey === "more");
    }

    let allBlogs = fallbackBlogs.map(normalizeBlog);

    async function reloadBlogsFromApi() {
      const fetchedBlogs = await fetchBlogsFromApi();
      if (fetchedBlogs.length) {
        allBlogs = fetchedBlogs;
      }
      return allBlogs;
    }

    renderNewBlogs(blogSearchTerm);
    const firstFetch = await reloadBlogsFromApi();
    allBlogs = firstFetch;
    renderNewBlogs(blogSearchTerm);
    setBlogActionState("new");

    if (newBlogsBtn) {
      newBlogsBtn.addEventListener("click", async () => {
        setBlogActionState("new");
        const freshBlogs = await reloadBlogsFromApi();
        allBlogs = freshBlogs;
        renderNewBlogs(blogSearchTerm);
      });
    }

    if (moreBlogsBtn) {
      moreBlogsBtn.addEventListener("click", () => {
        setBlogActionState("more");
        renderAllBlogPreview(blogSearchTerm);
      });
    }
  }

  /* -----------------------------
     Contact Location + Map (DB powered)
     - Admin panel se location/map change hoga to yahan auto update hoga
     ----------------------------- */
function initContactLocationMap() {
  const locationEl = document.querySelector("#contactLocationText");
  const mapFrameEl = document.querySelector("#contactMapFrame");
  const openMapEl = document.querySelector("#contactMapOpenLink");
  if (!locationEl || !mapFrameEl) return;

  const defaultLocation = "Indore, India";
  const defaultEmbed = "https://www.google.com/maps?q=Indore%2C%20India&output=embed";
  const apiBaseCandidates = Array.from(new Set([
    typeof window.__API_BASE__ === "string" ? window.__API_BASE__ : "",
    "http://localhost:5001",
    "http://127.0.0.1:5001"
  ].filter(Boolean)));

  function cleanText(value = "", max = 160) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
  }

  function safeMapUrl(value = "") {
    const url = String(value || "").trim();
    if (!url) return "";
    const lower = url.toLowerCase();
    if (!lower.startsWith("http://") && !lower.startsWith("https://")) return "";
    if (lower.startsWith("javascript:") || lower.startsWith("data:")) return "";
    return url;
  }

  function embedFromLocation(locationText = "") {
    const query = cleanText(locationText, 220) || defaultLocation;
    return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
  }

  function mapOpenUrl(mapEmbedUrl = "", locationText = "") {
    try {
      const parsed = new URL(mapEmbedUrl);
      const q = parsed.searchParams.get("q");
      if (q) return `https://www.google.com/maps?q=${encodeURIComponent(q)}`;
    } catch (_err) {
      // fallback below
    }
    const query = cleanText(locationText, 220) || defaultLocation;
    return `https://www.google.com/maps?q=${encodeURIComponent(query)}`;
  }

  function applyContactSettings(settings = {}) {
    const locationText = cleanText(settings.location_text || settings.locationText, 160) || defaultLocation;
    const mapEmbedUrl = safeMapUrl(settings.map_embed_url || settings.mapEmbedUrl) || embedFromLocation(locationText);

    locationEl.innerHTML = '<i class="fas fa-map-marker-alt"></i> ';
    locationEl.append(document.createTextNode(locationText));

    mapFrameEl.src = mapEmbedUrl;
    const finalOpenUrl = mapOpenUrl(mapEmbedUrl, locationText);
    if (openMapEl) openMapEl.href = finalOpenUrl;
  }

  async function fetchContactSettings() {
    for (const base of apiBaseCandidates) {
      try {
        const res = await fetch(`${base}/api/contact-settings?t=${Date.now()}`, {
          cache: "no-store"
        });
        if (!res.ok) continue;
        const data = await res.json();
        return data?.settings || {};
      } catch (_error) {
        // try next base
      }
    }
    return {};
  }

  applyContactSettings({
    location_text: defaultLocation,
    map_embed_url: defaultEmbed
  });

  fetchContactSettings().then((settings) => {
    applyContactSettings(settings || {});
  });
}

  /* -----------------------------
     Contact Form Submission (AJAX)
     - Form id: #contact-form
     - Expects JSON response { success: bool, message: string }
     - Uses fetch to POST to your backend endpoint
     ----------------------------- */
 function initContactForm() {
  const contactForm = document.querySelector("#contact-form");
  if (!contactForm) return;

  contactForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.querySelector("#name").value.trim();
    const email = document.querySelector("#email").value.trim();
    const message = document.querySelector("#message").value.trim();

    if (!name || !email || !message) {
      alert("❌ Fill all fields");
      return;
    }

    try {
      const apiBase = window.__API_BASE__ || (window.location.protocol === "file:" ? "http://localhost:5001" : window.location.origin);
     const res = await fetch(`${apiBase}/api/contact`, {
  method: "POST",   // ✅ THIS WAS MISSING
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ name, email, message })
});

      const data = await res.json();

      if (data.success) {
        alert("✅ Message sent successfully!");
        contactForm.reset();
      } else {
        alert(`❌ ${data.error || "Failed"}`);
      }

    } catch (err) {
      console.error(err);
      alert("❌ Contact service unavailable");
    }
  });
}

  /* -----------------------------
     showAlert helper (same as your original)
     - Inserts an alert into #contact section (or top of body if not found)
     ----------------------------- */
  function showAlert(message, type = "info") {
    const existing = $(".alert");
    if (existing) existing.remove();

    const alert = document.createElement("div");
    alert.className = `alert alert-${type}`;
    alert.textContent = message;

    // Inline styles (you can move to CSS)
    alert.style.padding = "12px 20px";
    alert.style.borderRadius = "4px";
    alert.style.margin = "10px 0";
    alert.style.fontSize = "14px";
    alert.style.fontWeight = "500";

    if (type === "success") {
      alert.style.backgroundColor = "#d4edda";
      alert.style.color = "#155724";
      alert.style.border = "1px solid #c3e6cb";
    } else if (type === "error") {
      alert.style.backgroundColor = "#f8d7da";
      alert.style.color = "#721c24";
      alert.style.border = "1px solid #f5c6cb";
    } else {
      alert.style.backgroundColor = "#e2e3e5";
      alert.style.color = "#383d41";
      alert.style.border = "1px solid #d6d8db";
    }

    const contactSection = $("#contact") || document.body;
    contactSection.insertBefore(alert, contactSection.firstChild);

    setTimeout(() => {
      alert.style.transition = "opacity 0.5s";
      alert.style.opacity = "0";
      setTimeout(() => alert.remove(), 500);
    }, 5000);
  }

  /* -----------------------------
     Scroll to Top Button (Footer)
     - Element id: #scrollToTopBtn
     ----------------------------- */
  function initScrollToTop() {
    const btn = $("#scrollToTopBtn");
    if (!btn) return;

    window.addEventListener("scroll", () => {
      btn.style.display = window.scrollY > 200 ? "block" : "none";
    });

    btn.addEventListener("click", () =>
      window.scrollTo({ top: 0, behavior: "smooth" })
    );
  }

  /* -----------------------------
     3D Pointer Tilt Utility
     - Adds subtle 3D tilt on mousemove (and optional touch)
     ----------------------------- */
  function init3DTilt(selector = ".profile-wrap", options = {}) {
    const els = $$(selector);
    if (!els.length) return;

    const isTouchDevice = window.matchMedia && window.matchMedia("(hover: none), (pointer: coarse)").matches;
    const config = {
      desktopDepth: Number(options.desktopDepth ?? 18),
      touchDepth: Number(options.touchDepth ?? 10),
      desktopImgZ: Number(options.desktopImgZ ?? 28),
      touchImgZ: Number(options.touchImgZ ?? 12),
      enableTouch: options.enableTouch !== false
    };

    els.forEach(el => {
      const img = el.querySelector(".profile-image, .about-v3-image");
      const elementAllowTouch = String(el.getAttribute("data-tilt-touch") || "").toLowerCase() !== "off";
      const allowTouch = config.enableTouch && elementAllowTouch;
      const depth = isTouchDevice ? config.touchDepth : config.desktopDepth;
      const imgZ = isTouchDevice ? config.touchImgZ : config.desktopImgZ;
      let raf = null;

      function onMove(e) {
        const pointerX = e.touches ? e.touches[0].clientX : e.clientX;
        const pointerY = e.touches ? e.touches[0].clientY : e.clientY;
        const rect = el.getBoundingClientRect();
        const px = (pointerX - rect.left) / rect.width; // 0..1
        const py = (pointerY - rect.top) / rect.height; // 0..1
        const rx = (py - 0.5) * depth * -1;
        const ry = (px - 0.5) * depth;

        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.02)`;
          if (img) {
            img.style.transform = `translateZ(${imgZ}px) rotateX(${(rx/3).toFixed(2)}deg) rotateY(${(ry/3).toFixed(2)}deg) scale(1.02)`;
          }
        });
      }

      function onLeave() {
        cancelAnimationFrame(raf);
        el.style.transition = "transform 400ms ease";
        el.style.transform = "";
        if (img) {
          img.style.transition = "transform 400ms ease";
          img.style.transform = "";
        }
        setTimeout(() => {
          el.style.transition = "";
          if (img) img.style.transition = "";
        }, 420);
      }

      if (isTouchDevice) {
        if (!allowTouch) return;
        el.addEventListener("touchstart", onMove, { passive: true });
        el.addEventListener("touchmove", onMove, { passive: true });
        el.addEventListener("touchend", onLeave);
        el.addEventListener("touchcancel", onLeave);
      } else {
        el.addEventListener("mousemove", onMove);
        el.addEventListener("mouseleave", onLeave);
        el.addEventListener("mousedown", () => el.classList.add("is-grabbing"));
        window.addEventListener("mouseup", () => el.classList.remove("is-grabbing"));
      }
    });
  }

  /* -----------------------------
     Resume ATS Score Badge
     - Shows uploaded CV score on the About section
     ----------------------------- */
  async function initResumeAtsBadge() {
    const badge = $("#resumeAtsMini");
    const downloadBtn = $("#downloadCvBtn");
    if (!badge && !downloadBtn) return;

    const apiBaseCandidates = Array.from(new Set([
      typeof window.__API_BASE__ === "string" ? window.__API_BASE__ : "",
      "http://localhost:5001",
      "http://127.0.0.1:5001"
    ].filter(Boolean)));

    for (const base of apiBaseCandidates) {
      try {
        const response = await fetch(`${base}/api/resume?t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Resume API failed");
        const data = await response.json();
        const score = Number(data?.upload?.ats_score || 0);
        if (badge) {
          badge.innerText = data?.upload ? `ATS Score: ${score}/100` : "ATS Score: Upload CV";
          badge.classList.toggle("is-empty", !data?.upload);
        }

        if (downloadBtn) {
          downloadBtn.href = "resume/resume.html";
          downloadBtn.removeAttribute("download");
          downloadBtn.setAttribute("aria-label", "Open CV preview and ATS score page");
        }
        return;
      } catch (_error) {
        // Try next local backend URL.
      }
    }

    if (badge) {
      badge.innerText = "ATS Score: Offline";
      badge.classList.add("is-empty");
    }
  }

  /* -----------------------------
     Initialize everything after DOM content loaded
     ----------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    initMobileNavbar();
    initActiveNavbar();
    initHireModal();
    initAdminReturnUrl();
    initTypingEffect();
    initTsParticles();
    initAboutSection();
    initResumeAtsBadge();
    initAboutAnimation();
    initProgressBars();
    initProjectFilter();
    initTimelineObserver();
    initTestimonials();
    initBlogsSection();
    initContactLocationMap();
    initContactForm();
    initScrollToTop();
    init3DTilt(".profile-wrap"); // hero 3D card
    init3DTilt(".about-v3-image-wrap", {
      desktopDepth: 14,
      desktopImgZ: 20,
      enableTouch: false
    });
  });

})(); // end IIFE


// ================= ANALYTICS TRACKING =================
(() => {
  const apiBaseCandidates = Array.from(new Set([
    typeof window.__API_BASE__ === "string" ? window.__API_BASE__ : "",
    "http://localhost:5001",
    "http://127.0.0.1:5001"
  ].filter(Boolean)));

  const startedAt = Date.now();
  let tracked = false;

  function getApiUrl(pathValue = "/api/visit") {
    const base = apiBaseCandidates[0] || "http://localhost:5001";
    return `${base}${pathValue}`;
  }

  function postVisit() {
    fetch(getApiUrl("/api/visit"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: window.location.pathname })
    }).catch(() => {});
  }

  function flushTimeSpent() {
    if (tracked) return;
    tracked = true;

    const timeSpent = Math.max(0, Date.now() - startedAt);
    const payload = JSON.stringify({
      time: timeSpent,
      page: window.location.pathname
    });
    const targetUrl = getApiUrl("/api/visit-time");

    try {
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon && navigator.sendBeacon(targetUrl, blob)) {
        return;
      }
    } catch (_error) {
      // Fallback fetch below
    }

    fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true
    }).catch(() => {});
  }

  postVisit();
  window.addEventListener("pagehide", flushTimeSpent);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushTimeSpent();
    }
  });
})();


// ================= VISITOR COUNT (LOCALSTORAGE) =================
let visits = localStorage.getItem("visitCount");

if (!visits) visits = 0;

visits++;

localStorage.setItem("visitCount", visits);

// format number (1,000 style)
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

const visitorCountEl = document.getElementById("visitorCount");
if (visitorCountEl) {
  visitorCountEl.innerText = formatNumber(visits);
}

// Background anamation

function initTsParticles() {
  tsParticles.load("tsparticles", {
    particles: {
      number: { value: 80 },
      color: { value: "#14f1d9" },
      links: {
        enable: true,
        distance: 150,
        color: "#14f1d9",
        opacity: 0.3,
        width: 1
      },
      move: { enable: true, speed: 1.5 },
      size: { value: 2 },
      opacity: { value: 0.6 }
    },
    interactivity: {
      events: {
        onHover: {
          enable: true,
          mode: "grab"
        }
      },
      modes: {
        grab: {
          distance: 140,
          links: { opacity: 0.8 }
        }
      }
    }
  });
}

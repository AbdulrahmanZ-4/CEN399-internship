// The contact form posts to our own backend endpoint (see server.js),
// which validates the data and emails it via Gmail SMTP.
const CONTACT_ENDPOINT = "/api/contact";

// Safe localStorage helper to prevent SecurityError under file:/// protocol in some browsers
const safeStorage = {
  getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },
  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      // Ignore local storage security blocks
    }
  }
};

// Mobile menu toggle
const menuToggle = document.querySelector(".menu-toggle");
const navLinks = document.querySelector(".nav-links");

if (menuToggle && navLinks) {
  menuToggle.addEventListener("click", () => {
    navLinks.classList.toggle("show");
  });
}

// Language switch: English / Arabic
const languageBtn = document.getElementById("languageBtn");
const html = document.documentElement;
const body = document.body;

function applyLanguage(language) {
  const isArabic = language === "ar";

  html.lang = isArabic ? "ar" : "en";
  html.dir = isArabic ? "rtl" : "ltr";
  body.setAttribute("dir", isArabic ? "rtl" : "ltr");

  document.querySelectorAll("[data-en][data-ar]").forEach((element) => {
    element.textContent = isArabic ? element.dataset.ar : element.dataset.en;
  });

  if (languageBtn) {
    languageBtn.textContent = isArabic ? "English" : "عربي";
  }

  safeStorage.setItem("scopeLanguage", language);

  // Pages that build their own markup (the admin dashboard) cannot be
  // reached by the pass above, since their rows do not exist yet. They
  // listen for this and re-render.
  document.dispatchEvent(new CustomEvent("scope:language", { detail: language }));
}

const savedLanguage = safeStorage.getItem("scopeLanguage") || "en";
applyLanguage(savedLanguage);

if (languageBtn) {
  languageBtn.addEventListener("click", () => {
    const currentLanguage = safeStorage.getItem("scopeLanguage") || "en";
    applyLanguage(currentLanguage === "en" ? "ar" : "en");
  });
}

// Project filter
const filterButtons = document.querySelectorAll(".filter-btn");
const projectCards = document.querySelectorAll(".project-card");

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterButtons.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");

    const selectedFilter = button.dataset.filter;

    projectCards.forEach((card) => {
      const category = card.dataset.category;
      const shouldShow = selectedFilter === "all" || selectedFilter === category;
      card.classList.toggle("hidden", !shouldShow);
    });
  });
});

// Contact form AJAX submission
const contactForm = document.getElementById("contactForm");
const formMessage = document.getElementById("formMessage");

if (contactForm && formMessage) {
  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const language = safeStorage.getItem("scopeLanguage") || "en";

    const submitBtn = contactForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;

    // 1. Set loading / disabling states
    submitBtn.disabled = true;
    submitBtn.textContent = language === "ar" ? "جاري الإرسال..." : "Sending...";
    formMessage.className = "form-message";
    formMessage.style.display = "none";

    // 2. Extract form values
    const nameVal = document.getElementById("name").value;
    const emailVal = document.getElementById("email").value;
    const projectVal = document.getElementById("projectType").value;
    const messageVal = document.getElementById("message").value;
    const honeyVal = contactForm.querySelector('input[name="_honey"]').value;

    // 3. Build the JSON payload sent to our own backend.
    const payload = {
      name: nameVal,
      email: emailVal,
      project: projectVal,
      message: messageVal,
      _honey: honeyVal
    };

    // 4. Send to our /api/contact endpoint (server emails it via Gmail SMTP).
    fetch(CONTACT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
          const err = new Error(data.error || "Form submission failed.");
          err.fromServer = Boolean(data.error);
          throw err;
        }
        return data;
      })
      .then(() => {
        formMessage.textContent =
          language === "ar"
            ? "تم إرسال رسالتك بنجاح! شكراً لتواصلك معنا."
            : "Your message has been sent successfully! Thank you for contacting us.";
        formMessage.className = "form-message success";
        formMessage.style.display = "block";
        contactForm.reset();
      })
      .catch((error) => {
        console.error("Contact submission failed:", error);
        // Show the server's explanation when it sent one (e.g. "email service
        // is not configured"); fall back to a generic message otherwise.
        formMessage.textContent = error.fromServer
          ? error.message
          : language === "ar"
            ? "عذراً، حدث خطأ أثناء إرسال الرسالة. يرجى المحاولة مرة أخرى."
            : "Sorry, an error occurred while sending your message. Please try again.";
        formMessage.className = "form-message error";
        formMessage.style.display = "block";
      })
      .finally(() => {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      });
  });
}

// IntersectionObserver Scroll Animation Engine
document.addEventListener("DOMContentLoaded", () => {
  const animatedElements = document.querySelectorAll(".animate-on-scroll");

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("animated");
          observer.unobserve(entry.target); // Only animate once
        }
      });
    }, {
      threshold: 0.05, // triggers when 5% of the element is visible
      rootMargin: "0px 0px -40px 0px"
    });

    animatedElements.forEach(el => observer.observe(el));
  } else {
    // Fallback: immediately show all elements if IntersectionObserver is not supported
    animatedElements.forEach(el => el.classList.add("animated"));
  }
});

// --- PWA: inject manifest + register service worker (offline support) --------
(function () {
  try {
    if (!document.querySelector('link[rel="manifest"]')) {
      var link = document.createElement("link");
      link.rel = "manifest"; link.href = "manifest.webmanifest";
      document.head.appendChild(link);
    }
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("sw.js").catch(function () {});
      });
    }
  } catch (e) {}
})();

// --- Image lightbox (project gallery and any .lightbox-img) ------------------
(function () {
  var imgs = document.querySelectorAll(".project-card img, .lightbox-img");
  if (!imgs.length) return;
  var overlay = document.createElement("div");
  overlay.className = "lightbox-overlay";
  overlay.innerHTML = '<button class="lightbox-close" aria-label="Close">×</button><img alt="" />';
  document.body.appendChild(overlay);
  var big = overlay.querySelector("img");
  function openBox(src, alt) { big.src = src; big.alt = alt || ""; overlay.classList.add("open"); }
  function closeBox() { overlay.classList.remove("open"); big.src = ""; }
  imgs.forEach(function (im) {
    im.style.cursor = "zoom-in";
    im.addEventListener("click", function () { openBox(im.currentSrc || im.src, im.alt); });
  });
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay || e.target.classList.contains("lightbox-close")) closeBox();
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeBox(); });
})();

// --- Footer "Admin" link (staff → /admin.html) on every page -----------------
(function () {
  var footer = document.querySelector(".site-footer");
  if (!footer || document.querySelector(".footer-admin-link")) return;
  var cp = footer.querySelector(".copyright") || footer;
  var sep = document.createElement("span");
  sep.textContent = " · ";
  sep.style.opacity = "0.5";
  var a = document.createElement("a");
  a.href = "admin.html";
  a.className = "footer-admin-link";
  a.setAttribute("data-en", "Admin");
  a.setAttribute("data-ar", "الإدارة");
  a.textContent = "Admin";
  cp.appendChild(sep);
  cp.appendChild(a);
  // Follow the site language toggle if present.
  try {
    var lang = localStorage.getItem("scopeLanguage");
    if (lang === "ar") a.textContent = "الإدارة";
  } catch (e) {}
})();

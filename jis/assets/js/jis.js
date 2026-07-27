/* =========================================================================
   JIS OFFICE PARTNER — interactions
   Vanilla JS, léger, dépendances zéro. Respecte prefers-reduced-motion.
   ========================================================================= */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var doc = document;

  /* ----- Thème (dark / light) ----- */
  var root = doc.documentElement;
  function applyTheme(t) {
    root.setAttribute("data-theme", t);
    try { localStorage.setItem("jis-theme", t); } catch (e) {}
    var meta = doc.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", t === "dark" ? "#0E110F" : "#F6F2E9");
  }
  var toggle = doc.querySelector(".theme-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      applyTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark");
    });
  }
  // suit l'OS si l'utilisateur n'a jamais choisi
  try {
    if (!localStorage.getItem("jis-theme")) {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function (e) {
        if (!localStorage.getItem("jis-theme")) applyTheme(e.matches ? "dark" : "light");
      });
    }
  } catch (e) {}

  /* ----- Nav : état "collé" + menu mobile ----- */
  var nav = doc.querySelector(".nav");
  function onScroll() { if (nav) nav.classList.toggle("is-stuck", window.scrollY > 12); }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  var burger = doc.querySelector(".nav__burger");
  var menu = doc.querySelector(".mobile-menu");
  function closeMenu() {
    if (!menu) return;
    menu.classList.remove("is-open");
    if (burger) burger.setAttribute("aria-expanded", "false");
    doc.body.classList.remove("menu-open");
    doc.body.style.overflow = "";
  }
  if (burger && menu) {
    burger.addEventListener("click", function () {
      var open = menu.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      doc.body.classList.toggle("menu-open", open);
      doc.body.style.overflow = open ? "hidden" : "";
    });
    menu.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", closeMenu); });
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });
  }

  /* ----- Reveal au scroll ----- */
  var revs = [].slice.call(doc.querySelectorAll(".reveal"));
  if (reduce || !("IntersectionObserver" in window)) {
    revs.forEach(function (el) { el.classList.add("is-in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    revs.forEach(function (el) { io.observe(el); });
  }

  /* ----- Compteurs animés ----- */
  function animateCount(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    var suffix = el.getAttribute("data-suffix") || "";
    if (reduce || isNaN(target)) { el.textContent = (isNaN(target) ? el.textContent : target) + suffix; return; }
    var dur = 1400, start = null;
    function tick(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      var val = Math.round(target * eased);
      el.firstChild ? (el.childNodes[0].nodeValue = String(val)) : (el.textContent = String(val));
      el.setAttribute("data-live", val + suffix);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  var counters = [].slice.call(doc.querySelectorAll("[data-count]"));
  if (counters.length) {
    if (reduce || !("IntersectionObserver" in window)) {
      counters.forEach(animateCount);
    } else {
      var io2 = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { animateCount(en.target); io2.unobserve(en.target); }
        });
      }, { threshold: 0.4 });
      counters.forEach(function (el) { io2.observe(el); });
    }
  }

  /* ----- Parallaxe légère du grid hero ----- */
  var grid = doc.querySelector(".hero__grid");
  if (grid && !reduce) {
    var ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var y = window.scrollY;
        if (y < window.innerHeight) grid.style.transform = "translateY(" + (y * 0.14) + "px)";
        ticking = false;
      });
    }, { passive: true });
  }

  /* ----- FAQ : hauteur animée sur <details> ----- */
  doc.querySelectorAll("details.faq__item").forEach(function (d) {
    var body = d.querySelector(".faq__a");
    if (!body) return;
    var inner = body.firstElementChild;
    d.addEventListener("toggle", function () {
      if (reduce) return;
      if (d.open) {
        body.style.height = "0px";
        requestAnimationFrame(function () { body.style.height = inner.offsetHeight + "px"; });
        var done = function () { body.style.height = "auto"; body.removeEventListener("transitionend", done); };
        body.addEventListener("transitionend", done);
      }
    });
    // close animation
    var summary = d.querySelector("summary");
    if (summary) {
      summary.addEventListener("click", function (e) {
        if (reduce || !d.open) return;
        e.preventDefault();
        body.style.height = inner.offsetHeight + "px";
        requestAnimationFrame(function () { body.style.height = "0px"; });
        var done = function () { d.open = false; body.style.height = ""; body.removeEventListener("transitionend", done); };
        body.addEventListener("transitionend", done);
      });
    }
    if (!reduce) body.style.transition = "height .38s cubic-bezier(.2,.7,.2,1)";
  });

  /* ----- Année dans le footer ----- */
  var yr = doc.getElementById("year");
  if (yr) yr.textContent = new Date().getFullYear();
})();

// ===== Darb Al-Najah Main JavaScript =====

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNavbar();
  initMobileMenu();
  initParticles();
  initScrollAnimations();
  initSmoothScroll();
});

// ===== THEME TOGGLE =====
function initTheme() {
  var saved = localStorage.getItem('lbc_theme');
  if (saved === 'light') document.documentElement.classList.add('light');

  var btn = document.getElementById('themeToggle');
  if (!btn) return;
  btn.addEventListener('click', function() {
    document.documentElement.classList.toggle('light');
    localStorage.setItem('lbc_theme', document.documentElement.classList.contains('light') ? 'light' : 'dark');
  });
}

// ===== NAVBAR =====
function initNavbar() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;

  const container = navbar.querySelector('.container');

  // Move nav-cta outside nav-links into container
  const navCta = document.querySelector('.nav-links .nav-cta');
  if (navCta && container) {
    const li = navCta.closest('li') || navCta;
    li.style.listStyle = 'none';
    container.appendChild(li);
  }

  // Move theme-toggle to end of container (after nav-links, before mobile-toggle)
  const themeToggle = container.querySelector('.theme-toggle');
  if (themeToggle) {
    container.appendChild(themeToggle);
  }

  // Create sidebar overlay for mobile menu
  var existingOverlay = document.querySelector('.sidebar-overlay');
  if (!existingOverlay) {
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);
  }

  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
  });

  // Set active link
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath || (currentPath === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });
}

// ===== MOBILE MENU =====
  function initMobileMenu() {
  var toggle = document.querySelector('.mobile-toggle');
  var navLinks = document.querySelector('.nav-links');
  var overlay = document.querySelector('.sidebar-overlay');
  if (!toggle || !navLinks) return;

  // Clone toggle to remove old listeners
  var newToggle = toggle.cloneNode(true);
  toggle.parentNode.replaceChild(newToggle, toggle);
  toggle = newToggle;

  function openMenu() {
    toggle.classList.add('active');
    navLinks.classList.add('active');
    if (overlay) overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    toggle.classList.remove('active');
    navLinks.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  toggle.addEventListener('click', () => {
    if (navLinks.classList.contains('active')) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  if (overlay) overlay.addEventListener('click', closeMenu);

  // Remove old close button listeners by cloning, then re-attach
  navLinks.querySelectorAll('.sidebar-close-btn').forEach(btn => {
    var newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', closeMenu);
  });

  // Remove old link listeners by cloning, then re-attach
  navLinks.querySelectorAll('a').forEach(link => {
    var newLink = link.cloneNode(true);
    link.parentNode.replaceChild(newLink, link);
    newLink.addEventListener('click', function() { closeMenu(); });
  });
}

// ===== PARTICLES =====
function initParticles() {
  const container = document.querySelector('.bg-particles');
  if (!container) return;

  for (let i = 0; i < 30; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDuration = (5 + Math.random() * 10) + 's';
    particle.style.animationDelay = Math.random() * 8 + 's';
    particle.style.width = (2 + Math.random() * 4) + 'px';
    particle.style.height = particle.style.width;

    const colors = ['var(--accent)', 'var(--purple)', 'var(--magenta)'];
    particle.style.background = colors[Math.floor(Math.random() * colors.length)];

    container.appendChild(particle);
  }
}

// ===== SCROLL ANIMATIONS =====
function initScrollAnimations() {
  const elements = document.querySelectorAll('.fade-up');
  if (!elements.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  elements.forEach(el => observer.observe(el));
}

// ===== SMOOTH SCROLL =====
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

// ===== COUNTER ANIMATION =====
function animateCounters() {
  document.querySelectorAll('.counter').forEach(counter => {
    const target = parseInt(counter.getAttribute('data-target'));
    const duration = 2000;
    const start = performance.now();

    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      counter.textContent = Math.floor(target * eased).toLocaleString('ar-SA');

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        counter.textContent = target.toLocaleString('ar-SA');
      }
    }
    requestAnimationFrame(update);
  });
}

// Trigger counters when visible
const statsObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateCounters();
      statsObserver.disconnect();
    }
  });
}, { threshold: 0.5 });

const statsSection = document.querySelector('.hero-stats');
if (statsSection) statsObserver.observe(statsSection);

// ===== TYPING EFFECT =====
function typeWriter(element, text, speed = 50) {
  let i = 0;
  element.textContent = '';
  function type() {
    if (i < text.length) {
      element.textContent += text.charAt(i);
      i++;
      setTimeout(type, speed);
    }
  }
  type();
}

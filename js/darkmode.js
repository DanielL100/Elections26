// 1. שמירה והפעלת ערכת הנושא באופן מיידי כדי למנוע הבהוב במעבר דפים
(function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
})();

// 2. פונקציית החלפת מצב ירח/שמש
function toggleDarkMode() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';

  if (newTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('theme', 'light');
  }

  updateDarkModeUI();
}

// 3. עדכון האייקונים וקו ההפרדה ב-Navbar
function updateDarkModeUI() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  
  // Update icons on both desktop and mobile buttons
  const icons = document.querySelectorAll('#btn-darkmode-toggle i, #btn-darkmode-toggle-mobile i');
  icons.forEach(icon => {
    icon.className = isDark ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
  });

  const updateTimeEl = document.getElementById('updateTime');
  const dividerEl = document.getElementById('navbar-divider');

  if (dividerEl) {
    if (updateTimeEl && updateTimeEl.innerText.trim() !== '') {
      dividerEl.style.display = 'inline-block';
    } else {
      dividerEl.style.display = 'none';
    }
  }
}

document.addEventListener('DOMContentLoaded', updateDarkModeUI);

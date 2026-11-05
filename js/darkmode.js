// 1. שמירת מצב והחלה קודם טעינת העמוד (מונע הבהוב במעבר דפים)
(function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();

// 2. פונקציית העברת מצב ירח/שמש
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

// 3. עדכון האייקונים והתנהגות ה-Navbar בהתאם לעמוד
function updateDarkModeUI() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  
  // עדכון האייקון (סעיף 4)
  const iconEl = document.querySelector('#btn-darkmode-toggle i');
  if (iconEl) {
    iconEl.className = isDark ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
  }

  // טיפול בקו ההפרדה ובזמן עדכון (סעיפים 3 ו-5)
  const updateTimeEl = document.getElementById('updateTime');
  const dividerEl = document.getElementById('navbar-divider');

  if (updateTimeEl && updateTimeEl.innerText.trim() !== '') {
    // החזרת הסגנון הירוק המקורי של זמן הניטור
    updateTimeEl.classList.remove('small', 'text-muted');
    updateTimeEl.classList.add('lead', 'text-success');

    if (dividerEl) dividerEl.style.display = 'inline-block';
  } else {
    // אם אין זמן עדכון בעמוד הנוכחי - הסתרת קו ההפרדה
    if (dividerEl) dividerEl.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', updateDarkModeUI);

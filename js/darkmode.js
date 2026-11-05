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
  
  // עדכון האייקון (שמש במצב כהה, ירח במצב בהיר)
  const iconEl = document.querySelector('#btn-darkmode-toggle i');
  if (iconEl) {
    iconEl.className = isDark ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
  }

  // טיפול בקו ההפרדה ובזמן עדכון
  const updateTimeEl = document.getElementById('updateTime');
  const dividerEl = document.getElementById('navbar-divider');

  if (updateTimeEl && updateTimeEl.innerText.trim() !== '') {
    // בעמוד שבו יש זמן עדכון (כמו index.html) - מציגים את הקו הישר והטקסט הירוק
    if (dividerEl) dividerEl.style.display = 'inline-block';
  } else {
    // בעמודים שאין בהם זמן עדכון - משאירים רק את הכפתור ומסתירים את הקו
    if (dividerEl) dividerEl.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', updateDarkModeUI);

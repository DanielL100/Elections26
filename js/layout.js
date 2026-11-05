// shared-layout.js
const MasterLayout = {
    // 1. Render Dynamic Navigation Bar
    renderNavbar: function (activePage = '') {
        return `
        <nav class="navbar navbar-expand-lg navbar-dark bg-primary px-3">
            <!-- RIGHT SIDE: Brand Logo & Page Links -->
            <div class="d-flex align-items-center">
                <!-- Brand Logo -->
                <a class="navbar-brand me-3 mr-3" href="index.html">
                    <img src="logo_elections.png" width="30" height="30" class="d-inline-block align-top" alt="פאנל הבחירות">
                    פאנל הבחירות
                </a>

                <!-- Page Links (Folded on mobile) -->
                <div class="collapse navbar-collapse" id="navbarNavDropdown">
                    <ul class="navbar-nav">
                        <li class="nav-item">
                            <a class="nav-link" href="about.html">איך זה עובד?</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="stats.html">גרפים</a>
                        </li>
                    </ul>
                </div>
            </div>

            <!-- LEFT SIDE: Utility Controls (me-auto / mr-auto pushes to FAR LEFT in RTL) -->
            <div class="d-flex align-items-center me-auto mr-auto">
                <!-- Dark Mode Button (Far left icon) -->
                <button id="btn-darkmode-toggle" class="btn btn-outline-light border-0 py-1 px-2" onclick="toggleDarkMode()" aria-label="Toggle Dark Mode">
                    <i class="bi bi-moon-stars-fill"></i>
                </button>

                <!-- Divider & Update Time (PC Only: d-none d-lg-flex) -->
                <div class="d-none d-lg-flex align-items-center ms-2 ml-2">
                    <span id="navbar-divider" class="text-white-50 mx-2" style="display: inline-block;">|</span>
                    <span id="updateTime" class="navbar-text lead text-success mb-0"></span>
                </div>

                <!-- Mobile Hamburger Toggler (Placed to the right of Dark Mode on Mobile) -->
                <button class="navbar-toggler ms-2 ml-2" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNavDropdown" data-toggle="collapse" data-target="#navbarNavDropdown" aria-controls="navbarNavDropdown" aria-expanded="false" aria-label="Toggle navigation">
                    <span class="navbar-toggler-icon"></span>
                </button>
            </div>
        </nav>`;
    },

    // 2. Render Shared Footer
    renderFooter: function (isSticky = false) {
        return `
        <footer class="page-footer ${isSticky ? 'mt-auto' : ''}">
            <div class="footer-copyright text-center pb-3">© 2026 כל הזכויות שמורות | 
                <a href="terms.html">תנאי שימוש</a> | 
                האתר אינו קשור ל<a id="electionsUrl2" target="_blank">אתר ועדת הבחירות</a>
            </div>
        </footer>`;
    },

    // 3. Render Head Links and Scripts automatically
    initPage: function (config) {
        document.title = config.title || "פאנל בחירות";

        // Inject Navbar
        const headerContainer = document.getElementById('navbar-container');
        if (headerContainer) {
            headerContainer.innerHTML = this.renderNavbar(config.activePage);
        }

        // Inject Footer
        const footerContainer = document.getElementById('footer-container');
        if (footerContainer) {
            footerContainer.innerHTML = this.renderFooter(config.stickyFooter);
        }
    }
};

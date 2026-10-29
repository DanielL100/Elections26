// shared-layout.js
const MasterLayout = {
    // 1. Render Dynamic Navigation Bar
    renderNavbar: function (activePage = '') {
        return `
        <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
            <a class="navbar-brand" href="index.html">
                <img src="logo_elections.png" width="30" height="30" class="d-inline-block align-top" alt="">
                פאנל הבחירות
            </a>
            <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarNavDropdown" aria-controls="navbarNavDropdown" aria-expanded="false" aria-label="Toggle navigation">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNavDropdown">
                <ul class="navbar-nav">
                    <li class="nav-item ${activePage === 'about' ? 'active' : ''}">
                        <a class="nav-link" href="about.html">איך זה עובד?</a>
                    </li>
                    <li class="nav-item ${activePage === 'stats' ? 'active' : ''}">
                        <a class="nav-link" href="stats.html">גרפים</a>
                    </li>
                </ul>
            </div>
            <span class="navbar-text d-none d-lg-block">
                <p id="updateTime" class="lead"></p>
            </span>
        </nav>`;
    },

    // 2. Render Shared Footer
    renderFooter: function (isSticky = false) {
        return `
        <footer class="page-footer ${isSticky ? 'mt-auto' : ''}">
            <div class="footer-copyright text-center pb-3">© 2022 כל הזכויות שמורות | 
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

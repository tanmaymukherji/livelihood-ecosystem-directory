(function () {
  let observerStarted = false;

  function mountSharedShell() {
    if (!document.body || document.querySelector("[data-grameee-shell-mounted]")) {
      return;
    }

    const currentUrl = window.location.href;
    const shellSlot = document.getElementById("grameeeShellSlot");
    const mount = document.createElement("div");
    mount.className = "grameee-shell-mount";
    mount.setAttribute("data-grameee-shell-mounted", "true");
    mount.innerHTML = `
      <header class="grameee-shell-header">
        <a class="grameee-shell-brand" href="https://grameee.org/">
          <span>
            <strong>GramEEE</strong>
            <small>Gram Eco Entrepreneur Ecosystem</small>
          </span>
        </a>
        <nav class="grameee-shell-nav site-nav" aria-label="GramEEE navigation">
          <a href="https://grameee.org/#about">About</a>
          <a href="https://grameee.org/tools.html">Tools</a>
          <a class="auth-only-link" data-privilege="ecosystem" href="https://ecosystem.grameee.org" hidden>Eco System</a>
          <a class="auth-only-link" data-privilege="askGre" href="https://askgre.grameee.org" hidden>Ask GRE</a>
          <a class="auth-only-link" data-privilege="offerSolutions" href="https://solution.grameee.org" hidden>Offer Solutions</a>
          <a class="auth-only-link" data-privilege="askHelp" href="https://help.grameee.org" hidden>Ask Help</a>
          <a class="auth-only-link" data-privilege="needsMap" href="https://needs.grameee.org" hidden>Needs Map</a>
          <a data-auth-link href="https://grameee.org/login.html">Login</a>
        </nav>
      </header>
    `;

    const loginModal = document.createElement("div");
    loginModal.innerHTML = `
      <div class="download-modal" id="loginModal" hidden>
        <div class="download-modal-backdrop" data-close-login-modal></div>
        <div class="download-modal-dialog auth-dialog panel" role="dialog" aria-modal="true" aria-labelledby="loginModalTitle">
          <button class="modal-close" type="button" aria-label="Close login" data-close-login-modal>&times;</button>
          <p class="eyebrow">GramEEE Login</p>
          <h2 id="loginModalTitle">Access the GramEEE network</h2>
          <p class="download-intro">
            Log in with your username or email address to access the GramEEE page group and connected tools.
          </p>
          <form class="download-form" id="loginModalForm">
            <input id="loginId" name="loginId" type="text" placeholder="Username or email" required>
            <input id="loginPassword" name="loginPassword" type="password" placeholder="Password" required>
            <input id="loginSubmitMode" type="hidden" value="login">
            <div class="login-modal-actions">
              <button class="button primary" type="submit">Login</button>
            </div>
            <div class="modal-links">
              <a href="https://grameee.org/new-account.html">New Account</a>
              <a href="https://grameee.org/forgot-password.html">Forgot Password</a>
              <a href="https://grameee.org/change-password.html">Change Password</a>
            </div>
            <p class="download-status" id="loginModalStatus" aria-live="polite"></p>
          </form>
        </div>
      </div>
    `;

    if (shellSlot) {
      shellSlot.replaceChildren(mount);
    } else {
      document.body.prepend(mount);
    }

    if (!document.getElementById("loginModal")) {
      document.body.appendChild(loginModal.firstElementChild);
    }

    mount.querySelectorAll("a[href]").forEach((link) => {
      if (link.href === currentUrl) {
        link.setAttribute("aria-current", "page");
      }
    });

    document.dispatchEvent(new CustomEvent("grameee:shell-mounted"));
  }

  function ensureSharedShell() {
    mountSharedShell();
  }

  function startSharedShellObserver() {
    if (observerStarted || !document.body || typeof MutationObserver === "undefined") {
      return;
    }

    observerStarted = true;
    const observer = new MutationObserver(() => {
      if (!document.querySelector("[data-grameee-shell-mounted]")) {
        mountSharedShell();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === "loading" || !document.body) {
    document.addEventListener("DOMContentLoaded", () => {
      ensureSharedShell();
      startSharedShellObserver();
      window.setTimeout(ensureSharedShell, 100);
      window.setTimeout(ensureSharedShell, 500);
      window.setTimeout(ensureSharedShell, 1500);
    }, { once: true });
  } else {
    ensureSharedShell();
    startSharedShellObserver();
    window.setTimeout(ensureSharedShell, 100);
    window.setTimeout(ensureSharedShell, 500);
    window.setTimeout(ensureSharedShell, 1500);
  }
})();

const grameeeSupabaseConfig = window.grameeeSupabase || {};
const grameeeSupabaseClient = grameeeSupabaseConfig.createClient ? grameeeSupabaseConfig.createClient() : null;

const AUTH_API_URL = grameeeSupabaseConfig.url
  ? `${grameeeSupabaseConfig.url}/functions/v1/grameee-auth`
  : "";
const AUTH_ANON_KEY = grameeeSupabaseConfig.anonKey || "";
const USER_SESSION_KEY = "grameee-user-session";
const ACCESS_TOKEN_COOKIE = "grameee_access_token";
const REFRESH_TOKEN_COOKIE = "grameee_refresh_token";
const SESSION_SUMMARY_COOKIE = "grameee_user_summary";
const SESSION_RETURN_TO_KEY = "grameee-return-to";
const SESSION_COOKIE_DOMAIN = window.location.hostname.endsWith(".grameee.org")
  ? ".grameee.org"
  : window.location.hostname === "grameee.org"
    ? ".grameee.org"
    : "";
const GRAMEEE_APP_BASE = "https://grameee.org";

function appUrl(path) {
  const cleanPath = String(path || "").replace(/^\//, "");
  return `${GRAMEEE_APP_BASE}/${cleanPath}`;
}

function authTrim(value) {
  return (value || "").trim();
}

function authEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildCookieOptions(maxAgeSeconds) {
  const options = [
    "path=/",
    "SameSite=Lax"
  ];

  if (window.location.protocol === "https:") {
    options.push("Secure");
  }

  if (SESSION_COOKIE_DOMAIN) {
    options.push(`domain=${SESSION_COOKIE_DOMAIN}`);
  }

  if (typeof maxAgeSeconds === "number") {
    options.push(`max-age=${maxAgeSeconds}`);
  }

  return options.join("; ");
}

function setCookie(name, value, maxAgeSeconds) {
  document.cookie = `${name}=${encodeURIComponent(value)}; ${buildCookieOptions(maxAgeSeconds)}`;
}

function getCookie(name) {
  const parts = document.cookie ? document.cookie.split("; ") : [];
  const prefix = `${name}=`;

  for (const part of parts) {
    if (part.indexOf(prefix) === 0) {
      return decodeURIComponent(part.slice(prefix.length));
    }
  }

  return "";
}

function deleteCookie(name) {
  document.cookie = `${name}=; ${buildCookieOptions(0)}`;
}

function saveStoredSummary(summary) {
  if (!summary) {
    window.localStorage.removeItem(USER_SESSION_KEY);
    deleteCookie(SESSION_SUMMARY_COOKIE);
    return;
  }

  const serialized = JSON.stringify(summary);
  window.localStorage.setItem(USER_SESSION_KEY, serialized);
  setCookie(SESSION_SUMMARY_COOKIE, serialized, 60 * 60 * 24 * 14);
}

function readStoredSummary() {
  const fromStorage = window.localStorage.getItem(USER_SESSION_KEY);

  if (fromStorage) {
    try {
      return JSON.parse(fromStorage);
    } catch {
      window.localStorage.removeItem(USER_SESSION_KEY);
    }
  }

  const fromCookie = getCookie(SESSION_SUMMARY_COOKIE);

  if (!fromCookie) {
    return null;
  }

  try {
    const parsed = JSON.parse(fromCookie);
    window.localStorage.setItem(USER_SESSION_KEY, JSON.stringify(parsed));
    return parsed;
  } catch {
    deleteCookie(SESSION_SUMMARY_COOKIE);
    return null;
  }
}

function storeSupabaseTokens(session) {
  if (!session?.access_token || !session?.refresh_token) {
    return;
  }

  setCookie(ACCESS_TOKEN_COOKIE, session.access_token, 60 * 60 * 24 * 14);
  setCookie(REFRESH_TOKEN_COOKIE, session.refresh_token, 60 * 60 * 24 * 14);
}

function clearStoredSession() {
  saveStoredSummary(null);
  deleteCookie(ACCESS_TOKEN_COOKIE);
  deleteCookie(REFRESH_TOKEN_COOKIE);
}

function hasSharedSessionCookies() {
  return Boolean(getCookie(ACCESS_TOKEN_COOKIE) && getCookie(REFRESH_TOKEN_COOKIE));
}

async function getAccessToken() {
  if (!grameeeSupabaseClient) {
    return getCookie(ACCESS_TOKEN_COOKIE);
  }

  if (!hasSharedSessionCookies()) {
    clearStoredSession();
    await grameeeSupabaseClient.auth.signOut().catch(() => null);
    return "";
  }

  const sessionData = await grameeeSupabaseClient.auth.getSession().catch(() => null);
  const session = sessionData?.data?.session || null;

  if (session?.access_token) {
    storeSupabaseTokens(session);
    return session.access_token;
  }

  const accessToken = getCookie(ACCESS_TOKEN_COOKIE);
  const refreshToken = getCookie(REFRESH_TOKEN_COOKIE);

  if (!accessToken || !refreshToken) {
    return "";
  }

  const restored = await grameeeSupabaseClient.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  }).catch(() => null);

  const restoredToken = restored?.data?.session?.access_token || "";

  if (restored?.data?.session?.access_token) {
    storeSupabaseTokens(restored.data.session);
  }

  return restoredToken;
}

function passwordIsStrong(password) {
  return password.length >= 8 && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

async function authApiRequest(action, payload, accessToken) {
  let response;

  try {
    response = await fetch(AUTH_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: AUTH_ANON_KEY,
        Authorization: accessToken ? `Bearer ${accessToken}` : `Bearer ${AUTH_ANON_KEY}`
      },
      body: JSON.stringify({
        action,
        ...(payload || {})
      })
    });
  } catch {
    throw new Error("GramEEE login service could not be reached right now.");
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || "GramEEE login request failed.");
  }

  return data;
}

async function listOrganizations() {
  const data = await authApiRequest("listOrganizations");
  return Array.isArray(data?.items) ? data.items : [];
}

async function checkUsernameAvailability(username, excludeUserId) {
  const data = await authApiRequest("checkUsername", {
    username,
    excludeUserId: excludeUserId || ""
  });
  return Boolean(data?.available);
}

async function sendEmailCode(email, purpose) {
  const data = await authApiRequest("sendEmailCode", {
    email,
    purpose
  });
  return String(data?.token || "");
}

async function resolveLoginId(loginId) {
  return authApiRequest("resolveUsername", {
    loginId
  });
}

async function syncAdminBridge(password) {
  return authApiRequest("adminBridgeSync", {
    password
  });
}

async function loginUser(loginId, password) {
  if (!grameeeSupabaseClient) {
    throw new Error("Supabase is not configured for login.");
  }

  const normalizedLoginId = authTrim(loginId).toLowerCase();
  const resolved = normalizedLoginId === "admin"
    ? await syncAdminBridge(password)
    : await resolveLoginId(loginId);
  const resolvedEmail = authTrim(resolved?.email);

  if (!resolvedEmail) {
    throw new Error("No account was found for that login ID.");
  }

  const { data, error } = await grameeeSupabaseClient.auth.signInWithPassword({
    email: resolvedEmail,
    password
  });

  if (error || !data?.session) {
    throw new Error(error?.message || "Login failed.");
  }

  storeSupabaseTokens(data.session);
  const profile = await fetchProfile(data.session.access_token);
  saveStoredSummary(profile);
  return profile;
}

async function logoutUser() {
  if (grameeeSupabaseClient) {
    await grameeeSupabaseClient.auth.signOut().catch(() => null);
  }

  clearStoredSession();
  return null;
}

async function fetchProfile(accessToken) {
  if (!accessToken) {
    throw new Error("User session is missing.");
  }

  const data = await authApiRequest("getProfile", {}, accessToken);
  return data?.user || null;
}

async function hydrateAuthSession() {
  if (!grameeeSupabaseClient) {
    return readStoredSummary();
  }

  if (!hasSharedSessionCookies()) {
    clearStoredSession();
    await grameeeSupabaseClient.auth.signOut().catch(() => null);
    return null;
  }

  let sessionData = await grameeeSupabaseClient.auth.getSession();
  let session = sessionData?.data?.session || null;

  if (!session) {
    const accessToken = getCookie(ACCESS_TOKEN_COOKIE);
    const refreshToken = getCookie(REFRESH_TOKEN_COOKIE);

    if (accessToken && refreshToken) {
      const restored = await grameeeSupabaseClient.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      }).catch(() => null);
      session = restored?.data?.session || null;
    }
  }

  if (!session?.access_token) {
    clearStoredSession();
    return null;
  }

  storeSupabaseTokens(session);

  try {
    const profile = await fetchProfile(session.access_token);
    saveStoredSummary(profile);
    return profile;
  } catch {
    clearStoredSession();
    await grameeeSupabaseClient.auth.signOut().catch(() => null);
    return null;
  }
}

function getStoredSummary() {
  return readStoredSummary();
}

function hasAdminSession() {
  return Boolean(window.sessionStorage.getItem("grameee-admin-session"));
}

function getUserDisplayName(userSummary) {
  return authTrim(userSummary?.username) || authTrim(userSummary?.fullName) || "Account";
}

function notifyAuthStateChanged(userSummary) {
  document.dispatchEvent(new CustomEvent("grameee:auth-updated", {
    detail: {
      user: userSummary || null
    }
  }));
}

function getPageMenuConfig() {
  const config = window.grameeePageMenuConfig;
  return config && typeof config === "object" ? config : {};
}

function shouldShowPageMenuItem(item, userSummary, isAdmin) {
  if (!item || typeof item !== "object") {
    return false;
  }

  if (item.requiresAdmin && !isAdmin) {
    return false;
  }

  if (item.requiresLogin && !userSummary) {
    return false;
  }

  const requiredRole = authTrim(item.requiredRole || "");
  if (requiredRole && authTrim(userSummary?.role).toLowerCase() !== requiredRole.toLowerCase()) {
    return false;
  }

  return true;
}

function renderPageMenuItems(menu, userSummary) {
  const container = menu.querySelector(".auth-user-page-actions");
  if (!container) {
    return;
  }

  container.innerHTML = "";
  const pageConfig = getPageMenuConfig();
  const pageItems = Array.isArray(pageConfig.menuItems) ? pageConfig.menuItems : [];
  const isAdmin = authTrim(userSummary?.role).toLowerCase() === "admin";

  pageItems.forEach((item) => {
    if (!shouldShowPageMenuItem(item, userSummary, isAdmin)) {
      return;
    }

    if (item.href) {
      const link = document.createElement("a");
      link.className = "auth-user-action auth-user-page-action";
      link.href = item.href;
      link.textContent = authTrim(item.label) || "Open";
      if (item.sameWindow === true) {
        link.target = "_self";
      }
      container.appendChild(link);
      return;
    }

    if (typeof item.onClick === "function") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "auth-user-action auth-user-page-action";
      button.textContent = authTrim(item.label) || "Open";
      button.addEventListener("click", () => item.onClick(userSummary));
      container.appendChild(button);
    }
  });
}

function buildAuthMenu(link) {
  const menu = document.createElement("details");
  menu.className = "auth-user-menu";
  menu.hidden = true;
  menu.innerHTML = `
    <summary class="auth-user-trigger" role="button" aria-label="User menu">
      <span class="auth-user-name">Account</span>
      <span class="auth-user-caret" aria-hidden="true">▾</span>
    </summary>
    <div class="auth-user-dropdown">
      <a class="auth-user-action auth-user-admin-workspace-link" href="${appUrl("admin-tools.html")}" hidden>GramEEE Admin</a>
      <a class="auth-user-action auth-user-admin-link" href="${appUrl("registered-users.html")}" hidden>View Registered Users</a>
      <div class="auth-user-page-actions"></div>
      <a class="auth-user-action" href="${appUrl("change-password.html")}">Change Password</a>
      <a class="auth-user-action" href="${appUrl("account.html")}">Update User Details</a>
      <button class="auth-user-action auth-user-logout" type="button">Logout</button>
    </div>
  `;

  const logoutButton = menu.querySelector(".auth-user-logout");
  logoutButton?.addEventListener("click", async () => {
    await logoutUser();
    updateNavForUser(null);
    notifyAuthStateChanged(null);
    window.location.reload();
  });

  document.addEventListener("click", (event) => {
    if (!menu.hidden && menu.open && !menu.contains(event.target)) {
      menu.open = false;
    }
  });

  link.insertAdjacentElement("afterend", menu);
  return menu;
}

function ensureAuthMenu(link) {
  const existingMenu = link.parentElement?.querySelector(".auth-user-menu");
  return existingMenu || buildAuthMenu(link);
}

function updateNavForUser(userSummary) {
  const authOnlyLinks = document.querySelectorAll(".auth-only-link");
  const adminOnlyLinks = document.querySelectorAll(".admin-only-link");
  const authLinks = document.querySelectorAll("[data-auth-link]");
  const isLoggedIn = Boolean(userSummary);
  const privileges = userSummary?.privileges || {};
  const isAdmin = userSummary?.role === "admin";

  authOnlyLinks.forEach((link) => {
    const privilegeName = link.dataset.privilege || "";
    const allowed = !privilegeName || privileges[privilegeName] !== false;
    link.hidden = !(isLoggedIn && allowed);
  });

  adminOnlyLinks.forEach((link) => {
    link.hidden = !isAdmin;
  });

  authLinks.forEach((link) => {
    const authMenu = ensureAuthMenu(link);
    const adminLink = authMenu.querySelector(".auth-user-admin-link");
    const adminWorkspaceLink = authMenu.querySelector(".auth-user-admin-workspace-link");
    renderPageMenuItems(authMenu, userSummary);
    if (isLoggedIn) {
      const nameNode = authMenu.querySelector(".auth-user-name");
      if (nameNode) {
        nameNode.textContent = getUserDisplayName(userSummary);
      }
      if (adminLink) {
        adminLink.hidden = !isAdmin;
      }
      if (adminWorkspaceLink) {
        adminWorkspaceLink.hidden = !isAdmin;
      }
      authMenu.hidden = false;
      link.hidden = true;
      link.textContent = "Login";
      link.setAttribute("href", appUrl("login.html"));
    } else {
      if (adminLink) {
        adminLink.hidden = true;
      }
      if (adminWorkspaceLink) {
        adminWorkspaceLink.hidden = true;
      }
      authMenu.hidden = true;
      authMenu.open = false;
      link.hidden = false;
      link.textContent = "Login";
      link.setAttribute("href", appUrl("login.html"));
    }
  });
}

function openLoginModal(mode) {
  const modal = document.getElementById("loginModal");

  if (!modal) {
    window.location.href = appUrl("login.html");
    return;
  }

  const loginIdInput = document.getElementById("loginId");
  const passwordInput = document.getElementById("loginPassword");
  const status = document.getElementById("loginModalStatus");
  const primaryModeInput = document.getElementById("loginSubmitMode");

  modal.hidden = false;
  document.body.style.overflow = "hidden";

  if (status) {
    status.textContent = "";
    status.classList.remove("error");
  }

  if (primaryModeInput) {
    primaryModeInput.value = mode || "login";
  }

  if (loginIdInput && !loginIdInput.value) {
    loginIdInput.focus();
  } else if (passwordInput) {
    passwordInput.focus();
  }
}

function closeLoginModal() {
  const modal = document.getElementById("loginModal");

  if (!modal) {
    return;
  }

  modal.hidden = true;
  document.body.style.overflow = "";
}

function setLoginStatus(message, isError) {
  const status = document.getElementById("loginModalStatus");

  if (!status) {
    return;
  }

  status.textContent = message;
  status.classList.toggle("error", Boolean(isError));
}

async function processLoginForm(submitMode) {
  const loginIdInput = document.getElementById("loginId");
  const passwordInput = document.getElementById("loginPassword");
  const loginId = authTrim(loginIdInput?.value);
  const password = authTrim(passwordInput?.value);

  if (!loginId || !password) {
    setLoginStatus("Please enter both username and password.", true);
    return;
  }

  setLoginStatus("Validating your GramEEE login...");

  const user = await loginUser(loginId, password);
  updateNavForUser(user);
  closeLoginModal();

  const returnTo = window.sessionStorage.getItem(SESSION_RETURN_TO_KEY);
  window.sessionStorage.removeItem(SESSION_RETURN_TO_KEY);

  if (returnTo) {
    window.location.href = returnTo;
    return;
  }

  if (window.location.pathname.toLowerCase().endsWith("/login.html") || window.location.pathname.toLowerCase().endsWith("\\login.html")) {
    window.location.href = appUrl("index.html");
    return;
  }

  window.location.reload();
}

function attachLoginModalBehavior() {
  const modal = document.getElementById("loginModal");
  const form = document.getElementById("loginModalForm");

  if (!modal || !form) {
    return;
  }

  modal.querySelectorAll("[data-close-login-modal]").forEach((element) => {
    element.addEventListener("click", closeLoginModal);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeLoginModal();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const modeInput = document.getElementById("loginSubmitMode");

    try {
      await processLoginForm(modeInput?.value || "login");
    } catch (error) {
      setLoginStatus(error instanceof Error ? error.message : "Login failed.", true);
    }
  });
}

function attachAuthLinkBehavior() {
  document.querySelectorAll("[data-auth-link]").forEach((link) => {
    if (link.dataset.authBound === "true") {
      return;
    }
    link.dataset.authBound = "true";
    link.addEventListener("click", async (event) => {
      event.preventDefault();
      window.sessionStorage.setItem(SESSION_RETURN_TO_KEY, window.location.href);
      openLoginModal("login");
    });
  });
}

let authUiInitialized = false;

async function refreshAuthUi() {
  const user = await hydrateAuthSession();
  updateNavForUser(user);
  notifyAuthStateChanged(user);
  return user;
}

async function initializeAuthUi() {
  if (!authUiInitialized) {
    attachLoginModalBehavior();
    authUiInitialized = true;
  }

  attachAuthLinkBehavior();
  const user = await refreshAuthUi();

  if (document.body.dataset.authPage === "login" && !user) {
    openLoginModal("login");
  }
}

function registerAuthUiRefreshEvents() {
  let refreshInFlight = null;

  const guardedRefresh = () => {
    if (refreshInFlight) {
      return refreshInFlight;
    }

    refreshInFlight = refreshAuthUi().finally(() => {
      refreshInFlight = null;
    });

    return refreshInFlight;
  };

  window.addEventListener("focus", guardedRefresh);
  window.addEventListener("pageshow", guardedRefresh);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      guardedRefresh();
    }
  });
  document.addEventListener("grameee:shell-mounted", () => {
    initializeAuthUi().catch(() => null);
  });
}

async function requireLoggedInUser() {
  let user = getStoredSummary();

  if (!user) {
    user = await hydrateAuthSession();
  }

  if (!user) {
    window.sessionStorage.setItem(SESSION_RETURN_TO_KEY, window.location.href);
    window.location.href = appUrl("login.html");
    throw new Error("Login required.");
  }

  return user;
}

window.grameeeAuth = {
  apiRequest: authApiRequest,
  listOrganizations,
  checkUsernameAvailability,
  sendEmailCode,
  fetchProfile,
  loginUser,
  logoutUser,
  passwordIsStrong,
  getStoredSummary,
  requireLoggedInUser,
  getAccessToken,
  updateNavForUser,
  hydrateAuthSession,
  saveStoredSummary,
  authEscape
};

if (grameeeSupabaseClient?.auth?.onAuthStateChange) {
  grameeeSupabaseClient.auth.onAuthStateChange(async (_event, session) => {
    if (session?.access_token) {
      storeSupabaseTokens(session);
      const user = await fetchProfile(session.access_token).catch(() => null);
      saveStoredSummary(user);
      updateNavForUser(user);
      notifyAuthStateChanged(user);
      return;
    }

    clearStoredSession();
    updateNavForUser(null);
    notifyAuthStateChanged(null);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    registerAuthUiRefreshEvents();
    initializeAuthUi().catch(() => null);
  }, { once: true });
} else {
  registerAuthUiRefreshEvents();
  initializeAuthUi().catch(() => null);
}

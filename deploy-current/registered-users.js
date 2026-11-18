const usersList = document.getElementById("registeredUsersList");
const usersStatus = document.getElementById("registeredUsersStatus");
const refreshUsersButton = document.getElementById("refreshUsersButton");
const usersSearchInput = document.getElementById("registeredUsersSearch");
const userActionModal = document.getElementById("userActionModal");
const userActionModalTitle = document.getElementById("userActionModalTitle");
const userActionModalBody = document.getElementById("userActionModalBody");
const userActionModalActions = document.getElementById("userActionModalActions");
const userActionModalEyebrow = document.getElementById("userActionModalEyebrow");

let adminUserSummary = null;
let allUsers = [];

function setUsersStatus(message, isError = false) {
  usersStatus.textContent = message;
  usersStatus.classList.toggle("error", Boolean(isError));
}

function escapeUserHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeSearchValue(value) {
  return String(value || "").trim().toLowerCase();
}

function closeUserActionModal() {
  if (!userActionModal) {
    return;
  }

  userActionModal.hidden = true;
  document.body.style.overflow = "";
}

function openUserActionModal({
  eyebrow = "Registered Users",
  title = "Action",
  body = "",
  actions = []
}) {
  if (!userActionModal || !userActionModalTitle || !userActionModalBody || !userActionModalActions) {
    return;
  }

  if (userActionModalEyebrow) {
    userActionModalEyebrow.textContent = eyebrow;
  }

  userActionModalTitle.textContent = title;
  userActionModalBody.textContent = body;
  userActionModalActions.innerHTML = "";

  const resolvedActions = actions.length ? actions : [
    { label: "Close", type: "secondary", onClick: closeUserActionModal }
  ];

  resolvedActions.forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `button ${action.type || "secondary"}`;
    button.textContent = action.label || "Close";
    button.disabled = Boolean(action.disabled);
    button.addEventListener("click", async () => {
      if (typeof action.onClick === "function") {
        await action.onClick();
      } else {
        closeUserActionModal();
      }
    });
    userActionModalActions.appendChild(button);
  });

  userActionModal.hidden = false;
  document.body.style.overflow = "hidden";
}

async function getAccessToken() {
  const sessionData = await window.grameeeSupabase.createClient().auth.getSession();
  return sessionData?.data?.session?.access_token || "";
}

function renderUsers(items, emptyMessage = "No registered users were found.") {
  usersList.innerHTML = "";

  if (!items.length) {
    usersList.innerHTML = `<div class="tool-card"><p>${escapeUserHtml(emptyMessage)}</p></div>`;
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "tool-card registered-user-card";
    card.innerHTML = `
      <div class="tool-card-header">
        <h3>${escapeUserHtml(item.fullName || item.username || item.email)}</h3>
        <div class="tool-meta">
          <span>${escapeUserHtml(item.role || "user")}</span>
          <span>${escapeUserHtml(item.username || "no username")}</span>
        </div>
      </div>
      <form class="manage-form registered-user-form" data-user-id="${escapeUserHtml(item.id)}">
        <div class="form-grid-two">
          <input name="fullName" type="text" value="${escapeUserHtml(item.fullName || "")}" placeholder="Full Name" required>
          <input name="organization" type="text" value="${escapeUserHtml(item.organization || "")}" placeholder="Organisation" required>
        </div>
        <input name="organizationLink" type="url" value="${escapeUserHtml(item.organizationLink || "")}" placeholder="Organisation link (optional)">
        <div class="form-grid-two">
          <input name="email" type="email" value="${escapeUserHtml(item.email || "")}" placeholder="Email" required>
          <input name="phone" type="tel" value="${escapeUserHtml(item.phone || "")}" placeholder="Phone (optional)">
        </div>
        <div class="form-grid-two">
          <input name="username" type="text" value="${escapeUserHtml(item.username || "")}" placeholder="Username" required>
          <select name="role">
            <option value="user" ${item.role === "user" ? "selected" : ""}>User</option>
            <option value="curator" ${item.role === "curator" ? "selected" : ""}>Curator</option>
            <option value="moderator" ${item.role === "moderator" ? "selected" : ""}>Moderator</option>
            <option value="admin" ${item.role === "admin" ? "selected" : ""}>Admin</option>
          </select>
        </div>
        <label class="registered-user-organisation-role">
          <span>Organisation Role — ${escapeUserHtml(item.organization || "No organisation selected")}</span>
          <select name="organisationRole">
            <option value="" ${!item.organisationRole ? "selected" : ""}>Not assigned</option>
            <option value="org_viewer" ${item.organisationRole === "org_viewer" ? "selected" : ""}>Viewer</option>
            <option value="org_editor" ${item.organisationRole === "org_editor" ? "selected" : ""}>Editor</option>
            <option value="org_admin" ${item.organisationRole === "org_admin" ? "selected" : ""}>Organisation Admin</option>
          </select>
          <small>${item.organisationRoleStatus ? `Current status: ${escapeUserHtml(item.organisationRoleStatus)}` : "No organisation membership is assigned for this profile organisation."}</small>
        </label>
        <div class="queue-actions">
          <button class="button primary" type="submit">Save User</button>
          <button class="button danger" type="button" data-delete-user="${escapeUserHtml(item.id)}" ${item.username === "admin" ? "disabled" : ""}>Delete User</button>
        </div>
      </form>
    `;

    usersList.appendChild(card);
  });
}

function applyUserFilter() {
  const query = normalizeSearchValue(usersSearchInput?.value);
  const filteredItems = !query
    ? allUsers
    : allUsers.filter((item) => {
        const username = normalizeSearchValue(item.username);
        const email = normalizeSearchValue(item.email);
        return username.includes(query) || email.includes(query);
      });

  const emptyMessage = query
    ? "No registered users matched this username or email."
    : "No registered users were found.";

  renderUsers(filteredItems, emptyMessage);

  if (query) {
    setUsersStatus(`${filteredItems.length} of ${allUsers.length} registered users shown.`);
    return;
  }

  setUsersStatus(`${allUsers.length} registered users loaded.`);
}

async function loadUsers() {
  setUsersStatus("Loading registered users...");

  try {
    const accessToken = await getAccessToken();
    const response = await window.grameeeAuth.apiRequest("adminListUsers", {}, accessToken);
    allUsers = Array.isArray(response?.items) ? response.items : [];
    applyUserFilter();
  } catch (error) {
    allUsers = [];
    setUsersStatus(error instanceof Error ? error.message : "Registered users could not be loaded.", true);
  }
}

async function updateUserRecord(form) {
  const userId = form.dataset.userId || "";
  const formData = new FormData(form);
  const payload = {
    userId,
    fullName: String(formData.get("fullName") || "").trim(),
    organization: String(formData.get("organization") || "").trim(),
    organizationLink: String(formData.get("organizationLink") || "").trim(),
    email: String(formData.get("email") || "").trim().toLowerCase(),
    phone: String(formData.get("phone") || "").trim(),
    username: String(formData.get("username") || "").trim().toLowerCase(),
    role: String(formData.get("role") || "").trim().toLowerCase(),
    organisationRole: String(formData.get("organisationRole") || "").trim().toLowerCase(),
  };

  setUsersStatus(`Saving changes for ${payload.username || "selected user"}...`);

  try {
    const accessToken = await getAccessToken();
    await window.grameeeAuth.apiRequest("adminUpdateUser", payload, accessToken);
    setUsersStatus("User details updated.");
    openUserActionModal({
      eyebrow: "Registered Users",
      title: "User updated",
      body: `${payload.username || payload.email || "The selected user"} was updated successfully.`
    });
    await loadUsers();
  } catch (error) {
    const message = error instanceof Error ? error.message : "User details could not be updated.";
    setUsersStatus(message, true);
    openUserActionModal({
      eyebrow: "Registered Users",
      title: "Update failed",
      body: message
    });
  }
}

async function deleteUserRecord(userId) {
  if (!userId) {
    return;
  }

  const card = usersList.querySelector(`[data-user-id="${CSS.escape(userId)}"]`);
  const username = card?.querySelector('input[name="username"]')?.value?.trim() || "this user";

  openUserActionModal({
    eyebrow: "Registered Users",
    title: "Delete user",
    body: `Delete ${username}? The record will be marked as removed and the username will stay reserved.`,
    actions: [
      {
        label: "Cancel",
        type: "secondary",
        onClick: closeUserActionModal
      },
      {
        label: "Delete User",
        type: "danger",
        onClick: async () => {
          setUsersStatus("Removing user record...");

          try {
            const accessToken = await getAccessToken();
            await window.grameeeAuth.apiRequest("adminDeleteUser", { userId }, accessToken);
            setUsersStatus("User record removed.");
            openUserActionModal({
              eyebrow: "Registered Users",
              title: "User removed",
              body: `${username} has been marked as removed.`
            });
            await loadUsers();
          } catch (error) {
            const message = error instanceof Error ? error.message : "User record could not be removed.";
            setUsersStatus(message, true);
            openUserActionModal({
              eyebrow: "Registered Users",
              title: "Delete failed",
              body: message
            });
          }
        }
      }
    ]
  });
}

usersList.addEventListener("submit", async (event) => {
  const form = event.target.closest(".registered-user-form");

  if (!form) {
    return;
  }

  event.preventDefault();
  await updateUserRecord(form);
});

usersList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete-user]");

  if (!button) {
    return;
  }

  await deleteUserRecord(button.dataset.deleteUser || "");
});

refreshUsersButton.addEventListener("click", loadUsers);

if (usersSearchInput) {
  usersSearchInput.addEventListener("input", applyUserFilter);
}

document.querySelectorAll("[data-close-user-action-modal]").forEach((element) => {
  element.addEventListener("click", closeUserActionModal);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && userActionModal && !userActionModal.hidden) {
    closeUserActionModal();
  }
});

async function initializeRegisteredUsersPage() {
  adminUserSummary = await window.grameeeAuth.requireLoggedInUser();

  if (adminUserSummary?.role !== "admin") {
    window.location.href = "index.html";
    return;
  }

  await loadUsers();
}

initializeRegisteredUsersPage().catch(() => {
  setUsersStatus("Please log in with an admin account to view registered users.", true);
});

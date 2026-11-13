const PAGE_SIZE = 12;
const STORAGE_BUCKET = "radio-images";
const STATION_COLUMNS = "id,name,genre,city,stream_url,image_url,logo_url,created_at";

const stationGrid = document.querySelector("#station-grid");
const stationCount = document.querySelector("#station-count");
const adminStationCount = document.querySelector("#admin-station-count");
const adminStationList = document.querySelector("#admin-station-list");
const adminStationsSection = document.querySelector("#admin-stations-section");
const managedStationsTitle = document.querySelector("#managed-stations-title");
const adminStationSearchForm = document.querySelector("#admin-station-search-form");
const adminStationSearchInput = document.querySelector("#admin-station-search-input");
const adminStationSearchClear = document.querySelector("#admin-station-search-clear");
const adminPaginationStatus = document.querySelector("#admin-pagination-status");
const adminPagination = document.querySelector("#admin-pagination");
const stationLimitMessage = document.querySelector("#station-limit-message");
const adminModal = document.querySelector("#admin-modal");
const stationForm = document.querySelector("#station-form");
const formError = document.querySelector("#form-error");
const loginForm = document.querySelector("#login-form");
const loginError = document.querySelector("#login-error");
const authMessage = document.querySelector("#auth-message");
const passwordResetForm = document.querySelector("#password-reset-form");
const resetEmail = document.querySelector("#reset-email");
const resetError = document.querySelector("#reset-error");
const resetMessage = document.querySelector("#reset-message");
const newPasswordForm = document.querySelector("#new-password-form");
const newPasswordError = document.querySelector("#new-password-error");
const adminAccess = document.querySelector("#admin-access");
const adminAccessMessage = document.querySelector("#admin-access-message");
const adminAccessHelp = document.querySelector("#admin-access-help");
const adminAuthorizationSql = document.querySelector("#admin-authorization-sql");
const adminHelpNote = document.querySelector("#admin-help-note");
const adminIntro = document.querySelector("#admin-intro");
const setupNotice = document.querySelector("#setup-notice");
const paginationStatus = document.querySelector("#pagination-status");
const pagination = document.querySelector("#pagination");
const stationSearchForm = document.querySelector("#station-search-form");
const stationSearchInput = document.querySelector("#station-search-input");
const stationSearchClear = document.querySelector("#station-search-clear");
const toast = document.querySelector("#toast");
const config = window.ondaSupabaseConfig;

let client = null;
let authUser = null;
let isRadioAdmin = false;
let isCheckingAdmin = false;
let adminCheckFailed = false;
let stations = [];
let managedStations = [];
let adminTotalCount = 0;
let adminCurrentPage = 1;
let adminLoadingPage = false;
let adminPageRequestGeneration = 0;
let adminSearchTerm = "";
let adminSearchTimeout;
let totalCount = 0;
let currentPage = 1;
let loadingPage = false;
let pageRequestGeneration = 0;
let searchTerm = "";
let searchTimeout;
let authGeneration = 0;
let authView = "login";
let toastTimeout;

function getRecoveryLinkError() {
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const errorParams = new URLSearchParams(window.location.search);
  const code = hashParams.get("error_code") || errorParams.get("error_code");
  const error = hashParams.get("error") || errorParams.get("error");
  if (!code && !error) return "";

  if (code === "otp_expired" || error === "access_denied") {
    return "Este enlace de recuperación venció o ya fue utilizado. Solicita uno nuevo.";
  }
  return "No se pudo validar el enlace de recuperación. Solicita uno nuevo y ábrelo desde el mismo correo.";
}

const recoveryLinkError = getRecoveryLinkError();

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isImageSource(value) {
  return isHttpUrl(value);
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("visible"), 3000);
}

function setFormError(element, message) {
  element.textContent = message;
  element.hidden = false;
}

function hideFormError(element) {
  element.hidden = true;
  element.textContent = "";
}

function mapStation(row) {
  return {
    id: row.id,
    name: row.name,
    genre: row.genre || "Variado",
    city: row.city || "",
    streamUrl: row.stream_url,
    imageUrl: row.image_url,
    logoUrl: row.logo_url,
    createdAt: row.created_at,
  };
}

function makeStationCard(station) {
  const card = makeElement("article", "station-card");
  card.dataset.stationId = station.id;
  const art = makeElement("div", "station-art");
  const cover = makeElement("img", "station-cover");
  cover.src = station.imageUrl;
  cover.alt = `Portada de ${station.name}`;
  cover.loading = "lazy";
  cover.addEventListener("error", () => {
    cover.remove();
    art.style.background = "linear-gradient(135deg, #465039, #222b24)";
  }, { once: true });

  const liveBadge = makeElement("div", "station-live");
  liveBadge.append(makeElement("span", "live-pulse"), document.createTextNode(" EN DIRECTO"));

  art.append(cover, liveBadge);

  const info = makeElement("div", "station-info");
  info.append(makeElement("h3", "station-title", station.name));
  const metadata = makeElement("div", "station-metadata");
  metadata.append(makeElement("span", "genre-badge", station.genre));
  if (station.city) {
    const cityBadge = makeElement("span", "genre-badge city-badge", station.city);
    cityBadge.setAttribute("aria-label", `Ciudad: ${station.city}`);
    metadata.append(cityBadge);
  }
  metadata.append(makeElement("span", "station-subtitle", "Radio en vivo"));
  info.append(metadata);
  const player = makeElement("audio", "station-player");
  player.controls = true;
  player.preload = "none";
  player.src = station.streamUrl;
  player.setAttribute("aria-label", `Reproductor de ${station.name}`);
  player.addEventListener("play", () => {
    stationGrid.querySelectorAll("audio").forEach((otherPlayer) => {
      if (otherPlayer !== player) otherPlayer.pause();
    });
  });
  info.append(player);
  card.append(art, info);
  return card;
}

function makeAdminRow(station) {
  const row = makeElement("div", "admin-station-row");
  row.dataset.stationId = station.id;
  const image = makeElement("img", "admin-station-thumb");
  image.src = station.logoUrl;
  image.alt = "";
  image.addEventListener("error", () => { image.hidden = true; }, { once: true });
  const name = makeElement("span", "admin-station-name", station.name);
  const genre = makeElement("span", "admin-station-genre", station.genre);
  const deleteButton = makeElement("button", "delete-button");
  deleteButton.type = "button";
  deleteButton.setAttribute("aria-label", `Borrar ${station.name}`);
  deleteButton.title = "Borrar emisora";
  deleteButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M5 7l1 13h12l1-13M9 7V4h6v3" /></svg><span>Borrar</span>';
  deleteButton.addEventListener("click", () => deleteStation(station));
  row.append(image, name, genre, deleteButton);
  return row;
}

function renderAdminList() {
  managedStationsTitle.textContent = isRadioAdmin ? "Todas las emisoras" : "Tus emisoras";
  adminStationCount.textContent = isRadioAdmin
    ? String(adminTotalCount)
    : `${managedStations.length}/5`;
  adminStationList.replaceChildren();
  if (managedStations.length === 0) {
    adminStationList.append(makeElement("p", "admin-empty", isRadioAdmin
      ? (adminSearchTerm ? "No se encontraron emisoras." : "Todavía no hay emisoras publicadas.")
      : "Todavía no has publicado emisoras."));
    return;
  }
  managedStations.forEach((station) => adminStationList.append(makeAdminRow(station)));
}

async function loadManagedStations() {
  if (!client || !authUser || isCheckingAdmin || adminCheckFailed) return;
  if (isRadioAdmin) {
    await loadAdminStations(adminCurrentPage);
    return;
  }
  const { data, error } = await client
    .from("stations")
    .select(STATION_COLUMNS)
    .eq("owner_id", authUser.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(5);
  if (error) {
    console.error("No se pudieron cargar las emisoras del usuario:", error);
    showToast("No se pudieron cargar tus emisoras.");
    return;
  }
  managedStations = data.map(mapStation);
  renderAdminList();
  const atLimit = !isRadioAdmin && managedStations.length >= 5;
  stationForm.querySelector(".submit-button").disabled = atLimit;
  stationLimitMessage.hidden = isRadioAdmin;
  stationLimitMessage.textContent = atLimit
    ? "Has alcanzado el máximo de 5 emisoras. Borra una para poder publicar otra."
    : `Has publicado ${managedStations.length} de 5 emisoras.`;
}

function renderAdminPagination() {
  const pageCount = Math.ceil(adminTotalCount / PAGE_SIZE);
  adminPagination.replaceChildren();
  if (pageCount === 0) return;

  const addPageButton = (label, page, options = {}) => {
    const button = makeElement("button", "page-button", label);
    button.type = "button";
    button.disabled = adminLoadingPage || options.disabled === true;
    if (options.current) button.setAttribute("aria-current", "page");
    if (options.label) button.setAttribute("aria-label", options.label);
    button.addEventListener("click", () => loadAdminStations(page));
    adminPagination.append(button);
  };
  const addEllipsis = () => adminPagination.append(makeElement("span", "page-ellipsis", "…"));

  addPageButton("‹", Math.max(1, adminCurrentPage - 1), {
    disabled: adminCurrentPage === 1,
    label: "Página anterior de emisoras administradas",
  });

  const visiblePages = new Set([1, pageCount]);
  for (let page = Math.max(1, adminCurrentPage - 2); page <= Math.min(pageCount, adminCurrentPage + 2); page += 1) {
    visiblePages.add(page);
  }
  const orderedPages = [...visiblePages].sort((a, b) => a - b);
  let previousPage = 0;
  orderedPages.forEach((page) => {
    if (previousPage && page - previousPage > 1) addEllipsis();
    addPageButton(String(page), page, { current: page === adminCurrentPage });
    previousPage = page;
  });

  addPageButton("›", Math.min(pageCount, adminCurrentPage + 1), {
    disabled: adminCurrentPage === pageCount,
    label: "Página siguiente de emisoras administradas",
  });
}

async function loadAdminStations(page) {
  if (!client || !authUser || !isRadioAdmin) return;
  const requestGeneration = ++adminPageRequestGeneration;
  adminLoadingPage = true;
  renderAdminPagination();
  adminPaginationStatus.textContent = adminSearchTerm ? "Buscando emisoras…" : "Cargando emisoras…";
  adminPaginationStatus.classList.remove("error");

  try {
    let query = client
      .from("stations")
      .select(STATION_COLUMNS, { count: "exact" });
    if (adminSearchTerm) {
      const escapedTerm = adminSearchTerm.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
      query = query.or(`name.ilike."%${escapedTerm}%",genre.ilike."%${escapedTerm}%",city.ilike."%${escapedTerm}%"`);
    }
    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (error) throw error;
    if (requestGeneration !== adminPageRequestGeneration) return;

    managedStations = data.map(mapStation);
    adminTotalCount = count ?? 0;
    const pageCount = Math.ceil(adminTotalCount / PAGE_SIZE);
    adminCurrentPage = pageCount === 0 ? 1 : Math.min(page, pageCount);
    renderAdminList();
    adminPaginationStatus.textContent = "";
  } catch (error) {
    if (requestGeneration !== adminPageRequestGeneration) return;
    console.error("No se pudieron cargar las emisoras para administrar:", error);
    adminPaginationStatus.textContent = "No se pudieron cargar las emisoras. Comprueba la conexión e inténtalo de nuevo.";
    adminPaginationStatus.classList.add("error");
    const retry = makeElement("button", "page-button", "Reintentar");
    retry.type = "button";
    retry.addEventListener("click", () => loadAdminStations(page));
    adminPaginationStatus.append(" ", retry);
  } finally {
    if (requestGeneration === adminPageRequestGeneration) {
      adminLoadingPage = false;
      renderAdminPagination();
    }
  }
}

function updateAdminStationSearch(immediate = false) {
  adminSearchTerm = adminStationSearchInput.value.trim();
  adminStationSearchClear.hidden = !adminStationSearchInput.value;
  window.clearTimeout(adminSearchTimeout);
  if (!client || !isRadioAdmin) return;

  adminPageRequestGeneration += 1;
  adminLoadingPage = false;
  renderAdminPagination();
  adminPaginationStatus.classList.remove("error");
  adminPaginationStatus.textContent = adminSearchTerm ? "Preparando búsqueda…" : "";
  if (immediate) {
    loadAdminStations(1);
  } else {
    adminSearchTimeout = window.setTimeout(() => loadAdminStations(1), 250);
  }
}

function renderEmptyState() {
  const empty = makeElement("div", "empty-state");
  if (searchTerm) {
    empty.append(makeElement("div", "empty-icon", "⌕"));
    empty.append(makeElement("h3", "", "No se encontraron emisoras"));
    empty.append(makeElement("p", "", "Prueba con otro nombre, género o ciudad, o limpia la búsqueda."));
  } else {
    empty.append(makeElement("div", "empty-icon", "♫"));
    empty.append(makeElement("h3", "", "Tu dial está esperando"));
    empty.append(makeElement("p", "", "Todavía no hay emisoras. Vuelve pronto para descubrir nuevas frecuencias."));
  }
  stationGrid.replaceChildren(empty);
}

function renderPagination() {
  const pageCount = Math.ceil(totalCount / PAGE_SIZE);
  pagination.replaceChildren();
  if (pageCount === 0) return;

  const addPageButton = (label, page, options = {}) => {
    const button = makeElement("button", "page-button", label);
    button.type = "button";
    button.disabled = loadingPage || options.disabled === true;
    if (options.current) button.setAttribute("aria-current", "page");
    if (options.label) button.setAttribute("aria-label", options.label);
    button.addEventListener("click", () => loadPage(page));
    pagination.append(button);
  };
  const addEllipsis = () => pagination.append(makeElement("span", "page-ellipsis", "…"));

  addPageButton("‹", Math.max(1, currentPage - 1), {
    disabled: currentPage === 1,
    label: "Página anterior",
  });

  const visiblePages = new Set([1, pageCount]);
  for (let page = Math.max(1, currentPage - 2); page <= Math.min(pageCount, currentPage + 2); page += 1) {
    visiblePages.add(page);
  }
  const orderedPages = [...visiblePages].sort((a, b) => a - b);
  let previousPage = 0;
  orderedPages.forEach((page) => {
    if (previousPage && page - previousPage > 1) addEllipsis();
    addPageButton(String(page), page, { current: page === currentPage });
    previousPage = page;
  });

  addPageButton("›", Math.min(pageCount, currentPage + 1), {
    disabled: currentPage === pageCount,
    label: "Página siguiente",
  });
}

async function loadPage(page) {
  if (!client) return;
  const requestGeneration = ++pageRequestGeneration;
  loadingPage = true;
  renderPagination();
  paginationStatus.textContent = searchTerm ? "Buscando emisoras…" : "Cargando emisoras…";
  paginationStatus.classList.remove("error");

  try {
    let query = client
      .from("stations")
      .select(STATION_COLUMNS, { count: "exact" });
    if (searchTerm) {
      const escapedTerm = searchTerm.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
      query = query.or(`name.ilike."%${escapedTerm}%",genre.ilike."%${escapedTerm}%",city.ilike."%${escapedTerm}%"`);
    }
    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (error) throw error;
    if (requestGeneration !== pageRequestGeneration) return;

    stations = data.map(mapStation);
    totalCount = count ?? totalCount;
    const pageCount = Math.ceil(totalCount / PAGE_SIZE);
    currentPage = pageCount === 0 ? 1 : Math.min(page, pageCount);
    stationGrid.replaceChildren();
    if (stations.length === 0) renderEmptyState();
    else stations.forEach((station) => stationGrid.append(makeStationCard(station)));
    stationCount.textContent = String(totalCount);
    paginationStatus.textContent = "";
  } catch (error) {
    if (requestGeneration !== pageRequestGeneration) return;
    console.error("No se pudieron cargar las emisoras de Supabase:", error);
    paginationStatus.textContent = error.message?.includes("genre") || error.message?.includes("city")
      ? "Falta una columna de emisoras en Supabase. Ejecuta el SQL de actualización indicado en SUPABASE.md."
      : "No se pudieron cargar las emisoras. Comprueba la conexión e inténtalo de nuevo.";
    paginationStatus.classList.add("error");
    const retry = makeElement("button", "page-button", "Reintentar");
    retry.type = "button";
    retry.addEventListener("click", () => loadPage(page));
    paginationStatus.append(" ", retry);
  } finally {
    if (requestGeneration === pageRequestGeneration) {
      loadingPage = false;
      renderPagination();
    }
  }
}

function updateStationSearch(immediate = false) {
  searchTerm = stationSearchInput.value.trim();
  stationSearchClear.hidden = !stationSearchInput.value;
  window.clearTimeout(searchTimeout);
  if (!client) return;

  pageRequestGeneration += 1;
  loadingPage = false;
  renderPagination();
  paginationStatus.classList.remove("error");
  paginationStatus.textContent = searchTerm ? "Preparando búsqueda…" : "";
  if (immediate) {
    loadPage(1);
  } else {
    searchTimeout = window.setTimeout(() => loadPage(1), 250);
  }
}

function showSetupError(message) {
  paginationStatus.textContent = message;
  paginationStatus.classList.add("error");
}

function updateAdminControls() {
  const configured = Boolean(client);
  const canManageStations = Boolean(authUser) && !isCheckingAdmin && !adminCheckFailed && authView !== "set-password";
  adminIntro.textContent = isRadioAdmin
    ? "Desde este panel puedes ver las emisoras que publican los usuarios en el sitio y administrar todas las emisoras."
    : "Crea y administra las emisoras que aparecen en tu web.";
  setupNotice.hidden = configured;
  loginForm.hidden = !configured || Boolean(authUser) || authView !== "login";
  passwordResetForm.hidden = !configured || Boolean(authUser) || authView !== "request-reset";
  newPasswordForm.hidden = !configured || authView !== "set-password";
  adminAccess.hidden = !configured || !authUser || authView === "set-password";
  adminAccessHelp.hidden = !configured || !authUser || !adminCheckFailed || authView === "set-password";
  stationForm.hidden = !configured || !canManageStations;
  adminStationsSection.hidden = !configured || !canManageStations;
  adminStationList.hidden = !configured || !canManageStations;
  adminStationSearchForm.hidden = !configured || !canManageStations || !isRadioAdmin;
  stationLimitMessage.hidden = !canManageStations || isRadioAdmin;
  if (!configured) {
    setupNotice.textContent = "Configura la URL y la clave pública de Supabase en supabase-config.js y ejecuta supabase-setup.sql.";
    adminIntro.textContent = "Conecta Supabase para habilitar la galería y administrar las emisoras.";
  } else if (authUser && !isRadioAdmin) {
    adminAccessMessage.textContent = isCheckingAdmin
      ? "Sesión iniciada. Comprobando permisos de administrador…"
      : adminCheckFailed
        ? `Sesión iniciada como ${authUser.email ?? "usuario"}, pero no se pudieron comprobar los permisos.`
        : isRadioAdmin
          ? `Sesión de administrador: ${authUser.email ?? "usuario"}.`
          : `Sesión de usuario: ${authUser.email ?? "usuario"}. Puedes administrar hasta 5 emisoras.`;
    const escapedEmail = String(authUser.email ?? "").replaceAll("'", "''");
    adminAuthorizationSql.textContent = `insert into public.radio_admins (user_id)\nselect id from auth.users where lower(email) = lower('${escapedEmail}')\non conflict (user_id) do nothing;`;
    adminAccessHelp.querySelector("h3").textContent = adminCheckFailed
      ? "No se pudieron comprobar los permisos"
      : "Falta autorizar esta cuenta";
    adminAuthorizationSql.closest("pre").hidden = adminCheckFailed;
    document.querySelector("#copy-admin-sql").hidden = adminCheckFailed;
    adminHelpNote.textContent = adminCheckFailed
      ? "Revisa que hayas ejecutado supabase-setup.sql en este mismo proyecto y que la función is_radio_admin() exista. Después, vuelve a comprobar."
      : "Si la consulta no añade ninguna fila, crea primero ese usuario en Authentication → Users. Después de autorizarlo, pulsa «Volver a comprobar».";
  } else if (authUser) {
    adminAccessMessage.textContent = `Sesión iniciada como ${authUser.email ?? "administrador"}.`;
  }
}

async function verifyAdmin(generation = authGeneration) {
  isCheckingAdmin = true;
  adminCheckFailed = false;
  isRadioAdmin = false;
  updateAdminControls();
  try {
    const { data, error } = await client.rpc("is_radio_admin");
    if (error) throw error;
    if (generation !== authGeneration) return;
    isRadioAdmin = data === true;
    isCheckingAdmin = false;
    updateAdminControls();
    await loadManagedStations();
  } catch (error) {
    if (generation !== authGeneration) return;
    console.error("No se pudo verificar el acceso de administrador:", error);
    isCheckingAdmin = false;
    adminCheckFailed = true;
    updateAdminControls();
    adminAccessMessage.textContent = "No se pudo verificar tu acceso. Comprueba la configuración de Supabase y la función is_radio_admin().";
  }
}

function openAdmin() {
  adminModal.hidden = false;
  document.body.style.overflow = "hidden";
  if (!client) return;
  if (!authUser) focusAuthField("#admin-email");
  else if (isRadioAdmin) document.querySelector("#station-name").focus();
}

function closeAdmin() {
  adminModal.hidden = true;
  document.body.style.overflow = "";
  document.querySelector("#admin-trigger").focus();
}

function focusAuthField(selector) {
  if (window.matchMedia("(max-width: 700px)").matches) return;
  document.querySelector(selector).focus();
}

function optimizeImage(file, maxDimension, maxBytes) {
  if (!file.type.startsWith("image/")) {
    return Promise.reject(new Error("El archivo seleccionado no es una imagen."));
  }
  if (file.size > 10 * 1024 * 1024) {
    return Promise.reject(new Error("Cada imagen debe pesar menos de 10 MB."));
  }

  return createImageBitmap(file).then((bitmap) => {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      throw new Error("No se pudo procesar la imagen en este navegador.");
    }

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    return new Promise((resolve, reject) => {
      const encode = (quality) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("No se pudo procesar la imagen seleccionada."));
            return;
          }
          if (blob.size > maxBytes && quality > 0.5) {
            encode(quality - 0.1);
            return;
          }
          if (blob.size > maxBytes || blob.type !== "image/webp") {
            reject(new Error("La imagen es demasiado grande para guardarla. Prueba con una imagen más pequeña."));
            return;
          }
          resolve(blob);
        }, "image/webp", quality);
      };
      encode(0.82);
    });
  });
}

async function uploadImage(file, stationId, kind) {
  const blob = await optimizeImage(file, kind === "cover" ? 1400 : 600, kind === "cover" ? 400 * 1024 : 250 * 1024);
  const path = `${authUser.id}/${stationId}-${kind}.webp`;
  const { error } = await client.storage.from(STORAGE_BUCKET).upload(path, blob, {
    contentType: "image/webp",
    upsert: false,
  });
  if (error) throw error;
  const { data } = client.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

function storedImagePath(publicUrl) {
  if (!isHttpUrl(publicUrl)) return null;
  const image = new URL(publicUrl);
  if (image.origin !== new URL(config.url).origin) return null;
  const path = image.pathname;
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
  const markerIndex = path.indexOf(marker);
  if (markerIndex < 0) return null;
  try {
    return decodeURIComponent(path.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

async function removeStoredImages(station) {
  const paths = [station.imageUrl, station.logoUrl].map(storedImagePath).filter(Boolean);
  if (!paths.length) return;
  const { error } = await client.storage.from(STORAGE_BUCKET).remove(paths);
  if (error) throw error;
}

async function deleteStation(station) {
  if (!authUser || isCheckingAdmin || adminCheckFailed) {
    showToast("Inicia sesión para borrar emisoras.");
    return;
  }
  const { error } = await client.from("stations").delete().eq("id", station.id);
  if (error) {
    console.error("No se pudo borrar la emisora:", error);
    showToast("No se pudo borrar. Solo puedes borrar tus emisoras.");
    return;
  }

  managedStations = managedStations.filter((item) => item.id !== station.id);
  const isOnCurrentPage = stations.some((item) => item.id === station.id);
  if (isOnCurrentPage) {
    stations = stations.filter((item) => item.id !== station.id);
  }
  totalCount = Math.max(0, totalCount - 1);
  stationGrid.querySelector(`[data-station-id="${CSS.escape(station.id)}"]`)?.remove();
  if (isOnCurrentPage && stations.length === 0 && totalCount === 0) renderEmptyState();
  stationCount.textContent = String(totalCount);
  if (isRadioAdmin) adminTotalCount = Math.max(0, adminTotalCount - 1);
  renderAdminList();

  try {
    await removeStoredImages(station);
    showToast("Emisora borrada correctamente.");
  } catch (error) {
    console.error("La emisora se borró, pero no se pudieron limpiar sus imágenes:", error);
    showToast("Emisora borrada; no se pudieron limpiar sus imágenes.");
  }
  if (!isRadioAdmin) {
    const pageCount = Math.ceil(totalCount / PAGE_SIZE);
    await loadPage(Math.min(currentPage, Math.max(1, pageCount)));
    await loadManagedStations();
    return;
  }
  const pageCount = Math.ceil(totalCount / PAGE_SIZE);
  const adminPageCount = Math.ceil(adminTotalCount / PAGE_SIZE);
  await Promise.all([
    loadPage(Math.min(currentPage, Math.max(1, pageCount))),
    loadAdminStations(Math.min(adminCurrentPage, Math.max(1, adminPageCount))),
  ]);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideFormError(loginError);
  authMessage.hidden = true;
  const submitButton = loginForm.querySelector(".submit-button");
  submitButton.disabled = true;
  submitButton.textContent = "Iniciando sesión…";
  const formData = new FormData(loginForm);
  try {
    const { error } = await client.auth.signInWithPassword({
      email: String(formData.get("email")).trim(),
      password: String(formData.get("password")),
    });

    if (error) throw error;
    loginForm.reset();
  } catch (error) {
    console.error("No se pudo iniciar sesión:", error);
    setFormError(loginError, error?.code === "email_not_confirmed"
      ? "Confirma tu correo desde el enlace que te enviamos y vuelve a iniciar sesión."
      : error?.code === "over_request_rate_limit"
        ? "Se han realizado demasiados intentos. Espera un momento antes de volver a intentarlo."
        : "No se pudo iniciar sesión. Revisa el correo y la contraseña.");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Iniciar sesión";
  }
});

document.querySelector("#forgot-password-button").addEventListener("click", () => {
  hideFormError(loginError);
  resetMessage.hidden = true;
  resetError.hidden = true;
  resetEmail.value = document.querySelector("#admin-email").value.trim();
  authView = "request-reset";
  updateAdminControls();
  focusAuthField("#reset-email");
});

document.querySelector("#back-to-login-button").addEventListener("click", () => {
  resetMessage.hidden = true;
  resetError.hidden = true;
  authView = "login";
  updateAdminControls();
  focusAuthField("#admin-email");
});

passwordResetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  resetError.hidden = true;
  resetMessage.hidden = true;
  if (!passwordResetForm.reportValidity()) return;

  const button = passwordResetForm.querySelector(".submit-button");
  button.disabled = true;
  button.textContent = "Enviando…";
  try {
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await client.auth.resetPasswordForEmail(resetEmail.value.trim(), { redirectTo });
    if (error) throw error;
    resetMessage.textContent = "Si existe una cuenta con ese correo, recibirás un enlace para restablecer la contraseña.";
    resetMessage.hidden = false;
  } catch (error) {
    console.error("No se pudo enviar el enlace de recuperación:", error);
    setFormError(resetError, error?.code === "redirect_to_not_allowed"
      ? "Supabase bloqueó el enlace. Añade la dirección de esta web en Authentication → URL Configuration → Redirect URLs."
      : error?.code === "over_request_rate_limit"
        ? "Se han solicitado demasiados enlaces. Espera un momento y vuelve a intentarlo."
        : error?.code === "email_address_invalid" || error?.code === "validation_failed"
          ? "El correo no es válido. Revísalo e inténtalo otra vez."
          : "No se pudo enviar el enlace. Revisa que el usuario exista y que el correo SMTP de Supabase esté configurado.");
  } finally {
    button.disabled = false;
    button.textContent = "Enviar enlace";
  }
});

newPasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideFormError(newPasswordError);
  if (!newPasswordForm.reportValidity()) return;

  const button = newPasswordForm.querySelector(".submit-button");
  button.disabled = true;
  button.textContent = "Guardando…";
  try {
    const formData = new FormData(newPasswordForm);
    const { error } = await client.auth.updateUser({ password: String(formData.get("password")) });
    if (error) throw error;
    authView = "login";
    newPasswordForm.reset();
    updateAdminControls();
    showToast("Contraseña actualizada. Ya puedes usar tu cuenta.");
  } catch (error) {
    console.error("No se pudo actualizar la contraseña:", error);
    setFormError(newPasswordError, "No se pudo actualizar la contraseña. Solicita un nuevo enlace e inténtalo otra vez.");
  } finally {
    button.disabled = false;
    button.textContent = "Guardar contraseña";
  }
});

stationSearchInput.addEventListener("input", () => updateStationSearch());
stationSearchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateStationSearch(true);
});
stationSearchClear.addEventListener("click", () => {
  stationSearchInput.value = "";
  updateStationSearch(true);
  stationSearchInput.focus();
});
adminStationSearchInput.addEventListener("input", () => updateAdminStationSearch());
adminStationSearchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateAdminStationSearch(true);
});
adminStationSearchClear.addEventListener("click", () => {
  adminStationSearchInput.value = "";
  updateAdminStationSearch(true);
  adminStationSearchInput.focus();
});

document.querySelector("#signup-button").addEventListener("click", async () => {
  hideFormError(loginError);
  authMessage.hidden = true;
  if (!loginForm.reportValidity()) return;

  const formData = new FormData(loginForm);
  if (String(formData.get("password")).length < 8) {
    setFormError(loginError, "La contraseña debe tener al menos 8 caracteres para crear una cuenta.");
    document.querySelector("#admin-password").focus();
    return;
  }

  const button = document.querySelector("#signup-button");
  button.disabled = true;
  button.textContent = "Creando cuenta…";
  try {
    const { data, error } = await client.auth.signUp({
      email: String(formData.get("email")).trim(),
      password: String(formData.get("password")),
    });
    if (error) throw error;

    if (!data.session) {
      authMessage.textContent = "Cuenta creada. Revisa tu correo para confirmar la dirección y luego inicia sesión.";
      authMessage.hidden = false;
    } else {
      showToast("Cuenta creada. Ya puedes publicar hasta 5 emisoras.");
    }
  } catch (error) {
    console.error("No se pudo crear la cuenta:", error);
    setFormError(loginError, "No se pudo crear la cuenta. Comprueba el correo y que la contraseña tenga al menos 8 caracteres.");
  } finally {
    button.disabled = false;
    button.textContent = "Crear cuenta de usuario";
  }
});

document.querySelector("#sign-out-button").addEventListener("click", async () => {
  const { error } = await client.auth.signOut();
  if (error) {
    console.error("No se pudo cerrar sesión:", error);
    showToast("No se pudo cerrar la sesión.");
  }
});

document.querySelector("#verify-admin-button").addEventListener("click", () => verifyAdmin());
document.querySelector("#copy-admin-sql").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(adminAuthorizationSql.textContent);
    showToast("Consulta SQL copiada.");
  } catch (error) {
    console.error("No se pudo copiar la consulta SQL:", error);
    showToast("No se pudo copiar. Selecciona y copia la consulta manualmente.");
  }
});

stationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideFormError(formError);
  if (!authUser || isCheckingAdmin || adminCheckFailed) {
    setFormError(formError, "Inicia sesión para publicar una emisora.");
    return;
  }

  const formData = new FormData(stationForm);
  const imageFile = formData.get("imageFile");
  const imageUrl = String(formData.get("imageUrl")).trim();
  const name = String(formData.get("name")).trim();
  const streamUrl = String(formData.get("streamUrl")).trim();
  const genre = String(formData.get("genre")).trim();
  const city = String(formData.get("city")).trim();

  if (!name || !genre || !city || !isHttpUrl(streamUrl)) {
    setFormError(formError, "Escribe el nombre, el género, la ciudad y una URL de radio válida que empiece por http:// o https://.");
    return;
  }
  if (!imageFile.size && !isImageSource(imageUrl)) {
    setFormError(formError, "Añade una imagen de portada con una URL válida o elige un archivo.");
    return;
  }
  if (!isRadioAdmin && managedStations.length >= 5) {
    setFormError(formError, "Has alcanzado el máximo de 5 emisoras. Borra una antes de publicar otra.");
    return;
  }

  const submitButton = stationForm.querySelector(".submit-button");
  submitButton.disabled = true;
  submitButton.textContent = "Guardando emisora…";
  const id = crypto.randomUUID();
  const uploadedPaths = [];

  try {
    let finalImageUrl = imageUrl;
    if (imageFile.size) {
      const uploaded = await uploadImage(imageFile, id, "cover");
      uploadedPaths.push(uploaded.path);
      finalImageUrl = uploaded.url;
    }

    const { data, error } = await client.rpc("create_radio_station", {
      p_id: id,
      p_name: name,
      p_genre: genre,
      p_city: city,
      p_stream_url: streamUrl,
      p_image_url: finalImageUrl,
    });
    if (error) throw error;

    totalCount += 1;
    if (isRadioAdmin) {
      await Promise.all([loadPage(1), loadAdminStations(1)]);
    } else {
      await loadPage(currentPage);
      await loadManagedStations();
    }
    stationForm.reset();
    showToast("Emisora publicada. ¡A sonar!");
  } catch (error) {
    console.error("No se pudo crear la emisora:", error);
    if (uploadedPaths.length) {
      const { error: cleanupError } = await client.storage.from(STORAGE_BUCKET).remove(uploadedPaths);
      if (cleanupError) console.error("No se pudieron limpiar las imágenes de una emisora fallida:", cleanupError);
    }
    setFormError(formError, error?.code === "P0001" && error?.message?.includes("station_limit_reached")
      ? "Has alcanzado el máximo de 5 emisoras. Borra una antes de publicar otra."
      : error instanceof Error && error.message.includes("imagen")
        ? error.message
        : "No se pudo guardar la emisora. Comprueba la configuración y tus permisos de Supabase.");
  } finally {
    submitButton.disabled = !isRadioAdmin && managedStations.length >= 5;
    submitButton.innerHTML = '<span class="submit-plus">+</span> Crear emisora';
  }
});

document.querySelector("#admin-trigger").addEventListener("click", openAdmin);
document.querySelector("#close-admin").addEventListener("click", closeAdmin);
adminModal.addEventListener("click", (event) => {
  if (event.target === adminModal) closeAdmin();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !adminModal.hidden) closeAdmin();
});

const configured = config
  && isHttpUrl(config.url)
  && !config.url.includes("TU-PROJECTO")
  && typeof config.anonKey === "string"
  && config.anonKey.length > 20
  && !config.anonKey.includes("TU_CLAVE_PUBLICA");

if (!configured) {
  updateAdminControls();
  showSetupError("La galería necesita configuración de Supabase. Sigue los pasos de SUPABASE.md.");
} else if (!window.supabase?.createClient) {
  updateAdminControls();
  showSetupError("No se pudo cargar el cliente de Supabase. Comprueba tu conexión e inténtalo de nuevo.");
} else {
  client = window.supabase.createClient(config.url, config.anonKey);
  if (recoveryLinkError) {
    authView = "request-reset";
    resetError.textContent = recoveryLinkError;
    resetError.hidden = false;
    adminModal.hidden = false;
    document.body.style.overflow = "hidden";
  }
  updateAdminControls();
  client.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") authView = "set-password";
    else if (recoveryLinkError) authView = "request-reset";
    else if (event === "SIGNED_OUT") authView = "login";
    authGeneration += 1;
    adminPageRequestGeneration += 1;
    window.clearTimeout(adminSearchTimeout);
    const generation = authGeneration;
    authUser = session?.user ?? null;
    isRadioAdmin = false;
    adminTotalCount = 0;
    adminCurrentPage = 1;
    adminSearchTerm = "";
    adminStationSearchInput.value = "";
    adminStationSearchClear.hidden = true;
    adminPagination.replaceChildren();
    adminPaginationStatus.textContent = "";
    if (recoveryLinkError) {
      resetError.textContent = recoveryLinkError;
      resetError.hidden = false;
      adminModal.hidden = false;
      document.body.style.overflow = "hidden";
    }
    isCheckingAdmin = Boolean(authUser);
    adminCheckFailed = false;
    updateAdminControls();
    if (event === "PASSWORD_RECOVERY") {
      adminModal.hidden = false;
      document.body.style.overflow = "hidden";
      queueMicrotask(() => focusAuthField("#new-password"));
    }
    if (authUser) queueMicrotask(() => verifyAdmin(generation));
  });
  loadPage(1);
}

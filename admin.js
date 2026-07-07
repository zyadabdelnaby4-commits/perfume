const loginPanel = document.querySelector("[data-login-panel]");
const workspace = document.querySelector("[data-admin-workspace]");
const loginForm = document.querySelector("[data-login-form]");
const productForm = document.querySelector("[data-product-form]");
const productsList = document.querySelector("[data-products-list]");
const ordersList = document.querySelector("[data-orders-list]");
const loginMessage = document.querySelector("[data-login-message]");
const productMessage = document.querySelector("[data-product-message]");
const adminEmail = document.querySelector("[data-admin-email]");

// API Server base path configurations
const API_BASE = '';

// Stats fields
const statProducts = document.querySelector("[data-stat-products]");
const statOrders = document.querySelector("[data-stat-orders]");
const statRevenue = document.querySelector("[data-stat-revenue]");

// Color tone picker and preview fields
const tonePicker = document.querySelector("#tone-picker");
const imageFileInput = document.querySelector("#image-file-input");
const imagePreview = document.querySelector("#image-preview");

// Tabs
const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

let products = [];
let orders = [];

// Helper to handle server requests with local storage tokens
async function api(path, options = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  
  const token = localStorage.getItem("admin_token");
  const headers = { 
    "Content-Type": "application/json", 
    ...(options.headers || {}) 
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    headers,
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "حدث خطأ");
  return data;
}

function setMessage(element, text, isError = false) {
  element.textContent = text;
  element.classList.toggle("is-error", isError);
}

function showAdmin(email) {
  loginPanel.classList.add("is-hidden");
  workspace.classList.remove("is-hidden");
  adminEmail.textContent = email ? `مسجل باسم ${email}` : "";
}

function showLogin() {
  workspace.classList.add("is-hidden");
  loginPanel.classList.remove("is-hidden");
}

async function loadSession() {
  const token = localStorage.getItem("admin_token");
  try {
    const session = await api("/api/session");
    if (session.loggedIn || token) {
      showAdmin(session.email || "الأدمن");
      await loadDashboard();
    } else {
      showLogin();
    }
  } catch {
    showLogin();
  }
}

async function loadDashboard() {
  await Promise.all([
    loadProducts(),
    loadOrders()
  ]);
  calculateStats();
}

async function loadProducts() {
  products = await api("/api/products");
  renderProducts();
}

async function loadOrders() {
  try {
    orders = await api("/api/orders");
    renderOrders();
  } catch (err) {
    console.error("Failed to load orders:", err);
  }
}

// Stats Calculation
function calculateStats() {
  if (statProducts) statProducts.textContent = products.length;
  if (statOrders) statOrders.textContent = orders.length;
  
  const activeOrders = orders.filter(o => o.status !== "cancelled");
  const totalRev = activeOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  if (statRevenue) {
    statRevenue.textContent = `${new Intl.NumberFormat("ar-EG").format(totalRev)} جنيه`;
  }

  // Calculate actual profits from active orders
  let totalProfit = 0;
  activeOrders.forEach(order => {
    order.items.forEach(item => {
      const prod = products.find(p => p.id === item.id);
      if (prod) {
        const bottle = Number(prod.bottlePrice || 0);
        const oil = Number(prod.oilPrice || 0);
        const transport = Number(prod.transportCost || 0);
        const price = Number(item.price || prod.price || 0);
        const profitPerUnit = price - (bottle + oil + transport);
        totalProfit += profitPerUnit * item.quantity;
      } else {
        totalProfit += (item.price || 0) * item.quantity;
      }
    });
  });

  const statProfit = document.querySelector("[data-stat-profit]");
  if (statProfit) {
    statProfit.textContent = `${new Intl.NumberFormat("ar-EG").format(totalProfit)} جنيه`;
  }
}

// Convert Hex color input to RGBA string
function hexToRgba(hex, alpha = 0.32) {
  let c;
  if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
    c = hex.substring(1).split('');
    if (c.length === 3) {
      c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    c = '0x' + c.join('');
    return `rgba(${(c >> 16) & 255}, ${(c >> 8) & 255}, ${c & 255}, ${alpha})`;
  }
  return "rgba(199, 125, 53, 0.32)";
}

// Tone picker updates hidden input
if (tonePicker) {
  tonePicker.addEventListener("input", (e) => {
    productForm.elements.tone.value = hexToRgba(e.target.value);
  });
}

// Raw binary image uploader with preview handler and token authentication headers
if (imageFileInput) {
  imageFileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setMessage(productMessage, "جاري رفع الصورة...");

    try {
      const token = localStorage.getItem("admin_token");
      const headers = {
        "x-filename": file.name,
        "Content-Type": file.type
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        headers,
        body: file
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "فشل رفع الصورة");
      }

      productForm.elements.image.value = data.filename;
      imagePreview.src = API_BASE ? `${API_BASE}/images/products/${data.filename}` : `./images/products/${data.filename}`;
      imagePreview.classList.remove("is-hidden");
      setMessage(productMessage, "تم رفع الصورة بنجاح.");
    } catch (err) {
      setMessage(productMessage, err.message, true);
    }
  });
}

// Custom confirmation Dialog box replacement
function customConfirm(message) {
  return new Promise((resolve) => {
    const dialog = document.querySelector("#confirm-modal");
    const msgEl = document.querySelector("#confirm-message");
    const yesBtn = document.querySelector("#confirm-yes-btn");
    const noBtn = document.querySelector("#confirm-no-btn");

    msgEl.textContent = message;

    const onYes = () => {
      cleanup();
      resolve(true);
    };

    const onNo = () => {
      cleanup();
      resolve(false);
    };

    const cleanup = () => {
      yesBtn.removeEventListener("click", onYes);
      noBtn.removeEventListener("click", onNo);
      dialog.close();
    };

    yesBtn.addEventListener("click", onYes);
    noBtn.addEventListener("click", onNo);
    dialog.showModal();
  });
}

// Tab toggle switches listener
tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    tabButtons.forEach(b => b.classList.remove("active"));
    tabContents.forEach(tc => tc.classList.add("is-hidden"));

    btn.classList.add("active");
    const tabId = btn.dataset.tab;
    document.querySelector(`#tab-${tabId}`).classList.remove("is-hidden");
  });
});

function renderProducts() {
  productsList.innerHTML = "";
  products.sort((a, b) => (a.sort || 0) - (b.sort || 0));

  products.forEach((product) => {
    const item = document.createElement("article");
    item.className = "admin-item";
    const imgPath = product.image ? (API_BASE ? `${API_BASE}/images/products/${product.image}` : `./images/products/${product.image}`) : './images/products/amber-oud.png';
    
    const bottle = Number(product.bottlePrice || 0);
    const oil = Number(product.oilPrice || 0);
    const transport = Number(product.transportCost || 0);
    const profit = Number(product.price || 0) - (bottle + oil + transport);

    item.innerHTML = `
      <div style="display: flex; gap: 14px; align-items: center;">
        <img src="${imgPath}" 
             alt="${product.name}" 
             style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;" 
             onerror="this.src='./images/products/amber-oud.png'" />
        <div>
          <h3>${product.name} - ${product.price} جنيه ${product.featured ? '<span style="color: var(--accent-gold); font-size:12px;">★ مميز</span>' : ''}</h3>
          <p>الحجم: ${product.volume} / ترتيب: ${product.sort || 0} / الوسم: ${product.tag} / النوتات: ${product.notes}</p>
          <p style="margin: 4px 0 0; font-size: 13px; color: var(--accent-teal);">
            سعر الزجاجة: ${bottle} ج | سعر الزيت: ${oil} ج | مواصلات: ${transport} ج | <strong>صافي الربح: ${profit} ج</strong>
          </p>
        </div>
      </div>
      <div class="item-actions">
        <button class="small-action" type="button" data-edit="${product.id}">تعديل</button>
        <button class="danger-action" type="button" data-delete="${product.id}">حذف</button>
      </div>
    `;
    productsList.appendChild(item);
  });
}

// Render Orders table list
function renderOrders() {
  ordersList.innerHTML = "";
  if (orders.length === 0) {
    ordersList.innerHTML = '<tr><td colspan="7" style="text-align:center;">لا توجد طلبات مسجلة حالياً.</td></tr>';
    return;
  }

  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  orders.forEach((order) => {
    const tr = document.createElement("tr");
    
    const itemsText = order.items.map(item => `${item.name} (×${item.quantity})`).join("، ");
    const formattedDate = new Date(order.createdAt).toLocaleString("ar-EG");

    tr.innerHTML = `
      <td><code>${order.id}</code></td>
      <td><strong>${order.customerName}</strong></td>
      <td><a href="tel:${order.phone}" style="color: var(--accent-gold);">${order.phone}</a></td>
      <td><span style="font-size:13px; color: var(--muted);">${itemsText}</span></td>
      <td><strong>${order.total} جنيه</strong></td>
      <td><span style="font-size: 13px;">${formattedDate}</span></td>
      <td>
        <select data-order-status-id="${order.id}">
          <option value="new" ${order.status === "new" ? "selected" : ""}>جديد</option>
          <option value="preparing" ${order.status === "preparing" ? "selected" : ""}>قيد التجهيز</option>
          <option value="done" ${order.status === "done" ? "selected" : ""}>تم التوصيل</option>
          <option value="cancelled" ${order.status === "cancelled" ? "selected" : ""}>ملغي</option>
        </select>
      </td>
    `;
    ordersList.appendChild(tr);
  });
}

// Listen to order status updates dropdown trigger
ordersList.addEventListener("change", async (e) => {
  const orderId = e.target.dataset.orderStatusId;
  if (!orderId) return;

  const newStatus = e.target.value;
  try {
    const response = await api(`/api/orders/${encodeURIComponent(orderId)}/status`, {
      method: "PUT",
      body: JSON.stringify({ status: newStatus })
    });

    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex !== -1) {
      orders[orderIndex].status = newStatus;
    }
    calculateStats();
    if (window.showToast) window.showToast("تم تحديث حالة الطلب بنجاح ✨", "success");
  } catch (err) {
    if (window.showToast) window.showToast(err.message, "error");
  }
});

function fillForm(product) {
  productForm.elements.id.value = product.id;
  productForm.elements.name.value = product.name;
  productForm.elements.category.value = product.category;
  productForm.elements.volume.value = product.volume;
  productForm.elements.price.value = product.price;
  productForm.elements.bottlePrice.value = product.bottlePrice || 0;
  productForm.elements.oilPrice.value = product.oilPrice || 0;
  productForm.elements.transportCost.value = product.transportCost || 0;
  productForm.elements.tag.value = product.tag;
  productForm.elements.tone.value = product.tone;
  productForm.elements.sort.value = product.sort || 1;
  productForm.elements.featured.checked = !!product.featured;
  productForm.elements.notes.value = product.notes;
  productForm.elements.image.value = product.image || "";

  if (product.image) {
    imagePreview.src = API_BASE ? `${API_BASE}/images/products/${product.image}` : `./images/products/${product.image}`;
    imagePreview.classList.remove("is-hidden");
  } else {
    imagePreview.classList.add("is-hidden");
  }

  updateProfitPreview();
  productForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetForm() {
  productForm.reset();
  productForm.elements.id.value = "";
  productForm.elements.tone.value = "rgba(199, 125, 53, 0.32)";
  productForm.elements.image.value = "";
  productForm.elements.bottlePrice.value = 0;
  productForm.elements.oilPrice.value = 0;
  productForm.elements.transportCost.value = 0;
  if (tonePicker) tonePicker.value = "#c77d35";
  if (imagePreview) {
    imagePreview.src = "";
    imagePreview.classList.add("is-hidden");
  }
  if (imageFileInput) imageFileInput.value = "";
  setMessage(productMessage, "");
  updateProfitPreview();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  try {
    const session = await api("/api/login", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(formData)),
    });
    
    if (session.token) {
      localStorage.setItem("admin_token", session.token);
    }

    setMessage(loginMessage, "");
    showAdmin(session.email);
    await loadDashboard();
  } catch (error) {
    setMessage(loginMessage, error.message, true);
  }
});

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(productForm);
  const product = Object.fromEntries(formData);
  const id = product.id;
  delete product.id;

  product.featured = productForm.elements.featured.checked;
  product.sort = Number(product.sort);

  try {
    if (id) {
      await api(`/api/products/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(product),
      });
      setMessage(productMessage, "اتعدل المنتج بنجاح.");
      if (window.showToast) window.showToast("تم تعديل المنتج بنجاح ✨", "success");
    } else {
      await api("/api/products", {
        method: "POST",
        body: JSON.stringify(product),
      });
      setMessage(productMessage, "اتضاف المنتج بنجاح.");
      if (window.showToast) window.showToast("تم إضافة المنتج بنجاح ✨", "success");
    }
    resetForm();
    await loadDashboard();
  } catch (error) {
    setMessage(productMessage, error.message, true);
    if (window.showToast) window.showToast(error.message, "error");
  }
});

productsList.addEventListener("click", async (event) => {
  const editId = event.target.dataset.edit;
  const deleteId = event.target.dataset.delete;

  if (editId) {
    const product = products.find((item) => item.id === editId);
    if (product) fillForm(product);
  }

  if (deleteId) {
    const product = products.find((item) => item.id === deleteId);
    const ok = await customConfirm(`هل تريد حذف ${product?.name || "المنتج"}؟`);
    if (!ok) return;
    try {
      await api(`/api/products/${encodeURIComponent(deleteId)}`, { method: "DELETE" });
      if (window.showToast) window.showToast("تم حذف المنتج بنجاح 🗑️", "success");
      await loadDashboard();
    } catch (err) {
      if (window.showToast) window.showToast(err.message, "error");
    }
  }
});

document.querySelector("[data-reset-form]").addEventListener("click", resetForm);

document.querySelector("[data-logout]").addEventListener("click", async () => {
  try {
    await api("/api/logout", { method: "POST" });
  } catch (err) {
    console.error(err);
  }
  localStorage.removeItem("admin_token");
  showLogin();
});

function updateProfitPreview() {
  const price = Number(productForm.elements.price.value || 0);
  const bottle = Number(productForm.elements.bottlePrice.value || 0);
  const oil = Number(productForm.elements.oilPrice.value || 0);
  const transport = Number(productForm.elements.transportCost.value || 0);
  const profit = price - (bottle + oil + transport);
  
  const previewEl = document.querySelector("[data-profit-preview]");
  if (previewEl) {
    previewEl.textContent = isNaN(profit) ? 0 : profit;
  }
}

// Bind real-time profit calculations
["input", "change"].forEach(evtName => {
  productForm.elements.price.addEventListener(evtName, updateProfitPreview);
  productForm.elements.bottlePrice.addEventListener(evtName, updateProfitPreview);
  productForm.elements.oilPrice.addEventListener(evtName, updateProfitPreview);
  productForm.elements.transportCost.addEventListener(evtName, updateProfitPreview);
});

resetForm();
loadSession();

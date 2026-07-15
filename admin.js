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
const statPurchases = document.querySelector("[data-stat-purchases]");
const statNetProfit = document.querySelector("[data-stat-net-profit]");
const statProfit = document.querySelector("[data-stat-profit]");
const statCapital = document.querySelector("[data-stat-capital]");

// Color tone picker and preview fields
const tonePicker = document.querySelector("#tone-picker");
const imageFileInput = document.querySelector("#image-file-input");
const imagePreview = document.querySelector("#image-preview");

// Sidebar & Tabs
const navButtons = document.querySelectorAll(".nav-btn");
const tabContents = document.querySelectorAll(".tab-content");

let products = [];
let orders = [];
let purchases = [];
let settings = {};

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

let salesChartInstance = null;
let currentMonthFilter = "all";

function renderSkeletons() {
  if (productsList) {
    productsList.innerHTML = `
      <div class="admin-item shimmer-bg" style="height:90px; border-radius:var(--radius-lg); margin-bottom:12px;"></div>
      <div class="admin-item shimmer-bg" style="height:90px; border-radius:var(--radius-lg); margin-bottom:12px;"></div>
      <div class="admin-item shimmer-bg" style="height:90px; border-radius:var(--radius-lg); margin-bottom:12px;"></div>
    `;
  }
  if (ordersList) {
    ordersList.innerHTML = `
      <tr class="shimmer-bg"><td colspan="8" style="height:60px; border:none;"></td></tr>
      <tr class="shimmer-bg"><td colspan="8" style="height:60px; border:none;"></td></tr>
      <tr class="shimmer-bg"><td colspan="8" style="height:60px; border:none;"></td></tr>
    `;
  }
}

async function loadDashboard() {
  renderSkeletons();
  await Promise.all([
    loadProducts(),
    loadOrders(),
    loadPurchases(),
    loadSettings()
  ]);
  populateMonthFilter();
  calculateStats();
  renderDashboardOverview();
  renderSalesChart();
}

async function loadSettings() {
  try {
    settings = await api("/api/settings");
  } catch (err) {
    console.error("Failed to load settings:", err);
    settings = {};
  }
}

async function loadPurchases() {
  try {
    purchases = await api("/api/purchases");
    renderPurchases();
  } catch (err) {
    console.error("Failed to load purchases:", err);
  }
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

// Populate month filter dropdown dynamically
function populateMonthFilter() {
  const select = document.querySelector("#dash-month-filter");
  if (!select) return;
  
  // Keep only the "All time" option initially
  select.innerHTML = '<option value="all">📅 كل الوقت</option>';
  
  const months = new Set();
  
  orders.forEach(o => {
    if (o.createdAt) {
      months.add(o.createdAt.substring(0, 7)); // YYYY-MM
    }
  });
  
  purchases.forEach(p => {
    if (p.date) {
      months.add(p.date.substring(0, 7)); // YYYY-MM
    }
  });
  
  const sortedMonths = Array.from(months).sort().reverse();
  const arabicMonths = {
    "01": "يناير", "02": "فبراير", "03": "مارس", "04": "أبريل",
    "05": "مايو", "06": "يونيو", "07": "يوليو", "08": "أغسطس",
    "09": "سبتمبر", "10": "أكتوبر", "11": "نوفمبر", "12": "ديسمبر"
  };
  
  sortedMonths.forEach(m => {
    const [year, month] = m.split("-");
    const label = `${arabicMonths[month] || month} ${year}`;
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = label;
    if (m === currentMonthFilter) opt.selected = true;
    select.appendChild(opt);
  });
}

// Stats Calculation
function calculateStats() {
  let filteredOrders = orders;
  let filteredPurchases = purchases;
  
  if (currentMonthFilter !== "all") {
    filteredOrders = orders.filter(o => o.createdAt && o.createdAt.startsWith(currentMonthFilter));
    filteredPurchases = purchases.filter(p => p.date && p.date.startsWith(currentMonthFilter));
  }
  
  if (statProducts) statProducts.textContent = products.length;
  if (statOrders) statOrders.textContent = filteredOrders.length;
  
  const activeOrders = filteredOrders.filter(o => o.status !== "cancelled");
  const totalRev = activeOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  if (statRevenue) {
    statRevenue.textContent = `${new Intl.NumberFormat("ar-EG").format(totalRev)} جنيه`;
  }

  // Calculate total purchases
  const totalPur = filteredPurchases.reduce((sum, p) => sum + (p.totalPrice || 0), 0);
  if (statPurchases) {
    statPurchases.textContent = `${new Intl.NumberFormat("ar-EG").format(totalPur)} جنيه`;
  }

  // Capital fund (Capital is fixed unless we filter by month, in which case we still show the total capital fund input but maybe net profit is calculated with it)
  const capitalFund = Number(settings.capitalFund || 0);
  if (statCapital) {
    statCapital.textContent = `${new Intl.NumberFormat("ar-EG").format(capitalFund)} جنيه`;
  }

  // Calculate Net Profit (revenue - purchases - capitalFund)
  const netProfit = totalRev - totalPur - capitalFund;
  if (statNetProfit) {
    statNetProfit.textContent = `${new Intl.NumberFormat("ar-EG").format(netProfit)} جنيه`;
    statNetProfit.style.color = netProfit >= 0 ? "var(--accent-teal)" : "var(--accent-burgundy)";
  }

  // Calculate expected operating profit from active orders
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
navButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const tabId = btn.dataset.tab;
    switchTab(tabId);
  });
});

function renderProducts() {
  productsList.innerHTML = "";
  products.sort((a, b) => (a.sort || 0) - (b.sort || 0));

  products.forEach((product) => {
    const item = document.createElement("article");
    item.className = "admin-item" + (product.featured ? " featured-product" : "");
    const imgPath = product.image ? (API_BASE ? `${API_BASE}/images/products/${product.image}` : `./images/products/${product.image}`) : './images/products/amber-oud.png';
    
    const bottle = Number(product.bottlePrice || 0);
    const oil = Number(product.oilPrice || 0);
    const transport = Number(product.transportCost || 0);
    
    const pricesText = [];
    if (product.price30 > 0) pricesText.push(`30مل: ${product.price30}ج`);
    if (product.price50 > 0) pricesText.push(`50مل: ${product.price50}ج`);
    if (product.price100 > 0) pricesText.push(`100مل: ${product.price100}ج`);
    if (pricesText.length === 0 && product.price > 0) pricesText.push(`الافتراضي: ${product.price}ج`);
    
    const mainPrice = product.price30 || product.price || 0;
    const profit = mainPrice - (bottle + oil + transport);

    item.innerHTML = `
      <div style="display: flex; gap: 14px; align-items: center;">
        <img src="${imgPath}" 
             alt="${product.name}" 
             style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;" 
             onerror="this.src='./images/products/amber-oud.png'" />
        <div>
          <h3>${product.name} - <span style="color:var(--accent-gold); font-size:15px;">${pricesText.join(" | ")}</span> ${product.featured ? '<span style="color: var(--accent-gold); font-size:12px;">★ مميز</span>' : ''}</h3>
          <p>الحجم الافتراضي: ${product.volume || "30ml"} / ترتيب: ${product.sort || 0} / الوسم: <span class="tag-badge tag-${product.category || 'oud'}">${product.tag}</span> / النوتات: ${product.notes}</p>
          <p style="margin: 4px 0 0; font-size: 13px; color: var(--accent-teal);">
            سعر الزجاجة: ${bottle} ج | سعر الزيت: ${oil} ج | مواصلات: ${transport} ج | <strong>صافي ربح الـ 30مل: ${profit} ج</strong>
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


// Render Orders table list with search and filters
function renderOrders() {
  if (!ordersList) return;
  ordersList.innerHTML = "";
  
  const searchVal = document.querySelector("#orders-search")?.value.trim().toLowerCase() || "";
  const statusVal = document.querySelector("#orders-filter-status")?.value || "all";
  const dateVal = document.querySelector("#orders-filter-date")?.value || "all";
  
  let filtered = [...orders];

  // 1. Text Search
  if (searchVal) {
    filtered = filtered.filter(o => 
      (o.customerName && o.customerName.toLowerCase().includes(searchVal)) ||
      (o.phone && o.phone.includes(searchVal)) ||
      (o.id && o.id.toLowerCase().includes(searchVal))
    );
  }

  // 2. Status Filter
  if (statusVal !== "all") {
    filtered = filtered.filter(o => o.status === statusVal);
  }

  // 3. Date Filter
  if (dateVal !== "all") {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    
    filtered = filtered.filter(o => {
      if (!o.createdAt) return false;
      const oDate = new Date(o.createdAt);
      const oDateStr = o.createdAt.split("T")[0];
      
      if (dateVal === "today") {
        return oDateStr === todayStr;
      } else if (dateVal === "week") {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return oDate >= oneWeekAgo;
      } else if (dateVal === "month") {
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return oDate >= oneMonthAgo;
      }
      return true;
    });
  }

  // Update badge count
  const countBadge = document.querySelector("#orders-count-badge");
  if (countBadge) {
    countBadge.textContent = `عدد النتائج: ${filtered.length} طلب`;
  }

  if (filtered.length === 0) {
    ordersList.innerHTML = '<tr><td colspan="8" style="text-align:center;">لا توجد طلبات تطابق الفلاتر المحددة.</td></tr>';
    return;
  }

  filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  filtered.forEach((order) => {
    const tr = document.createElement("tr");
    
    const itemsText = order.items.map(item => `${item.name} (×${item.quantity})`).join("، ");
    const formattedDate = new Date(order.createdAt).toLocaleString("ar-EG");

    // Format WhatsApp Link
    let cleanPhone = order.phone.trim();
    if (cleanPhone.startsWith("0")) {
      cleanPhone = "2" + cleanPhone;
    } else if (!cleanPhone.startsWith("20") && !cleanPhone.startsWith("+")) {
      cleanPhone = "20" + cleanPhone;
    }
    const waText = encodeURIComponent(`السلام عليكم يا أ/ ${order.customerName}، بنأكد مع حضرتك طلبك من متجر العطور ZYCORE:\n${order.items.map(i => `- ${i.name} (عدد ${i.quantity} بسعر ${i.price}ج)`).join("\n")}\nإجمالي الحساب: ${order.total} جنيه.`);
    const waUrl = `https://wa.me/${cleanPhone}?text=${waText}`;

    // Delivery notes and internal note badges
    const internalNoteHtml = order.internalNote 
      ? `<div style="font-size:11px; color:#f59e0b; margin-top:4px; padding:2px 6px; background:rgba(245,158,11,0.1); border:1px dashed rgba(245,158,11,0.3); border-radius:4px; display:block;">📝 ملاحظة أدمن: ${order.internalNote}</div>` 
      : "";
    const notesHtml = order.notes 
      ? `<div style="font-size:11px; color:var(--muted); margin-top:2px;">📍 عنوان/ملاحظات: ${order.notes}</div>` 
      : "";

    tr.innerHTML = `
      <td><code>${order.id}</code></td>
      <td>
        <strong>${order.customerName}</strong>
        ${notesHtml}
      </td>
      <td>
        <div style="display:flex; flex-direction:column; gap:4px;">
          <a href="tel:${order.phone}" style="color:var(--muted); font-size:13px;">${order.phone}</a>
          <a href="${waUrl}" target="_blank" class="small-action" style="background:#25d366; color:#fff; text-align:center; padding:2px 6px; text-decoration:none; font-size:11px; border-radius:4px; display:inline-block; border:none; width:fit-content;">💬 واتساب</a>
        </div>
      </td>
      <td>
        <span style="font-size:13px; color:var(--muted);">${itemsText}</span>
        ${internalNoteHtml}
      </td>
      <td><strong>${order.total} جنيه</strong></td>
      <td><span style="font-size: 13px;">${formattedDate}</span></td>
      <td>
        <select class="status-pill status-${order.status}" data-order-status-id="${order.id}">
          <option value="new" ${order.status === "new" ? "selected" : ""}>جديد</option>
          <option value="preparing" ${order.status === "preparing" ? "selected" : ""}>قيد التجهيز</option>
          <option value="done" ${order.status === "done" ? "selected" : ""}>تم التوصيل</option>
          <option value="cancelled" ${order.status === "cancelled" ? "selected" : ""}>ملغي</option>
        </select>
      </td>
      <td>
        <div style="display:flex; gap:4px;">
          <button class="small-action" type="button" data-edit-order="${order.id}" style="min-height:30px; padding:4px 8px;">✏️</button>
          <button class="small-action" type="button" data-print-order="${order.id}" style="min-height:30px; padding:4px 8px; background:var(--accent-teal);">🖨️</button>
        </div>
      </td>
    `;
    ordersList.appendChild(tr);
  });
}

// Print Bill Invoice Helper
function printOrderInvoice(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (!order) return;
  
  const printArea = document.querySelector("#invoice-print-area");
  if (!printArea) return;
  
  const formattedDate = new Date(order.createdAt).toLocaleString("ar-EG");
  const itemsRows = order.items.map(item => `
    <tr>
      <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${item.name}</td>
      <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.quantity}</td>
      <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.price} ج</td>
      <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.price * item.quantity} ج</td>
    </tr>
  `).join("");

  printArea.innerHTML = `
    <div style="direction: rtl; font-family: 'Cairo', sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; color: #000; background: #fff;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2ea39f; padding-bottom: 12px; margin-bottom: 20px;">
        <div>
          <h1 style="margin: 0; color: #2ea39f; font-size: 24px;">ZYCORE PERFUMES</h1>
          <p style="margin: 4px 0 0; font-size: 13px; color: #666;">عطور فاخرة تليق بك</p>
        </div>
        <div style="text-align: left;">
          <h2 style="margin: 0; font-size: 18px;">فاتورة مبيعات</h2>
          <p style="margin: 4px 0 0; font-size: 12px; color: #666;">كود الطلب: ${order.id}</p>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; font-size: 14px;">
        <div style="border: 1px solid #eee; padding: 12px; border-radius: 6px;">
          <h3 style="margin: 0 0 8px; color: #2ea39f;">بيانات العميل:</h3>
          <p style="margin: 4px 0;"><strong>الاسم:</strong> ${order.customerName}</p>
          <p style="margin: 4px 0;"><strong>الهاتف:</strong> ${order.phone}</p>
          ${order.notes ? `<p style="margin: 4px 0;"><strong>العنوان/ملاحظات:</strong> ${order.notes}</p>` : ""}
        </div>
        <div style="border: 1px solid #eee; padding: 12px; border-radius: 6px; text-align: left; direction: ltr;">
          <h3 style="margin: 0 0 8px; color: #2ea39f; text-align: right; direction: rtl;">تفاصيل الفاتورة:</h3>
          <p style="margin: 4px 0; direction: rtl; text-align: right;"><strong>التاريخ:</strong> ${formattedDate}</p>
          <p style="margin: 4px 0; direction: rtl; text-align: right;"><strong>حالة الطلب:</strong> تم التأكيد</p>
        </div>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
        <thead>
          <tr style="background-color: #f8f8f8;">
            <th style="border: 1px solid #ddd; padding: 10px; text-align: right; color: #2ea39f;">المنتج</th>
            <th style="border: 1px solid #ddd; padding: 10px; text-align: center; color: #2ea39f; width: 80px;">الكمية</th>
            <th style="border: 1px solid #ddd; padding: 10px; text-align: center; color: #2ea39f; width: 100px;">السعر</th>
            <th style="border: 1px solid #ddd; padding: 10px; text-align: center; color: #2ea39f; width: 120px;">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>
      
      <div style="display: flex; justify-content: flex-end; font-size: 16px; margin-top: 12px;">
        <div style="width: 250px; border-top: 2px solid #2ea39f; padding-top: 10px;">
          <div style="display: flex; justify-content: space-between; font-weight: bold; padding: 4px 0;">
            <span>الإجمالي النهائي:</span>
            <span style="color:#2ea39f;">${order.total} جنيه</span>
          </div>
        </div>
      </div>

      <div style="text-align: center; margin-top: 40px; border-top: 1px solid #eee; padding-top: 12px; font-size: 12px; color: #888;">
        شكراً لتسوقكم معنا من ZYCORE PERFUMES! ❤️
      </div>
    </div>
  `;
  
  window.print();
}

// Render Dashboard Overview sections (filtered by month/year if selected)
function renderDashboardOverview() {
  const recentOrdersList = document.querySelector("[data-recent-orders-list]");
  const topPerfumesList = document.querySelector("[data-top-perfumes-list]");
  
  let filteredOrders = [...orders];
  if (currentMonthFilter !== "all") {
    filteredOrders = orders.filter(o => o.createdAt && o.createdAt.startsWith(currentMonthFilter));
  }
  
  if (recentOrdersList) {
    recentOrdersList.innerHTML = "";
    const sortedOrders = [...filteredOrders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const recentOrders = sortedOrders.slice(0, 5);
    
    if (recentOrders.length === 0) {
      recentOrdersList.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px 0;">لا توجد طلبات مسجلة في هذه الفترة.</td></tr>';
    } else {
      recentOrders.forEach(order => {
        const tr = document.createElement("tr");
        let statusText = "جديد";
        let statusColor = "var(--accent-gold)";
        if (order.status === "preparing") { statusText = "قيد التجهيز"; statusColor = "var(--accent-teal)"; }
        else if (order.status === "done") { statusText = "تم التوصيل"; statusColor = "#25d366"; }
        else if (order.status === "cancelled") { statusText = "ملغي"; statusColor = "var(--accent-burgundy)"; }

        tr.innerHTML = `
          <td><strong>${order.customerName}</strong></td>
          <td><a href="tel:${order.phone}" style="color: var(--accent-gold);">${order.phone}</a></td>
          <td><strong>${order.total} جنيه</strong></td>
          <td><span style="color: ${statusColor}; font-weight: 800;">${statusText}</span></td>
        `;
        recentOrdersList.appendChild(tr);
      });
    }
  }

  if (topPerfumesList) {
    topPerfumesList.innerHTML = "";
    const counts = {};
    const activeOrders = filteredOrders.filter(o => o.status !== "cancelled");
    
    activeOrders.forEach(order => {
      order.items.forEach(item => {
        const cleanName = item.name.split(" (")[0].split(" - ")[0].trim();
        counts[cleanName] = (counts[cleanName] || 0) + item.quantity;
      });
    });

    const topSelling = Object.entries(counts)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    if (topSelling.length === 0) {
      topPerfumesList.innerHTML = '<p class="empty" style="text-align:center; color:var(--muted); margin: 20px 0;">لا توجد إحصائيات بيع متوفرة بعد.</p>';
    } else {
      topSelling.forEach(item => {
        const div = document.createElement("div");
        div.className = "top-perfume-item";
        div.innerHTML = `
          <span class="top-perfume-name">${item.name}</span>
          <span class="top-perfume-count">${item.qty} زجاجات مباعة</span>
        `;
        topPerfumesList.appendChild(div);
      });
    }
  }
}

// 7-day trailing chart using Chart.js CDN
function renderSalesChart() {
  const ctx = document.getElementById("sales-chart")?.getContext("2d");
  if (!ctx) return;
  
  const now = new Date();
  const days = [];
  const salesMap = {};
  
  // Get trailing 7 dates
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split("T")[0];
    const labelStr = `${d.getDate()} / ${d.getMonth() + 1}`;
    days.push({ key: dateStr, label: labelStr });
    salesMap[dateStr] = 0;
  }
  
  // Aggregate sales
  orders.forEach(order => {
    if (order.status !== "cancelled" && order.createdAt) {
      const dateKey = order.createdAt.split("T")[0];
      if (salesMap[dateKey] !== undefined) {
        salesMap[dateKey] += order.total || 0;
      }
    }
  });
  
  const labels = days.map(d => d.label);
  const data = days.map(d => salesMap[d.key]);
  
  const periodLabel = document.querySelector("#chart-period-label");
  if (periodLabel) {
    periodLabel.textContent = `من ${days[0].label} إلى ${days[6].label}`;
  }
  
  if (salesChartInstance) {
    salesChartInstance.destroy();
  }
  
  // Neon glowing gradient fill
  const chartGradient = ctx.createLinearGradient(0, 0, 0, 240);
  chartGradient.addColorStop(0, "rgba(54, 181, 176, 0.45)");
  chartGradient.addColorStop(1, "rgba(54, 181, 176, 0.0)");

  salesChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: "المبيعات اليومية (جنيه)",
        data: data,
        borderColor: "#36b5b0",
        backgroundColor: chartGradient,
        borderWidth: 3,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: "#e5b869",
        pointBorderColor: "#120d0b",
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 8,
        pointHoverBackgroundColor: "#fff",
        pointHoverBorderColor: "#36b5b0",
        pointHoverBorderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#a69b90", font: { family: "Cairo", weight: 'bold' } }
        },
        y: {
          grid: { color: "rgba(212, 163, 75, 0.05)" },
          ticks: { color: "#a69b90", font: { family: "Cairo", weight: 'bold' } },
          beginAtZero: true
        }
      }
    }
  });
}

// Render Purchases list in table
function renderPurchases() {
  const purchasesList = document.querySelector("[data-purchases-list]");
  if (!purchasesList) return;

  purchasesList.innerHTML = "";
  const filterCat = document.querySelector("#purchase-filter-category")?.value || "all";
  
  const filtered = purchases.filter(p => {
    return filterCat === "all" || p.category === filterCat;
  });

  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (filtered.length === 0) {
    purchasesList.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 20px 0;">لا توجد مشتريات مسجلة حالياً.</td></tr>';
    return;
  }

  const categoryNames = {
    oil: "زيوت عطرية",
    bottle: "زجاجات فارغة",
    cap: "أغطية وبخاخات",
    box: "علب وتغليف",
    alcohol: "كحول ومذيبات",
    other: "مصاريف أخرى"
  };

  filtered.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span style="font-size:13px; white-space:nowrap;">${p.date}</span></td>
      <td><strong>${p.itemName}</strong></td>
      <td><span class="tag" style="background:rgba(255,255,255,0.05); font-size: 11px;">${categoryNames[p.category] || p.category}</span></td>
      <td><span>${p.supplier || "-"}</span></td>
      <td><strong>${p.quantity}</strong></td>
      <td><span>${p.unitPrice} ج</span></td>
      <td><strong style="color:var(--accent-burgundy);">${p.totalPrice} جنيه</strong></td>
      <td><span style="font-size:13px; color:var(--muted);">${p.notes || "-"}</span></td>
      <td>
        <button class="danger-action" type="button" data-delete-purchase="${p.id}" style="min-height:30px; padding: 4px 10px;">حذف</button>
      </td>
    `;
    purchasesList.appendChild(tr);
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
    renderOrders();
    if (window.showToast) window.showToast("تم تحديث حالة الطلب بنجاح ✨", "success");
  } catch (err) {
    if (window.showToast) window.showToast(err.message, "error");
  }
});

function switchTab(tabId) {
  navButtons.forEach(b => {
    b.classList.toggle("active", b.dataset.tab === tabId);
  });
  tabContents.forEach(tc => {
    tc.classList.toggle("is-hidden", tc.id !== `tab-${tabId}`);
  });
}

function fillForm(product) {
  productForm.elements.id.value = product.id;
  productForm.elements.name.value = product.name;
  productForm.elements.category.value = product.category;
  productForm.elements.volume.value = product.volume || "30ml";
  productForm.elements.price30.value = product.price30 || 0;
  productForm.elements.price50.value = product.price50 || 0;
  productForm.elements.price100.value = product.price100 || 0;
  productForm.elements.price.value = product.price || 0;
  productForm.elements.bottlePrice.value = product.bottlePrice || 0;
  productForm.elements.oilPrice.value = product.oilPrice || 0;
  productForm.elements.transportCost.value = product.transportCost || 0;
  productForm.elements.tag.value = product.tag;
  productForm.elements.tone.value = product.tone;
  productForm.elements.sort.value = product.sort || 1;
  productForm.elements.featured.checked = !!product.featured;
  productForm.elements.notes.value = product.notes;
  productForm.elements.image.value = product.image || "";

  const titleEl = document.querySelector("[data-product-editor-title]");
  if (titleEl) {
    titleEl.textContent = `تعديل عطر: ${product.name}`;
  }

  if (product.image) {
    imagePreview.src = API_BASE ? `${API_BASE}/images/products/${product.image}` : `./images/products/${product.image}`;
    imagePreview.classList.remove("is-hidden");
  } else {
    imagePreview.classList.add("is-hidden");
  }

  updateProfitPreview();
  switchTab("add-product");
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
  productForm.elements.price30.value = 0;
  productForm.elements.price50.value = 0;
  productForm.elements.price100.value = 0;
  productForm.elements.price.value = 0;
  
  const titleEl = document.querySelector("[data-product-editor-title]");
  if (titleEl) {
    titleEl.textContent = "إضافة منتج عطر جديد";
  }

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
  product.price30 = Number(product.price30 || 0);
  product.price50 = Number(product.price50 || 0);
  product.price100 = Number(product.price100 || 0);
  product.price = Number(product.price || 0);
  product.bottlePrice = Number(product.bottlePrice || 0);
  product.oilPrice = Number(product.oilPrice || 0);
  product.transportCost = Number(product.transportCost || 0);

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
    switchTab("products");
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
  const price = Number(productForm.elements.price30.value || productForm.elements.price.value || 0);
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
  if (productForm.elements.price30) productForm.elements.price30.addEventListener(evtName, updateProfitPreview);
  if (productForm.elements.price50) productForm.elements.price50.addEventListener(evtName, updateProfitPreview);
  if (productForm.elements.price100) productForm.elements.price100.addEventListener(evtName, updateProfitPreview);
  if (productForm.elements.price) productForm.elements.price.addEventListener(evtName, updateProfitPreview);
  productForm.elements.bottlePrice.addEventListener(evtName, updateProfitPreview);
  productForm.elements.oilPrice.addEventListener(evtName, updateProfitPreview);
  productForm.elements.transportCost.addEventListener(evtName, updateProfitPreview);
});

// Switch tab to add product
const goToAddProductBtn = document.querySelector("[data-go-to-add-product]");
if (goToAddProductBtn) {
  goToAddProductBtn.addEventListener("click", () => {
    resetForm();
    switchTab("add-product");
  });
}

// Purchases Screen Event Listeners
const purchaseForm = document.querySelector("#purchase-form");
const purchaseMessage = document.querySelector("#purchase-message");
if (purchaseForm) {
  const dateInput = document.querySelector("#p-date");
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

  purchaseForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const itemName = document.querySelector("#p-itemName").value.trim();
    const category = document.querySelector("#p-category").value;
    const supplier = document.querySelector("#p-supplier").value.trim();
    const quantity = Number(document.querySelector("#p-quantity").value) || 0;
    const unitPrice = Number(document.querySelector("#p-unitPrice").value) || 0;
    const date = document.querySelector("#p-date").value;
    const notes = document.querySelector("#p-notes").value.trim();

    try {
      await api("/api/purchases", {
        method: "POST",
        body: JSON.stringify({ itemName, category, supplier, quantity, unitPrice, date, notes })
      });
      setMessage(purchaseMessage, "تم تسجيل فاتورة الشراء بنجاح!");
      if (window.showToast) window.showToast("تم تسجيل الشراء بنجاح ✨", "success");
      purchaseForm.reset();
      if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
      await loadDashboard();
    } catch (err) {
      setMessage(purchaseMessage, err.message, true);
      if (window.showToast) window.showToast(err.message, "error");
    }
  });
}

const purchaseFilter = document.querySelector("#purchase-filter-category");
if (purchaseFilter) {
  purchaseFilter.addEventListener("change", renderPurchases);
}

const purchasesTableBody = document.querySelector("[data-purchases-list]");
if (purchasesTableBody) {
  purchasesTableBody.addEventListener("click", async (e) => {
    const deleteId = e.target.dataset.deletePurchase;
    if (!deleteId) return;

    const ok = await customConfirm("هل تريد بالتأكيد حذف سجل الشراء هذا؟");
    if (!ok) return;

    try {
      await api(`/api/purchases/${encodeURIComponent(deleteId)}`, { method: "DELETE" });
      if (window.showToast) window.showToast("تم حذف سجل الشراء بنجاح 🗑️", "success");
      await loadDashboard();
    } catch (err) {
      if (window.showToast) window.showToast(err.message, "error");
    }
  });
}

// =============================================
// ORDER EDIT MODAL LOGIC WITH INTERNAL NOTE
// =============================================
const orderEditModal = document.querySelector("#order-edit-modal");
const orderEditForm = document.querySelector("#order-edit-form");
const editItemsContainer = document.querySelector("#edit-items-container");
const editOrderTotal = document.querySelector("#edit-order-total");
const orderEditMessage = document.querySelector("#order-edit-message");

function updateEditTotal() {
  const rows = editItemsContainer.querySelectorAll(".edit-item-row");
  let total = 0;
  rows.forEach(row => {
    const qty = Number(row.querySelector(".edit-qty").value) || 0;
    const price = Number(row.querySelector(".edit-price").value) || 0;
    total += qty * price;
  });
  editOrderTotal.textContent = `${total} جنيه`;
}

function buildItemRow(item) {
  const div = document.createElement("div");
  div.className = "edit-item-row";
  div.style.cssText = "display:grid; grid-template-columns:2fr 1fr 1fr 1fr auto; gap:8px; align-items:center; background:rgba(255,255,255,0.04); border-radius:8px; padding:10px;";
  
  // Product select
  const sel = document.createElement("select");
  sel.className = "edit-product-select";
  sel.style.cssText = "font-size:13px;";
  products.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    if (p.id === item.id) opt.selected = true;
    sel.appendChild(opt);
  });

  // Size select
  const sizeEl = document.createElement("select");
  sizeEl.className = "edit-size-select";
  sizeEl.style.cssText = "font-size:13px;";
  ["30ml","50ml","100ml"].forEach(s => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    if ((item.size || "30ml") === s) opt.selected = true;
    sizeEl.appendChild(opt);
  });

  // Qty
  const qtyEl = document.createElement("input");
  qtyEl.type = "number";
  qtyEl.className = "edit-qty";
  qtyEl.min = 1;
  qtyEl.max = 50;
  qtyEl.value = item.quantity || 1;
  qtyEl.style.cssText = "font-size:13px; text-align:center;";

  // Price
  const priceEl = document.createElement("input");
  priceEl.type = "number";
  priceEl.className = "edit-price";
  priceEl.min = 0;
  priceEl.value = item.price || 0;
  priceEl.style.cssText = "font-size:13px; text-align:center;";
  priceEl.title = "سعر البيع";

  // Auto-fill price when product/size changes
  function autoFillPrice() {
    const prod = products.find(p => p.id === sel.value);
    if (!prod) return;
    const sz = sizeEl.value;
    let p = 0;
    if (sz === "30ml") p = prod.price30 || prod.price || 0;
    else if (sz === "50ml") p = prod.price50 || prod.price || 0;
    else if (sz === "100ml") p = prod.price100 || prod.price || 0;
    priceEl.value = p;
    updateEditTotal();
  }
  sel.addEventListener("change", autoFillPrice);
  sizeEl.addEventListener("change", autoFillPrice);

  // Remove btn
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.textContent = "🗑️";
  removeBtn.style.cssText = "background:var(--accent-burgundy); border:none; border-radius:6px; color:#fff; cursor:pointer; padding:6px 8px; font-size:13px;";
  removeBtn.title = "حذف هذا المنتج من الطلب";
  removeBtn.addEventListener("click", () => {
    div.remove();
    updateEditTotal();
  });

  qtyEl.addEventListener("input", updateEditTotal);
  priceEl.addEventListener("input", updateEditTotal);

  div.appendChild(sel);
  div.appendChild(sizeEl);
  div.appendChild(qtyEl);
  div.appendChild(priceEl);
  div.appendChild(removeBtn);
  return div;
}

function openOrderEditModal(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  document.querySelector("#edit-order-id").value = order.id;
  document.querySelector("#edit-customer-name").value = order.customerName;
  document.querySelector("#edit-phone").value = order.phone;
  document.querySelector("#edit-notes").value = order.notes || "";
  document.querySelector("#edit-internal-note").value = order.internalNote || "";
  if (orderEditMessage) orderEditMessage.textContent = "";

  editItemsContainer.innerHTML = "";
  order.items.forEach(item => {
    editItemsContainer.appendChild(buildItemRow(item));
  });
  updateEditTotal();
  orderEditModal.showModal();
}

// Listen for edit and print button clicks in the orders list
if (ordersList) {
  ordersList.addEventListener("click", (e) => {
    const editId = e.target.closest("[data-edit-order]")?.dataset.editOrder;
    const printId = e.target.closest("[data-print-order]")?.dataset.printOrder;
    
    if (editId) openOrderEditModal(editId);
    if (printId) printOrderInvoice(printId);
  });
}

// Add new item button inside edit modal
document.querySelector("#add-edit-item-btn").addEventListener("click", () => {
  if (products.length === 0) return;
  const firstProd = products[0];
  editItemsContainer.appendChild(buildItemRow({ id: firstProd.id, size: "30ml", quantity: 1, price: firstProd.price30 || firstProd.price || 0 }));
  updateEditTotal();
});

// Close modal
document.querySelector("#close-order-edit-btn").addEventListener("click", () => orderEditModal.close());

// Submit order edit
orderEditForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.querySelector("#edit-order-id").value;
  const customerName = document.querySelector("#edit-customer-name").value.trim();
  const phone = document.querySelector("#edit-phone").value.trim();
  const notes = document.querySelector("#edit-notes").value.trim();
  const internalNote = document.querySelector("#edit-internal-note").value.trim();

  const rows = editItemsContainer.querySelectorAll(".edit-item-row");
  const items = [];
  rows.forEach(row => {
    const prodId = row.querySelector(".edit-product-select").value;
    const prod = products.find(p => p.id === prodId);
    const size = row.querySelector(".edit-size-select").value;
    const quantity = Number(row.querySelector(".edit-qty").value);
    const price = Number(row.querySelector(".edit-price").value);
    if (prod && quantity > 0) {
      items.push({
        id: prod.id,
        name: `${prod.name} (${size})`,
        size,
        quantity,
        price
      });
    }
  });

  if (items.length === 0) {
    if (orderEditMessage) orderEditMessage.textContent = "يجب إضافة منتج واحد على الأقل";
    return;
  }

  try {
    await api(`/api/orders/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify({ customerName, phone, notes, internalNote, items })
    });
    orderEditModal.close();
    if (window.showToast) window.showToast("تم تعديل الطلب بنجاح ✨", "success");
    await loadDashboard();
  } catch (err) {
    if (orderEditMessage) orderEditMessage.textContent = err.message;
    if (window.showToast) window.showToast(err.message, "error");
  }
});

// =============================================
// SEARCH & FILTERS ON ORDERS TAB
// =============================================
const ordersSearch = document.querySelector("#orders-search");
const ordersFilterStatus = document.querySelector("#orders-filter-status");
const ordersFilterDate = document.querySelector("#orders-filter-date");

if (ordersSearch) ordersSearch.addEventListener("input", renderOrders);
if (ordersFilterStatus) ordersFilterStatus.addEventListener("change", renderOrders);
if (ordersFilterDate) ordersFilterDate.addEventListener("change", renderOrders);

// =============================================
// DASHBOARD MONTH FILTER LISTENER
// =============================================
const dashMonthFilter = document.querySelector("#dash-month-filter");
if (dashMonthFilter) {
  dashMonthFilter.addEventListener("change", (e) => {
    currentMonthFilter = e.target.value;
    calculateStats();
    renderDashboardOverview();
  });
}

const dashAllTimeBtn = document.querySelector("#dash-all-time-btn");
if (dashAllTimeBtn) {
  dashAllTimeBtn.addEventListener("click", () => {
    currentMonthFilter = "all";
    if (dashMonthFilter) dashMonthFilter.value = "all";
    calculateStats();
    renderDashboardOverview();
  });
}

// =============================================
// BACKUP & RESTORE LOGIC
// =============================================
const backupBtn = document.querySelector("#backup-btn");
if (backupBtn) {
  backupBtn.addEventListener("click", async () => {
    try {
      const token = localStorage.getItem("admin_token");
      const headers = token ? { "Authorization": `Bearer ${token}` } : {};
      
      const response = await fetch("/api/backup", { headers });
      if (!response.ok) throw new Error("فشل تصدير النسخة الاحتياطية");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `zycore-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      if (window.showToast) window.showToast("تم تحميل النسخة الاحتياطية بنجاح 📥", "success");
    } catch (err) {
      if (window.showToast) window.showToast(err.message, "error");
    }
  });
}

const restoreFileInput = document.querySelector("#restore-file-input");
if (restoreFileInput) {
  restoreFileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const ok = await customConfirm("⚠️ هل أنت متأكد من استعادة النسخة الاحتياطية؟ سيؤدي ذلك إلى استبدال كافة البيانات الحالية بالبيانات الموجودة في الملف!");
    if (!ok) {
      restoreFileInput.value = "";
      return;
    }
    
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const json = JSON.parse(evt.target.result);
        await api("/api/restore", {
          method: "POST",
          body: JSON.stringify(json)
        });
        if (window.showToast) window.showToast("تم استعادة البيانات بنجاح! جاري التحديث... 🔄", "success");
        setTimeout(() => window.location.reload(), 1500);
      } catch (err) {
        if (window.showToast) window.showToast("الملف غير صالح أو حدث خطأ أثناء الاستعادة: " + err.message, "error");
      }
    };
    reader.readAsText(file);
  });
}

// =============================================
// REAL-TIME NEW ORDER POLLING
// =============================================
let lastOrderCheckTime = new Date().toISOString();

function playNotificationSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const playBeep = (freq, duration, delay) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime + delay);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + delay + duration);
      osc.start(audioCtx.currentTime + delay);
      osc.stop(audioCtx.currentTime + delay + duration);
    };
    playBeep(523.25, 0.15, 0); // C5 beep
    playBeep(659.25, 0.25, 0.15); // E5 beep
  } catch (err) {
    console.error("Audio beep failed:", err);
  }
}

// Ask for browser notification permission on login/load
if (window.Notification && Notification.permission === "default") {
  Notification.requestPermission();
}

async function pollNewOrders() {
  const token = localStorage.getItem("admin_token");
  if (!token) return; // Only poll if logged in
  
  try {
    const response = await api(`/api/orders/count?since=${encodeURIComponent(lastOrderCheckTime)}`);
    // Update checkpoint time to prevent repeating alerts
    lastOrderCheckTime = new Date().toISOString();
    
    if (response.count > 0 && response.orders && response.orders.length > 0) {
      // 1. Play synthesizer alert sound
      playNotificationSound();
      
      // 2. Show browser push notification
      if (window.Notification && Notification.permission === "granted") {
        response.orders.forEach(order => {
          new Notification("🛍️ طلب جديد وارد في Zycore!", {
            body: `العميل: ${order.customerName} - الإجمالي: ${order.total}ج`,
            icon: "./images/products/amber-oud.png"
          });
        });
      }
      
      // 3. Show UI toast alerts
      response.orders.forEach(order => {
        if (window.showToast) {
          window.showToast(`🛍️ طلب جديد من ${order.customerName} بقيمة ${order.total}ج!`, "success");
        }
      });
      
      // 4. Reload dashboard statistics and lists
      await loadDashboard();
    }
  } catch (err) {
    console.warn("Polling error:", err);
  }
}

// Poll every 30 seconds
setInterval(pollNewOrders, 30000);

// =============================================
// SETTINGS FORM LOAD & SAVE
// =============================================
const settingsForm = document.querySelector("#settings-form");
if (settingsForm) {
  // Load settings when settings tab is opened
  navButtons.forEach(btn => {
    if (btn.dataset.tab === "settings") {
      btn.addEventListener("click", () => {
        const s = settings || {};
        const bottleEl = document.querySelector("#s-bottle");
        const capEl = document.querySelector("#s-cap");
        const boxEl = document.querySelector("#s-box");
        const alcoholEl = document.querySelector("#s-alcohol");
        const capitalEl = document.querySelector("#s-capital");
        if (bottleEl) bottleEl.value = s.defaultBottlePrice || 0;
        if (capEl) capEl.value = s.defaultCapPrice || 0;
        if (boxEl) boxEl.value = s.defaultBoxPrice || 0;
        if (alcoholEl) alcoholEl.value = s.defaultAlcoholPrice || 0;
        if (capitalEl) capitalEl.value = s.capitalFund || 0;
      });
    }
  });

  settingsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const settingsMessage = document.querySelector("#settings-message");
    const bottleEl = document.querySelector("#s-bottle");
    const capEl = document.querySelector("#s-cap");
    const boxEl = document.querySelector("#s-box");
    const alcoholEl = document.querySelector("#s-alcohol");
    const capitalEl = document.querySelector("#s-capital");

    const current = settings || {};
    const updated = {
      defaultBottlePrice: Number(bottleEl?.value || 0),
      defaultCapPrice: Number(capEl?.value || 0),
      defaultBoxPrice: Number(boxEl?.value || 0),
      defaultAlcoholPrice: Number(alcoholEl?.value || 0),
      capitalFund: Number(capitalEl?.value || 0),
      oilCompanies: current.oilCompanies || []
    };

    try {
      settings = await api("/api/settings", { method: "PUT", body: JSON.stringify(updated) });
      if (settingsMessage) setMessage(settingsMessage, "تم حفظ الإعدادات بنجاح ✅");
      if (window.showToast) window.showToast("تم حفظ رأس المال والإعدادات بنجاح ✨", "success");
      calculateStats();
    } catch (err) {
      if (settingsMessage) setMessage(settingsMessage, err.message, true);
      if (window.showToast) window.showToast(err.message, "error");
    }
  });
}

resetForm();
loadSession();

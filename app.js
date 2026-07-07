const API_BASE = '';
const WHATSAPP_PHONE = "201022869475";
const CART_STORAGE_KEY = "zycore_cart";
let products = [];

const fallbackProducts = [
  {
    id: "amber-oud",
    name: "Amber Oud",
    category: "oud",
    volume: "90ml",
    notes: "عود هادئ، عنبر دافئ، ولمسة فانيليا ناعمة.",
    tag: "مسائي",
    price: 1450,
    tone: "rgba(199, 125, 53, 0.32)",
    image: "amber-oud.png",
    featured: true,
    sort: 1
  },
  {
    id: "fresh-linen",
    name: "Fresh Linen",
    category: "fresh",
    volume: "75ml",
    notes: "حمضيات، شاي أبيض، ونهاية نظيفة مناسبة لكل يوم.",
    tag: "نهاري",
    price: 980,
    tone: "rgba(31, 119, 116, 0.22)",
    image: "fresh-linen.png",
    featured: true,
    sort: 2
  },
];

const state = {
  filter: "all",
  query: "",
  cart: JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]"),
  wishlist: JSON.parse(localStorage.getItem("wishlist") || "[]"),
  sort: "default",
  maxPrice: 2000,
};

const productGrid = document.querySelector("[data-product-grid]");
const searchInput = document.querySelector("[data-search]");
const filterButtons = document.querySelectorAll("[data-filter]");
const cartItems = document.querySelector("[data-cart-items]");
const totalEl = document.querySelector("[data-total]");
const cartCount = document.querySelector("[data-cart-count]");
const template = document.querySelector("#product-card-template");
const themeToggleBtn = document.querySelector("[data-theme-toggle]");
const htmlEl = document.documentElement;

// Drawer & Dialog elements
const cartDrawer = document.querySelector("#cart-drawer");
const cartDrawerOverlay = document.querySelector("#cart-drawer-overlay");
const closeDrawerBtn = document.querySelector("[data-close-drawer]");
const checkoutBtn = document.querySelector("[data-checkout]");
const checkoutModal = document.querySelector("#checkout-modal");
const closeModalBtn = document.querySelector("[data-close-modal]");
const checkoutForm = document.querySelector("#checkout-form");
const whatsappBtn = document.querySelector("[data-submit-whatsapp]");
const priceRange = document.querySelector("[data-price-range]");
const priceLabel = document.querySelector("[data-price-label]");
const productDetailModal = document.querySelector("#product-detail-modal");
const detailCloseBtn = document.querySelector("[data-detail-close]");
const detailImage = document.querySelector("[data-detail-image]");
const detailBadge = document.querySelector("[data-detail-badge]");
const detailName = document.querySelector("[data-detail-name]");
const detailMeta = document.querySelector("[data-detail-meta]");
const detailNotes = document.querySelector("[data-detail-notes]");
const detailPrice = document.querySelector("[data-detail-price]");
const detailAddBtn = document.querySelector("[data-detail-add]");

// Wishlist & Sorting elements
const wishlistCount = document.querySelector("[data-wishlist-count]");
const wishlistJump = document.querySelector("[data-filter-wishlist]");
const sortSelect = document.querySelector("[data-sort-select]");

let isWhatsAppSubmit = false;
let activeDetailProductId = "";

const formatter = new Intl.NumberFormat("ar-EG");

function money(value) {
  return `${formatter.format(value)} جنيه`;
}

function saveCart() {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.cart));
}

function updatePriceLabel() {
  if (priceLabel) {
    priceLabel.textContent = `حتى ${money(state.maxPrice)}`;
  }
}

function syncCartWithProducts() {
  if (!products.length || !state.cart.length) return;
  state.cart = state.cart
    .map((cartItem) => {
      const freshProduct = products.find((product) => (product.id || product.name) === (cartItem.id || cartItem.name));
      if (!freshProduct) return null;
      return { ...freshProduct, quantity: Math.max(1, Number(cartItem.quantity) || 1) };
    })
    .filter(Boolean);
  saveCart();
}

// Dark Mode Toggle Logic
const savedTheme = localStorage.getItem("theme") || "light";
htmlEl.setAttribute("data-theme", savedTheme);
updateThemeToggleIcon(savedTheme);

if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", () => {
    const currentTheme = htmlEl.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    htmlEl.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    updateThemeToggleIcon(newTheme);
    if (window.showToast) {
      window.showToast(`تم تفعيل الوضع ${newTheme === "dark" ? "الداكن" : "المضيء"}`, "info");
    }
  });
}

function updateThemeToggleIcon(theme) {
  const iconEl = document.querySelector(".theme-icon");
  if (iconEl) {
    iconEl.textContent = theme === "dark" ? "☀️" : "🌙";
  }
}

// Cart Drawer open/close functions
function openDrawer() {
  cartDrawer.classList.add("is-active");
  cartDrawerOverlay.classList.add("is-active");
  document.body.style.overflow = "hidden";
}

function closeDrawer() {
  cartDrawer.classList.remove("is-active");
  cartDrawerOverlay.classList.remove("is-active");
  document.body.style.overflow = "";
}

if (closeDrawerBtn) {
  closeDrawerBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeDrawer();
  });
}

if (cartDrawerOverlay) {
  cartDrawerOverlay.addEventListener("click", (e) => {
    e.preventDefault();
    closeDrawer();
  });
}

// Bind all scroll-cart triggers and the nav cart link
const cartJumps = document.querySelectorAll("[data-scroll-cart], a[href='#cart']");
cartJumps.forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    openDrawer();
  });
});

// ESC key to close drawer and open dialogs
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeDrawer();
    if (checkoutModal && checkoutModal.open) checkoutModal.close();
    if (productDetailModal && productDetailModal.open) productDetailModal.close();
  }
});

// Wishlist functions
function updateWishlistUI() {
  if (wishlistCount) {
    wishlistCount.textContent = state.wishlist.length;
  }
}

function toggleWishlist(productId) {
  const index = state.wishlist.indexOf(productId);
  if (index > -1) {
    state.wishlist.splice(index, 1);
    if (window.showToast) window.showToast("تم إزالة العطر من المفضلة", "info");
  } else {
    state.wishlist.push(productId);
    if (window.showToast) window.showToast("تم إضافة العطر إلى المفضلة ❤️", "success");
  }
  localStorage.setItem("wishlist", JSON.stringify(state.wishlist));
  updateWishlistUI();
  
  if (state.filter === "wishlist") {
    renderProducts();
  } else {
    const cards = document.querySelectorAll(`[data-product="${productId}"]`);
    cards.forEach(card => {
      const heartBtn = card.querySelector("[data-wishlist-toggle]");
      if (heartBtn) {
        heartBtn.classList.toggle("is-active", state.wishlist.includes(productId));
      }
    });
  }
}

// Intersection Observer for scroll animations
function initScrollReveal() {
  const reveals = document.querySelectorAll(".product-card, .set-card, .drawer, .testimonial-card, .trust-strip > div, .offer-band");
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("active");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.05 });

  reveals.forEach((el) => {
    el.classList.add("reveal");
    observer.observe(el);
  });
}

async function loadProducts() {
  try {
    // Add artificial delay to appreciate the skeleton loader state
    await new Promise((resolve) => setTimeout(resolve, 800));
    const response = await fetch(`${API_BASE}/api/products`, { cache: "no-store" });
    if (!response.ok) throw new Error("API unavailable");
    products = await response.json();
  } catch {
    products = fallbackProducts;
  }
  const highestPrice = products.reduce((max, product) => Math.max(max, Number(product.price) || 0), 2000);
  const maxRange = Math.ceil(highestPrice / 50) * 50;
  state.maxPrice = Math.min(Number(priceRange?.value) || maxRange, maxRange);
  if (priceRange) {
    priceRange.max = String(maxRange);
    priceRange.value = String(state.maxPrice);
  }
  syncCartWithProducts();
  updatePriceLabel();
  renderProducts();
  renderCart();
  initScrollReveal();
}

function getVisibleProducts() {
  return products.filter((product) => {
    const matchesFilter = 
      state.filter === "all" || 
      (state.filter === "wishlist" && state.wishlist.includes(product.id || product.name)) ||
      product.category === state.filter;
      
    const text = `${product.name} ${product.notes} ${product.tag}`.toLowerCase();
    const matchesQuery = text.includes(state.query.trim().toLowerCase());
    const matchesPrice = Number(product.price) <= state.maxPrice;
    return matchesFilter && matchesQuery && matchesPrice;
  });
}

function getSortedProducts(visibleProducts) {
  const items = [...visibleProducts];
  if (state.sort === "price-asc") {
    items.sort((a, b) => a.price - b.price);
  } else if (state.sort === "price-desc") {
    items.sort((a, b) => b.price - a.price);
  } else if (state.sort === "name-asc") {
    items.sort((a, b) => a.name.localeCompare(b.name, "ar"));
  } else {
    items.sort((a, b) => (a.sort || 0) - (b.sort || 0));
  }
  return items;
}

function renderProducts() {
  productGrid.innerHTML = "";
  const visibleProducts = getVisibleProducts();

  if (visibleProducts.length === 0) {
    productGrid.innerHTML = '<p class="empty">لا توجد عطور مطابقة للبحث الحالي.</p>';
    return;
  }

  const sortedProducts = getSortedProducts(visibleProducts);

  sortedProducts.forEach((product) => {
    const card = template.content.firstElementChild.cloneNode(true);
    const prodId = product.id || product.name;
    card.dataset.product = prodId;
    card.querySelector("h3").textContent = product.name;
    card.querySelector(".volume").textContent = product.volume;
    card.querySelector(".notes").textContent = product.notes;
    card.querySelector(".tag").textContent = product.tag;
    card.querySelector(".price").textContent = money(product.price);

    const badge = card.querySelector(".featured-badge");
    if (badge) {
      badge.classList.toggle("is-visible", !!product.featured);
    }
    
    // Set Product image
    const imgEl = card.querySelector(".product-img");
    if (imgEl) {
      imgEl.src = product.image ? (API_BASE ? `${API_BASE}/images/products/${product.image}` : `./images/products/${product.image}`) : './images/products/amber-oud.png';
      imgEl.alt = product.name;
      imgEl.onerror = () => {
        imgEl.src = './images/products/amber-oud.png'; // safe fallback
      };
    }

    // Wishlist Toggle Event
    const heartBtn = card.querySelector("[data-wishlist-toggle]");
    if (heartBtn) {
      heartBtn.classList.toggle("is-active", state.wishlist.includes(prodId));
      heartBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleWishlist(prodId);
      });
    }

    card.querySelector(".add-button").addEventListener("click", () => {
      addToCart(prodId);
      if (window.showToast) {
        window.showToast(`تمت إضافة ${product.name} إلى السلة`, "success");
      }
    });

    const detailsBtn = card.querySelector("[data-product-details]");
    if (detailsBtn) {
      detailsBtn.addEventListener("click", () => openProductDetails(prodId));
    }

    productGrid.appendChild(card);
  });
}

function openProductDetails(productId) {
  const product = products.find((item) => (item.id || item.name) === productId);
  if (!product || !productDetailModal) return;

  activeDetailProductId = productId;
  if (detailImage) {
    detailImage.src = product.image ? (API_BASE ? `${API_BASE}/images/products/${product.image}` : `./images/products/${product.image}`) : "./images/products/amber-oud.png";
    detailImage.alt = product.name;
    detailImage.onerror = () => {
      detailImage.src = "./images/products/amber-oud.png";
    };
  }
  if (detailBadge) {
    detailBadge.classList.toggle("is-visible", !!product.featured);
  }
  if (detailName) detailName.textContent = product.name;
  if (detailMeta) detailMeta.textContent = `${product.volume} / ${product.tag}`;
  if (detailNotes) detailNotes.textContent = product.notes;
  if (detailPrice) detailPrice.textContent = money(product.price);

  productDetailModal.showModal();
}

if (detailCloseBtn) {
  detailCloseBtn.addEventListener("click", () => productDetailModal.close());
}

if (detailAddBtn) {
  detailAddBtn.addEventListener("click", () => {
    addToCart(activeDetailProductId);
    productDetailModal.close();
    openDrawer();
  });
}

function addToCart(productId) {
  const product = products.find((item) => (item.id || item.name) === productId);
  if (!product) return;

  const existing = state.cart.find((item) => (item.id || item.name) === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({ ...product, quantity: 1 });
  }

  saveCart();
  renderCart();
}

function renderCart() {
  cartItems.innerHTML = "";

  if (state.cart.length === 0) {
    cartItems.innerHTML = '<p class="empty">السلة فاضية حاليًا.</p>';
  } else {
    state.cart.forEach((item) => {
      const row = document.createElement("div");
      row.className = "cart-row";
      row.innerHTML = `
        <div>
          <strong>${item.name}</strong>
          <span>${money(item.price)}</span>
        </div>
        <div class="cart-row-actions">
          <button class="qty-btn" type="button" data-minus="${item.id || item.name}">-</button>
          <span>${item.quantity}</span>
          <button class="qty-btn" type="button" data-plus="${item.id || item.name}">+</button>
          <button class="remove-btn" type="button" data-remove="${item.id || item.name}" aria-label="حذف">&times;</button>
        </div>
        <strong>${money(item.quantity * item.price)}</strong>
      `;
      cartItems.appendChild(row);
    });
  }

  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = state.cart.reduce((sum, item) => sum + item.quantity * item.price, 0);
  cartCount.textContent = count;
  totalEl.textContent = money(total);
}

// Event delegation for cart actions (+, -, delete)
cartItems.addEventListener("click", (e) => {
  const plusId = e.target.dataset.plus;
  const minusId = e.target.dataset.minus;
  const removeId = e.target.dataset.remove;

  if (plusId) {
    const item = state.cart.find(i => (i.id || i.name) === plusId);
    if (item) {
      item.quantity += 1;
      saveCart();
      renderCart();
    }
  } else if (minusId) {
    const item = state.cart.find(i => (i.id || i.name) === minusId);
    if (item) {
      if (item.quantity > 1) {
        item.quantity -= 1;
      } else {
        state.cart = state.cart.filter(i => (i.id || i.name) !== minusId);
      }
      saveCart();
      renderCart();
    }
  } else if (removeId) {
    state.cart = state.cart.filter(i => (i.id || i.name) !== removeId);
    saveCart();
    renderCart();
    if (window.showToast) {
      window.showToast("تم حذف المنتج من السلة", "info");
    }
  }
});

// Category filtering click actions
filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    filterButtons.forEach((item) => item.classList.toggle("is-active", item === button));
    renderProducts();
  });
});

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderProducts();
});

// Sorting dropdown listener
if (sortSelect) {
  sortSelect.addEventListener("change", (e) => {
    state.sort = e.target.value;
    renderProducts();
  });
}

if (priceRange) {
  priceRange.addEventListener("input", (e) => {
    state.maxPrice = Number(e.target.value);
    updatePriceLabel();
    renderProducts();
  });
}

// Wishlist filter button click handler
if (wishlistJump) {
  wishlistJump.addEventListener("click", () => {
    state.filter = "wishlist";
    filterButtons.forEach(btn => btn.classList.remove("is-active"));
    renderProducts();
  });
}

// Checkout Modal toggle triggers
if (checkoutBtn) {
  checkoutBtn.addEventListener("click", () => {
    if (state.cart.length === 0) {
      if (window.showToast) window.showToast("ضيف عطر للسلة الأول.", "error");
      return;
    }
    checkoutModal.showModal();
  });
}

if (closeModalBtn) {
  closeModalBtn.addEventListener("click", () => {
    checkoutModal.close();
  });
}

// Submit via WhatsApp trigger
if (whatsappBtn) {
  whatsappBtn.addEventListener("click", () => {
    isWhatsAppSubmit = true;
    checkoutForm.requestSubmit();
  });
}

// Form submit to server with Egyptian phone validation and optional WhatsApp redirect
if (checkoutForm) {
  checkoutForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(checkoutForm);
    const customerName = formData.get("name").trim();
    const phone = formData.get("phone").trim();
    const notes = formData.get("notes").trim();

    // Validate phone structure
    const phoneRegex = /^01[0125]\d{8}$/;
    if (!phoneRegex.test(phone)) {
      if (window.showToast) window.showToast("يرجى إدخال رقم هاتف مصري صحيح (11 رقم)", "error");
      isWhatsAppSubmit = false;
      return;
    }

    const orderData = {
      customerName,
      phone,
      notes,
      items: state.cart.map(item => ({
        id: item.id,
        quantity: item.quantity
      }))
    };

    try {
      const response = await fetch(`${API_BASE}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(orderData)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "حدث خطأ أثناء حفظ الطلب");
      }

      if (window.showToast) {
        window.showToast("تم تأكيد وحفظ الطلب بنجاح! شكراً لك.", "success");
      }

      // If clicked WhatsApp, trigger redirect in new tab
      if (isWhatsAppSubmit) {
        const itemsText = state.cart.map(item => `- ${item.name} (×${item.quantity}) — ${money(item.quantity * item.price)}`).join("\n");
        const total = state.cart.reduce((sum, item) => sum + item.quantity * item.price, 0);
        const messageText = `مرحباً، عندي طلب من Zycore:\n\n${itemsText}\n\nالإجمالي: ${money(total)}\nالاسم: ${customerName}\nالتليفون: ${phone}${notes ? `\nملاحظات: ${notes}` : ""}`;
        const whatsappUrl = `https://wa.me/201022869475?text=${encodeURIComponent(messageText)}`;
        window.open(whatsappUrl, "_blank");
      }

      state.cart = [];
      saveCart();
      renderCart();
      checkoutForm.reset();
      checkoutModal.close();
      closeDrawer();

    } catch (err) {
      if (window.showToast) {
        window.showToast(err.message, "error");
      }
    } finally {
      isWhatsAppSubmit = false;
    }
  });
}

// Initialize UI States
updateWishlistUI();
loadProducts();
renderCart();

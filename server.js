const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 4173);
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@perfume.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123456";
const PUBLIC_DIR = __dirname;
const DATA_FILE = path.join(__dirname, "data", "products.json");
const ORDERS_FILE = path.join(__dirname, "data", "orders.json");
const IMAGES_DIR = path.join(__dirname, "images");
const PRODUCTS_IMAGE_DIR = path.join(IMAGES_DIR, "products");
const sessions = new Set();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml; charset=utf-8",
};

// Ensure directories exist
if (!fs.existsSync(path.join(__dirname, "data"))) {
  fs.mkdirSync(path.join(__dirname, "data"), { recursive: true });
}
if (!fs.existsSync(PRODUCTS_IMAGE_DIR)) {
  fs.mkdirSync(PRODUCTS_IMAGE_DIR, { recursive: true });
}

function readProducts() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, "[]\n", "utf8");
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeProducts(products) {
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(products, null, 2)}\n`, "utf8");
}

function readOrders() {
  try {
    if (!fs.existsSync(ORDERS_FILE)) {
      fs.writeFileSync(ORDERS_FILE, "[]\n", "utf8");
    }
    return JSON.parse(fs.readFileSync(ORDERS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeOrders(orders) {
  fs.writeFileSync(ORDERS_FILE, `${JSON.stringify(orders, null, 2)}\n`, "utf8");
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body is too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function getSession(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/(?:^|;\s*)perfume_session=([^;]+)/);
  return match ? match[1] : "";
}

function isLoggedIn(req) {
  return sessions.has(getSession(req));
}

function requireLogin(req, res) {
  if (isLoggedIn(req)) return true;
  sendJson(res, 401, { error: "Login required" });
  return false;
}

function makeId(name) {
  const base = String(name || "product")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "product"}-${Date.now().toString(36)}`;
}

function cleanProduct(input, currentId) {
  const price = Number(input.price);
  if (!input.name || !input.category || !input.volume || !input.notes || !input.tag || !Number.isFinite(price)) {
    throw new Error("Missing product fields");
  }

  return {
    id: currentId || makeId(input.name),
    name: String(input.name).trim(),
    category: String(input.category).trim(),
    volume: String(input.volume).trim(),
    notes: String(input.notes).trim(),
    tag: String(input.tag).trim(),
    price,
    tone: String(input.tone || "rgba(199, 125, 53, 0.32)").trim(),
    image: String(input.image || "").trim(),
    featured: !!input.featured,
    sort: Number.isFinite(Number(input.sort)) ? Number(input.sort) : 0,
  };
}

// Simple Rate Limiter for Orders
const orderRateLimits = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;
  if (!orderRateLimits.has(ip)) {
    orderRateLimits.set(ip, [now]);
    return false;
  }
  const timestamps = orderRateLimits.get(ip).filter(t => t > oneMinuteAgo);
  if (timestamps.length >= 30) {
    return true;
  }
  timestamps.push(now);
  orderRateLimits.set(ip, timestamps);
  return false;
}

// Binary upload helpers
function readBinaryBody(req, maxSize = 5242880) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    let byteLength = 0;
    req.on("data", (chunk) => {
      byteLength += chunk.length;
      if (byteLength > maxSize) {
        reject(new Error("File size exceeds limit (5MB)"));
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    req.on("error", (err) => {
      reject(err);
    });
  });
}

function getFileTypeFromMagicBytes(buffer) {
  if (buffer.length < 4) return null;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { mime: "image/jpeg", ext: ".jpg" };
  }
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return { mime: "image/png", ext: ".png" };
  }
  // WebP: RIFF ... WEBP
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && buffer.length >= 12) {
    const isWebP = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
    if (isWebP) {
      return { mime: "image/webp", ext: ".webp" };
    }
  }
  return null;
}

function sanitizeFilename(filename) {
  if (!filename || typeof filename !== "string") {
    filename = "upload.jpg";
  }
  const ext = path.extname(filename).toLowerCase();
  const base = path.basename(filename, ext)
    .replace(/[^a-z0-9_-]/gi, "_")
    .toLowerCase();
  return { base, ext };
}

// Order validation helper
function validateOrder(input) {
  if (!input.customerName || typeof input.customerName !== "string" || !input.customerName.trim()) {
    throw new Error("اسم العميل مطلوب");
  }
  if (!input.phone || typeof input.phone !== "string" || !input.phone.trim()) {
    throw new Error("رقم الهاتف مطلوب");
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error("يجب اختيار منتج واحد على الأقل");
  }
  for (const item of input.items) {
    if (!item.name || !item.quantity || !Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error("بيانات المنتجات في السلة غير صالحة");
    }
  }
  if (typeof input.total !== "number" || !Number.isFinite(input.total) || input.total <= 0) {
    throw new Error("إجمالي الطلب غير صالح");
  }
}

function cleanOrder(input) {
  validateOrder(input);
  return {
    id: `ord_${crypto.randomBytes(6).toString("hex")}`,
    customerName: String(input.customerName).trim(),
    phone: String(input.phone).trim(),
    notes: String(input.notes || "").trim(),
    items: input.items.map(item => ({
      id: String(item.id || "").trim(),
      name: String(item.name).trim(),
      quantity: Number(item.quantity),
      price: Number(item.price)
    })),
    total: Number(input.total),
    status: "new",
    createdAt: new Date().toISOString()
  };
}

async function handleApi(req, res, url) {
  if (url.pathname === "/api/session" && req.method === "GET") {
    return sendJson(res, 200, { loggedIn: isLoggedIn(req), email: isLoggedIn(req) ? ADMIN_EMAIL : "" });
  }

  if (url.pathname === "/api/login" && req.method === "POST") {
    const body = await readBody(req);
    if (body.email === ADMIN_EMAIL && body.password === ADMIN_PASSWORD) {
      const token = crypto.randomBytes(24).toString("hex");
      sessions.add(token);
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Set-Cookie": `perfume_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`,
      });
      return res.end(JSON.stringify({ ok: true, email: ADMIN_EMAIL }));
    }
    return sendJson(res, 401, { error: "Wrong email or password" });
  }

  if (url.pathname === "/api/logout" && req.method === "POST") {
    sessions.delete(getSession(req));
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Set-Cookie": "perfume_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
    });
    return res.end(JSON.stringify({ ok: true }));
  }

  if (url.pathname === "/api/products" && req.method === "GET") {
    return sendJson(res, 200, readProducts());
  }

  if (url.pathname === "/api/products" && req.method === "POST") {
    if (!requireLogin(req, res)) return;
    const products = readProducts();
    const product = cleanProduct(await readBody(req));
    products.push(product);
    writeProducts(products);
    return sendJson(res, 201, product);
  }

  const productMatch = url.pathname.match(/^\/api\/products\/([^/]+)$/);
  if (productMatch && req.method === "PUT") {
    if (!requireLogin(req, res)) return;
    const id = decodeURIComponent(productMatch[1]);
    const products = readProducts();
    const index = products.findIndex((item) => item.id === id);
    if (index === -1) return sendJson(res, 404, { error: "Product not found" });
    products[index] = cleanProduct(await readBody(req), id);
    writeProducts(products);
    return sendJson(res, 200, products[index]);
  }

  if (productMatch && req.method === "DELETE") {
    if (!requireLogin(req, res)) return;
    const id = decodeURIComponent(productMatch[1]);
    const products = readProducts();
    const nextProducts = products.filter((item) => item.id !== id);
    if (nextProducts.length === products.length) return sendJson(res, 404, { error: "Product not found" });
    writeProducts(nextProducts);
    return sendJson(res, 200, { ok: true });
  }

  // Upload endpoint (admin only)
  if (url.pathname === "/api/upload" && req.method === "POST") {
    if (!requireLogin(req, res)) return;
    try {
      const buffer = await readBinaryBody(req);
      const fileType = getFileTypeFromMagicBytes(buffer);
      if (!fileType) {
        return sendJson(res, 400, { error: "نوع ملف غير مدعوم، يرجى رفع صور JPG أو PNG أو WebP فقط." });
      }

      const headerFilename = req.headers["x-filename"];
      const { base } = sanitizeFilename(headerFilename);
      const ext = fileType.ext;

      let finalFilename = `${base}${ext}`;
      let finalPath = path.join(PRODUCTS_IMAGE_DIR, finalFilename);
      if (fs.existsSync(finalPath)) {
        finalFilename = `${base}-${Date.now()}${ext}`;
        finalPath = path.join(PRODUCTS_IMAGE_DIR, finalFilename);
      }

      fs.writeFileSync(finalPath, buffer);
      return sendJson(res, 200, { ok: true, filename: finalFilename });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // Orders API endpoints
  if (url.pathname === "/api/orders" && req.method === "GET") {
    if (!requireLogin(req, res)) return;
    return sendJson(res, 200, readOrders());
  }

  if (url.pathname === "/api/orders" && req.method === "POST") {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
    if (isRateLimited(ip)) {
      return sendJson(res, 429, { error: "طلبات كثيرة جداً، يرجى المحاولة لاحقاً" });
    }
    const body = await readBody(req);
    try {
      const order = cleanOrder(body);
      const orders = readOrders();
      orders.push(order);
      writeOrders(orders);
      return sendJson(res, 201, { ok: true, order });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  const orderStatusMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/status$/);
  if (orderStatusMatch && req.method === "PUT") {
    if (!requireLogin(req, res)) return;
    const id = decodeURIComponent(orderStatusMatch[1]);
    const body = await readBody(req);
    const status = String(body.status || "").trim();
    if (!["new", "preparing", "done", "cancelled"].includes(status)) {
      return sendJson(res, 400, { error: "حالة طلب غير صالحة" });
    }
    const orders = readOrders();
    const index = orders.findIndex(item => item.id === id);
    if (index === -1) {
      return sendJson(res, 404, { error: "الطلب غير موجود" });
    }
    orders[index].status = status;
    writeOrders(orders);
    return sendJson(res, 200, { ok: true, order: orders[index] });
  }

  return sendJson(res, 404, { error: "Not found" });
}

function serveStatic(req, res, url) {
  const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Not found");
    }
    res.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
    } else {
      serveStatic(req, res, url);
    }
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Something went wrong" });
  }
});

server.listen(PORT, () => {
  console.log(`Perfume web is running on http://127.0.0.1:${PORT}`);
  console.log(`Admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
});

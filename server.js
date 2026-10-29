require("dotenv").config();

const express = require("express");
const multer = require("multer");
const nodemailer = require("nodemailer");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const UPLOAD_DIR = path.join(ROOT, "uploads");
const PORT = Number(process.env.PORT) || 3000;
const SMTP_PORT = Number.parseInt(process.env.SMTP_PORT || "587", 10);
const EMAIL_CONFIGURED = Boolean(process.env.SMTP_HOST && Number.isInteger(SMTP_PORT) && SMTP_PORT > 0 && (process.env.SMTP_FROM || process.env.SMTP_USER));
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const database = new DatabaseSync(path.join(DATA_DIR, "timezline.sqlite"));
database.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    category TEXT NOT NULL,
    subcategory TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    attributes TEXT NOT NULL,
    image_index INTEGER NOT NULL DEFAULT 0,
    featured INTEGER NOT NULL DEFAULT 0,
    UNIQUE(category, subcategory, title)
  );
  CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    product_id INTEGER,
    design_reference TEXT NOT NULL,
    dimensions TEXT NOT NULL DEFAULT '',
    material TEXT NOT NULL DEFAULT '',
    finish TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    reference_files TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
  );
  CREATE INDEX IF NOT EXISTS quotes_created_at_idx ON quotes(created_at);
  CREATE INDEX IF NOT EXISTS products_category_idx ON products(category, subcategory);
`);
const productColumns = database.prepare("PRAGMA table_info(products)").all();
if (!productColumns.some((column) => column.name === "featured")) {
  database.exec("ALTER TABLE products ADD COLUMN featured INTEGER NOT NULL DEFAULT 0");
}
const quoteColumns = database.prepare("PRAGMA table_info(quotes)").all();
if (!quoteColumns.some((column) => column.name === "finish")) {
  database.exec("ALTER TABLE quotes ADD COLUMN finish TEXT NOT NULL DEFAULT ''");
}

const taxonomy = [
  { name: "HOME", collections: [
    { name: "Beds", items: ["Bed Sets", "Bedside Tables", "Dressing Tables", "Wall Mirrors", "Free-Standing Wardrobes", "Clothes Stands"] },
    { name: "Living", items: ["Sofa Sets", "Sofa Beds", "Sofa Chairs"] },
    { name: "Dining", items: ["Dining Table Sets", "Dining Chairs", "Dining Trolleys", "Bar Stools"] },
    { name: "Seating", items: ["Occasional Chairs", "Ottomans", "Stools & Benches"] },
    { name: "Kids", items: ["Kids Single Beds", "Kids Bunk Beds", "Kids Bedside Tables", "Kids Wardrobes", "Kids Study Tables", "Chairs & Storage"] },
    { name: "Tables", items: ["Center Tables", "Side & End Tables", "Nested Tables"] },
    { name: "Study", items: ["Study Tables & Chairs"] },
    { name: "Storage", items: ["TV Units", "Racks & Shelves"] }
  ] },
  { name: "OFFICE", collections: [
    { name: "Office Tables", items: ["Manager Tables", "Executive Tables", "Side Racks", "Center Tables", "Side Tables", "Reception Counters", "Meeting Tables"] },
    { name: "Office Chairs", items: ["Executive Chairs", "Manager Chairs", "Visitor Chairs", "Tablet Arm Chairs", "Cafeteria Chairs"] },
    { name: "Workstations (By Design)", items: ["Ozone 2.0", "Ariel 2.0", "Ariel", "Lunar", "Triton", "Budget Pro", "Orwell", "Orbis"] },
    { name: "Workstations (By Layout)", items: ["Linear", "Y (3 Persons)", "Grid (2 & 4 Persons)"] },
    { name: "Executive Seats", items: ["Berlin", "Antonin", "Sidus", "Traditional", "Arc", "Arc 2.0", "Marcus", "Conte", "Callisto", "Nexis", "Omega"] },
    { name: "Co-Working Space", items: ["Stools & Chairs", "Meeting Pods"] },
    { name: "Storage & Accessories", items: ["Credenzas", "Drawer Pedestals", "Filing Cabinets", "Coat Hangers", "Office Sofas"] }
  ] },
  { name: "KITCHEN", collections: [
    { name: "Kitchen Design", items: ["View All Designs (Custom Modular Kitchen Units)"] },
    { name: "Kitchen Accessories", items: ["Baskets & Rack Systems"] }
  ] },
  { name: "DOORS", collections: [
    { name: "Door Types", items: ["Main Doors", "Panel Doors", "Glass Doors", "Veneer Doors", "Thermoset Doors", "Painted Doors", "Laminated Doors", "Sliding Doors"] }
  ] },
  { name: "WARDROBES", collections: [
    { name: "Wardrobe Systems", items: ["Built-in Wardrobes", "3 Door Free-Standing Wardrobes", "2 Door Free-Standing Wardrobes", "Sliding Free-Standing Wardrobes"] },
    { name: "Security Integration", items: ["Yale Safes (Built-in Vault / Safe Accessories)"] }
  ] },
  { name: "FLOORING", collections: [
    { name: "Flooring Catalog", items: ["View All Designs (Hardwood, Engineered Wood, Laminates)"] }
  ] }
];

const categoryDescriptions = {
  HOME: "Designed for your room, your routines and the way you like to live.",
  OFFICE: "Workplace furniture planned around your people, space and workflow.",
  KITCHEN: "Measured kitchen designs and considered storage, made to fit.",
  DOORS: "Door designs made to suit the architecture and character of your home.",
  WARDROBES: "Thoughtful storage, configured around your room and what you need to keep.",
  FLOORING: "A considered foundation, selected and finished for your space."
};

const featuredProducts = [
  { category: "HOME", subcategory: "Beds", title: "Serein Platform Bed", description: "A quietly sculpted timber silhouette with an optional upholstered headboard, sized and finished for your room.", imageIndex: 2 },
  { category: "HOME", subcategory: "Living", title: "Morrow Modular Sofa", description: "Deep, relaxed proportions with configurable sections and upholstery chosen around everyday life.", imageIndex: 1 },
  { category: "HOME", subcategory: "Dining", title: "Solace Dining Table", description: "A solid-wood gathering place, made to the dimensions and finish that feel right in your home.", imageIndex: 0 },
  { category: "OFFICE", subcategory: "Office Tables", title: "Axis Executive Desk", description: "A considered work surface with tailored storage, cable planning and proportions for your room.", imageIndex: 1 },
  { category: "KITCHEN", subcategory: "Kitchen Design", title: "Forma Kitchen Suite", description: "A measured kitchen concept with calm fronts and thoughtful storage, planned around your layout.", imageIndex: 0 },
  { category: "DOORS", subcategory: "Door Types", title: "No. 08 Pivot Door", description: "An architectural entrance with panel, veneer and hardware details selected for your home.", imageIndex: 1 },
  { category: "WARDROBES", subcategory: "Wardrobe Systems", title: "Alba Fitted Wardrobe", description: "A clear, considered storage direction configured to your room, routines and belongings.", imageIndex: 1 },
  { category: "FLOORING", subcategory: "Flooring Catalog", title: "Quiet Grain Flooring", description: "A warm natural floor direction, selected and finished to suit the tone and flow of your space.", imageIndex: 0 }
];

function productAttributes(category, subcategory, title) {
  const capacityMatch = title.match(/(\d+)\s*(?:&\s*(\d+)\s*)?Persons?/i);
  return {
    dimensions: true,
    materials: ["Solid wood", "Veneer", "Laminated board", "Metal", "Upholstery"],
    collection: subcategory,
    design: subcategory === "Workstations (By Design)" ? title : "",
    layout: subcategory === "Workstations (By Layout)" ? title : "",
    capacity: capacityMatch ? [...new Set([capacityMatch[1], capacityMatch[2]].filter(Boolean))] : [],
    category
  };
}

const seedProduct = database.prepare(`
  INSERT OR IGNORE INTO products (category, subcategory, title, description, attributes, image_index, featured)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const updateProductAttributes = database.prepare(`
  UPDATE products SET attributes = ? WHERE category = ? AND subcategory = ? AND title = ?
`);
database.exec("BEGIN");
try {
  const seededProductKeys = new Set();
  for (const category of taxonomy) {
    category.collections.forEach((collection, collectionIndex) => {
      collection.items.forEach((title, itemIndex) => {
        seededProductKeys.add(`${category.name}\u0000${collection.name}\u0000${title}`);
        seedProduct.run(
          category.name,
          collection.name,
          title,
          categoryDescriptions[category.name],
          JSON.stringify(productAttributes(category.name, collection.name, title)),
          collectionIndex + itemIndex,
          0
        );
        updateProductAttributes.run(JSON.stringify(productAttributes(category.name, collection.name, title)), category.name, collection.name, title);
      });
    });
  }
  for (const product of featuredProducts) {
    seededProductKeys.add(`${product.category}\u0000${product.subcategory}\u0000${product.title}`);
    seedProduct.run(
      product.category,
      product.subcategory,
      product.title,
      product.description,
      JSON.stringify(productAttributes(product.category, product.subcategory, product.title)),
      product.imageIndex,
      1
    );
    updateProductAttributes.run(JSON.stringify(productAttributes(product.category, product.subcategory, product.title)), product.category, product.subcategory, product.title);
  }
  const existingProducts = database.prepare("SELECT id, category, subcategory, title FROM products").all();
  const deleteProduct = database.prepare("DELETE FROM products WHERE id = ?");
  for (const product of existingProducts) {
    if (!seededProductKeys.has(`${product.category}\u0000${product.subcategory}\u0000${product.title}`)) {
      deleteProduct.run(product.id);
    }
  }
  database.exec("COMMIT");
} catch (error) {
  database.exec("ROLLBACK");
  throw error;
}

const allowedFiles = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["application/pdf", ".pdf"]
]);
async function notifyQuoteByEmail(quote) {
  if (!EMAIL_CONFIGURED) return "not_configured";

  let transporter;
  try {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: SMTP_PORT,
      secure: process.env.SMTP_SECURE === "true",
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
      ...(process.env.SMTP_USER && process.env.SMTP_PASS
        ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }
        : {})
    });
    const referenceFiles = quote.referenceFiles.length
      ? quote.referenceFiles.map((file) => file.name).join(", ")
      : "None";
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: process.env.QUOTE_NOTIFICATION_EMAIL || "timezline@gmail.com",
      subject: `New Timezline quote enquiry · ${quote.designReference}`,
      text: [
        "A made-to-order enquiry has been saved in the Timezline lead database.",
        `Lead reference: TZQ-${quote.id}`,
        `Item code: ${quote.productId ? `TZ-${String(quote.productId).padStart(4, "0")}` : "CUSTOM"}`,
        `Design: ${quote.designReference}`,
        `Name: ${quote.name}`,
        `Phone: ${quote.phone}`,
        `Email: ${quote.email}`,
        `Dimensions: ${quote.dimensions || "To be discussed"}`,
        `Material: ${quote.material || "To be discussed"}`,
        `Finish / color: ${quote.finish || "To be discussed"}`,
        `Notes: ${quote.notes || "None"}`,
        `Reference files stored privately: ${referenceFiles}`
      ].join("\n")
    });
    return "sent";
  } catch (error) {
    console.error("Timezline quote email notification failed:", error.message);
    return "failed";
  } finally {
    transporter?.close();
  }
}
const upload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => callback(null, UPLOAD_DIR),
    filename: (_request, file, callback) => callback(null, `${crypto.randomUUID()}${allowedFiles.get(file.mimetype) || ".bin"}`)
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 4, fields: 16, fieldSize: 2500 },
  fileFilter: (_request, file, callback) => {
    if (!allowedFiles.has(file.mimetype)) return callback(new Error("Reference files must be JPG, PNG, WEBP or PDF."));
    callback(null, true);
  }
});

const escapeLikeValue = (value) => String(value).replace(/[\\%_]/g, "\\$&");
const safeParseJson = (value, fallback = {}) => {
  try {
    return JSON.parse(value ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
};

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));
app.get("/", (_request, response) => response.sendFile(path.join(ROOT, "index.html")));
app.get("/index.html", (_request, response) => response.sendFile(path.join(ROOT, "index.html")));
app.get("/style.css", (_request, response) => response.sendFile(path.join(ROOT, "style.css")));
app.get("/script.js", (_request, response) => response.sendFile(path.join(ROOT, "script.js")));
app.get("/assets/timezline-mark.png", (_request, response) => response.sendFile(path.join(ROOT, "assets", "timezline-mark.png")));

app.get("/api/health", (_request, response) => response.json({ ok: true }));
app.get("/api/taxonomy", (_request, response) => response.json(taxonomy));
app.get("/api/filters", (_request, response) => {
  const products = database.prepare("SELECT attributes FROM products").all();
  const values = { design: new Set(), layout: new Set(), capacity: new Set() };
  for (const product of products) {
    const attributes = safeParseJson(product.attributes, {});
    for (const key of ["design", "layout"]) {
      if (attributes[key]) values[key].add(attributes[key]);
    }
    for (const capacity of attributes.capacity || []) values.capacity.add(capacity);
  }
  response.json(Object.fromEntries(Object.entries(values).map(([key, entries]) => [key, [...entries].sort()])));
});
app.get("/api/products/:id", (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return response.status(400).json({ error: "Product ID must be a positive integer." });
  const product = database.prepare("SELECT id, category, subcategory, title, description, attributes, image_index AS imageIndex, featured FROM products WHERE id = ?").get(id);
  if (!product) return response.status(404).json({ error: "That catalog design could not be found." });
  return response.json({ ...product, featured: Boolean(product.featured), attributes: safeParseJson(product.attributes, {}) });
});
app.get("/api/products", (request, response) => {
  const category = String(request.query.category || "").trim().toUpperCase();
  const subcategory = String(request.query.subcategory || "").trim();
  const search = String(request.query.search || "").trim();
  const design = String(request.query.design || "").trim();
  const layout = String(request.query.layout || "").trim();
  const capacity = String(request.query.capacity || "").trim();
  const limit = Math.min(Math.max(Number.parseInt(request.query.limit, 10) || 18, 1), 60);
  const offset = Math.max(Number.parseInt(request.query.offset, 10) || 0, 0);
  const where = [];
  const values = [];
  if (category) { where.push("category = ?"); values.push(category); }
  if (subcategory) { where.push("subcategory = ?"); values.push(subcategory); }
  if (design) { where.push("json_extract(attributes, '$.design') = ?"); values.push(design); }
  if (layout) { where.push("json_extract(attributes, '$.layout') = ?"); values.push(layout); }
  if (capacity) { where.push("EXISTS (SELECT 1 FROM json_each(json_extract(attributes, '$.capacity')) WHERE value = ?)"); values.push(capacity); }
  if (search) {
    const normalizedSearch = `%${escapeLikeValue(search)}%`;
    where.push("(title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR subcategory LIKE ? ESCAPE '\\' OR category LIKE ? ESCAPE '\\')");
    values.push(normalizedSearch, normalizedSearch, normalizedSearch, normalizedSearch);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = database.prepare(`SELECT COUNT(*) AS count FROM products ${clause}`).get(...values).count;
  const products = database.prepare(`SELECT id, category, subcategory, title, description, attributes, image_index AS imageIndex, featured FROM products ${clause} ORDER BY featured DESC, id LIMIT ? OFFSET ?`).all(...values, limit, offset);
  response.json({ total, products: products.map((product) => ({ ...product, featured: Boolean(product.featured), attributes: safeParseJson(product.attributes, {}) })) });
});

app.post("/api/quotes", (request, response) => {
  upload.array("referenceImages", 4)(request, response, async (uploadError) => {
    if (uploadError) {
      if (request.files) request.files.forEach((file) => fs.rm(file.path, { force: true }, () => {}));
      return response.status(400).json({ error: uploadError.message });
    }

    const { name, phone, email, productId, designReference, dimensions, material, finish, notes } = request.body || {};
    const cleanName = String(name || "").trim();
    const cleanPhone = String(phone || "").trim();
    const cleanEmail = String(email || "").trim();
    const cleanReference = String(designReference || "").trim();
    if (!cleanName || cleanName.length > 100 || !cleanPhone || cleanPhone.length > 30 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 160 || !cleanReference || cleanReference.length > 160) {
      (request.files || []).forEach((file) => fs.rm(file.path, { force: true }, () => {}));
      return response.status(400).json({ error: "Please provide a valid name, phone number, email and design reference." });
    }
    const selectedProductId = productId ? Number.parseInt(productId, 10) : null;
    if (productId && (!Number.isInteger(selectedProductId) || !database.prepare("SELECT id FROM products WHERE id = ?").get(selectedProductId))) {
      (request.files || []).forEach((file) => fs.rm(file.path, { force: true }, () => {}));
      return response.status(400).json({ error: "That catalog design could not be found. Please choose another." });
    }
    const referenceFiles = (request.files || []).map((file) => ({ name: path.basename(file.originalname).slice(0, 180), path: `/uploads/${file.filename}`, type: file.mimetype, size: file.size }));
    try {
      const result = database.prepare(`
        INSERT INTO quotes (name, phone, email, product_id, design_reference, dimensions, material, finish, notes, reference_files)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(cleanName, cleanPhone, cleanEmail, selectedProductId, cleanReference, String(dimensions || "").trim().slice(0, 160), String(material || "").trim().slice(0, 100), String(finish || "").trim().slice(0, 100), String(notes || "").trim().slice(0, 2500), JSON.stringify(referenceFiles));
      const id = Number(result.lastInsertRowid);
      const emailStatus = await notifyQuoteByEmail({
        id,
        productId: selectedProductId,
        designReference: cleanReference,
        name: cleanName,
        phone: cleanPhone,
        email: cleanEmail,
        dimensions: String(dimensions || "").trim().slice(0, 160),
        material: String(material || "").trim().slice(0, 100),
        finish: String(finish || "").trim().slice(0, 100),
        notes: String(notes || "").trim().slice(0, 2500),
        referenceFiles
      });
      return response.status(201).json({
        id,
        name: cleanName,
        message: "Your enquiry has been received.",
        notifications: { email: emailStatus }
      });
    } catch (error) {
      (request.files || []).forEach((file) => fs.rm(file.path, { force: true }, () => {}));
      return response.status(500).json({ error: "We couldn’t save your request. Please try again." });
    }
  });
});

app.use((error, _request, response, _next) => {
  if (response.headersSent) return;
  const status = Number(error.status) || 500;
  response.status(status).json({ error: status >= 500 ? "Something went wrong. Please try again." : error.message });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Timezline is live at http://localhost:${PORT}`));
}

module.exports = { app, database, taxonomy };
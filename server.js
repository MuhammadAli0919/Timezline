const express = require("express");
const multer = require("multer");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const UPLOAD_DIR = path.join(ROOT, "uploads");
const PORT = Number(process.env.PORT) || 3000;
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const database = new DatabaseSync(path.join(DATA_DIR, "timezline.sqlite"));
database.exec(`
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
    { name: "Seating", items: ["Office Sofas"] },
    { name: "Co-Working Space", items: ["Stools & Chairs", "Meeting Pods"] },
    { name: "Storage", items: ["Credenzas", "Drawer Pedestals", "Filing Cabinets", "Coat Hangers"] }
  ] },
  { name: "KITCHEN", collections: [
    { name: "Kitchen Design", items: ["View All Designs"] },
    { name: "Kitchen Accessories", items: ["Baskets & Rack Systems"] }
  ] },
  { name: "DOORS", collections: [
    { name: "Doors", items: ["Main Doors", "Panel Doors", "Glass Doors", "Veneer Doors", "Thermoset Doors", "Painted Doors", "Laminated Doors", "Sliding Doors"] }
  ] },
  { name: "WARDROBES", collections: [
    { name: "Wardrobes", items: ["Built-in Wardrobes", "3 Door Free-Standing Wardrobes", "2 Door Free-Standing Wardrobes", "Sliding Free-Standing Wardrobes", "Yale Safes"] }
  ] },
  { name: "FLOORING", collections: [
    { name: "Flooring", items: ["View All Designs"] }
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
  { category: "DOORS", subcategory: "Doors", title: "No. 08 Pivot Door", description: "An architectural entrance with panel, veneer and hardware details selected for your home.", imageIndex: 1 },
  { category: "WARDROBES", subcategory: "Wardrobes", title: "Alba Fitted Wardrobe", description: "A clear, considered storage direction configured to your room, routines and belongings.", imageIndex: 1 },
  { category: "FLOORING", subcategory: "Flooring", title: "Quiet Grain Flooring", description: "A warm natural floor direction, selected and finished to suit the tone and flow of your space.", imageIndex: 0 }
];

const seedProduct = database.prepare(`
  INSERT OR IGNORE INTO products (category, subcategory, title, description, attributes, image_index, featured)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
database.exec("BEGIN");
try {
  for (const category of taxonomy) {
    category.collections.forEach((collection, collectionIndex) => {
      collection.items.forEach((title, itemIndex) => {
        seedProduct.run(
          category.name,
          collection.name,
          title,
          categoryDescriptions[category.name],
          JSON.stringify({ dimensions: true, materials: ["Solid wood", "Veneer", "Laminated board", "Metal", "Upholstery"], collection: collection.name }),
          collectionIndex + itemIndex,
          0
        );
      });
    });
  }
  for (const product of featuredProducts) {
    seedProduct.run(
      product.category,
      product.subcategory,
      product.title,
      product.description,
      JSON.stringify({ dimensions: true, materials: ["Solid wood", "Veneer", "Laminated board", "Metal", "Upholstery"], collection: product.subcategory }),
      product.imageIndex,
      1
    );
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
const upload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => callback(null, UPLOAD_DIR),
    filename: (_request, file, callback) => callback(null, `${crypto.randomUUID()}${allowedFiles.get(file.mimetype) || ".bin"}`)
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 4, fields: 8, fieldSize: 2500 },
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
app.get("/api/products", (request, response) => {
  const category = String(request.query.category || "").trim().toUpperCase();
  const subcategory = String(request.query.subcategory || "").trim();
  const search = String(request.query.search || "").trim();
  const limit = Math.min(Math.max(Number.parseInt(request.query.limit, 10) || 18, 1), 60);
  const offset = Math.max(Number.parseInt(request.query.offset, 10) || 0, 0);
  const where = [];
  const values = [];
  if (category) { where.push("category = ?"); values.push(category); }
  if (subcategory) { where.push("subcategory = ?"); values.push(subcategory); }
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
  upload.array("referenceImages", 4)(request, response, (uploadError) => {
    if (uploadError) {
      if (request.files) request.files.forEach((file) => fs.rm(file.path, { force: true }, () => {}));
      return response.status(400).json({ error: uploadError.message });
    }

    const { name, phone, email, productId, designReference, dimensions, material, notes } = request.body || {};
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
        INSERT INTO quotes (name, phone, email, product_id, design_reference, dimensions, material, notes, reference_files)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(cleanName, cleanPhone, cleanEmail, selectedProductId, cleanReference, String(dimensions || "").trim().slice(0, 160), String(material || "").trim().slice(0, 100), String(notes || "").trim().slice(0, 2500), JSON.stringify(referenceFiles));
      return response.status(201).json({ id: Number(result.lastInsertRowid), name: cleanName, message: "Your enquiry has been received." });
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
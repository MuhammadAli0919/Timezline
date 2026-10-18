const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { after, before, test } = require("node:test");
const { app, database } = require("../server");

let server;
let baseUrl;
let quoteId;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (quoteId) {
    const quote = database.prepare("SELECT reference_files FROM quotes WHERE id = ?").get(quoteId);
    for (const file of JSON.parse(quote?.reference_files || "[]")) {
      fs.rmSync(path.join(__dirname, "..", file.path), { force: true });
    }
    database.prepare("DELETE FROM quotes WHERE id = ?").run(quoteId);
  }
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  database.close();
});

test("taxonomy and collection filters return the expected catalog", async () => {
  const taxonomy = await fetch(`${baseUrl}/api/taxonomy`).then((response) => response.json());
  const firstDesigns = await fetch(`${baseUrl}/api/products?limit=8`).then((response) => response.json());
  const result = await fetch(`${baseUrl}/api/products?category=HOME&subcategory=Living`).then((response) => response.json());
  const byDescription = await fetch(`${baseUrl}/api/products?search=timber`).then((response) => response.json());
  assert.equal(taxonomy.length, 6);
  assert.deepEqual(firstDesigns.products.map((product) => product.title), ["Serein Platform Bed", "Morrow Modular Sofa", "Solace Dining Table", "Axis Executive Desk", "Forma Kitchen Suite", "No. 08 Pivot Door", "Alba Fitted Wardrobe", "Quiet Grain Flooring"]);
  assert(firstDesigns.products.every((product) => product.featured));
  assert.equal(result.total, 4);
  assert.deepEqual(result.products.map((product) => product.title).sort(), ["Morrow Modular Sofa", "Sofa Beds", "Sofa Chairs", "Sofa Sets"]);
  assert(byDescription.products.some((product) => product.title === "Serein Platform Bed"));
  const workstationParams = new URLSearchParams({ category: "OFFICE", subcategory: "Workstations (By Design)" });
  const workstations = await fetch(`${baseUrl}/api/products?${workstationParams}`).then((response) => response.json());
  assert.deepEqual(workstations.products.map((product) => product.title), ["Ozone 2.0", "Ariel 2.0", "Ariel", "Lunar", "Triton", "Budget Pro", "Orwell", "Orbis"]);
});

test("quote requests validate, persist and keep reference uploads private", async () => {
  const invalid = new FormData();
  invalid.set("name", "Incomplete");
  const invalidResponse = await fetch(`${baseUrl}/api/quotes`, { method: "POST", body: invalid });
  assert.equal(invalidResponse.status, 400);

  const form = new FormData();
  form.set("name", "API Smoke Test");
  form.set("phone", "+92 300 000 0000");
  form.set("email", `api-${Date.now()}@example.test`);
  form.set("designReference", "Smoke test only");
  form.append("referenceImages", new Blob([Uint8Array.of(1, 2, 3)], { type: "image/png" }), "reference.png");
  const response = await fetch(`${baseUrl}/api/quotes`, { method: "POST", body: form });
  const result = await response.json();
  assert.equal(response.status, 201);
  quoteId = result.id;

  const saved = database.prepare("SELECT reference_files FROM quotes WHERE id = ?").get(quoteId);
  const files = JSON.parse(saved.reference_files);
  assert.equal(files.length, 1);
  assert.equal((await fetch(`${baseUrl}${files[0].path}`)).status, 404);
  assert.notEqual((await fetch(`${baseUrl}/data/timezline.sqlite`)).status, 200);
});
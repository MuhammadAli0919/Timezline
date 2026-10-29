const categoryFilter = document.querySelector("#category-filter");
const subcategoryFilter = document.querySelector("#subcategory-filter");
const designFilter = document.querySelector("#design-filter");
const layoutFilter = document.querySelector("#layout-filter");
const capacityFilter = document.querySelector("#capacity-filter");
const productGrid = document.querySelector("#product-grid");
const resultsCount = document.querySelector("#results-count");
const emptyState = document.querySelector("#catalog-empty");
const loadMoreButton = document.querySelector("#load-more");
const searchInput = document.querySelector("#site-search");
const quoteDialog = document.querySelector("#quote-dialog");
const productDialog = document.querySelector("#product-dialog");
const quoteForm = document.querySelector("#quote-form");
const formFeedback = document.querySelector("#form-feedback");
const quoteButton = quoteForm.querySelector("[type=submit]");
const toast = document.querySelector("#toast");
const chatLauncher = document.querySelector("#chat-launcher");
const chatPanel = document.querySelector("#chat-panel");
const chatClose = document.querySelector("#chat-close");
const chatMessages = document.querySelector("#chat-messages");
const chatQuickPrompts = document.querySelector("#chat-quick-prompts");
const chatForm = document.querySelector("#chat-form");
const chatInput = document.querySelector("#chat-input");

const pageSize = 18;
let shownProducts = 0;
let totalProducts = 0;
let requestSequence = 0;
let toastTimer;
let taxonomy = [];
let catalogRecoveryTimer;
let catalogRecoveryDelay = 5000;
let selectedQuoteProduct = null;
let selectedDetailFinish = "Natural oak";

const categoryImages = {
  HOME: [
    "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=850&q=78",
    "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=850&q=78",
    "https://images.unsplash.com/photo-1616486029423-aaa4789e8c9a?auto=format&fit=crop&w=850&q=78"
  ],
  OFFICE: [
    "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=850&q=78",
    "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=850&q=78",
    "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=850&q=78"
  ],
  KITCHEN: [
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=850&q=78",
    "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=850&q=78"
  ],
  DOORS: [
    "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=850&q=78",
    "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=850&q=78"
  ],
  WARDROBES: [
    "https://images.unsplash.com/photo-1616486029423-aaa4789e8c9a?auto=format&fit=crop&w=850&q=78",
    "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=850&q=78"
  ],
  FLOORING: [
    "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=850&q=78",
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=850&q=78"
  ]
};

const offlinePreviews = [
  { category: "HOME", subcategory: "Beds", title: "Serein Platform Bed", description: "A quietly sculpted timber silhouette with an optional upholstered headboard, sized and finished for your room.", imageIndex: 2, featured: true },
  { category: "HOME", subcategory: "Living", title: "Morrow Modular Sofa", description: "Deep, relaxed proportions with configurable sections and upholstery chosen around everyday life.", imageIndex: 1, featured: true },
  { category: "HOME", subcategory: "Dining", title: "Solace Dining Table", description: "A solid-wood gathering place, made to the dimensions and finish that feel right in your home.", imageIndex: 0, featured: true },
  { category: "OFFICE", subcategory: "Office Tables", title: "Axis Executive Desk", description: "A considered work surface with tailored storage, cable planning and proportions for your room.", imageIndex: 1, featured: true },
  { category: "KITCHEN", subcategory: "Kitchen Design", title: "Forma Kitchen Suite", description: "A measured kitchen concept with calm fronts and thoughtful storage, planned around your layout.", imageIndex: 0, featured: true },
  { category: "DOORS", subcategory: "Doors", title: "No. 08 Pivot Door", description: "An architectural entrance with panel, veneer and hardware details selected for your home.", imageIndex: 1, featured: true },
  { category: "WARDROBES", subcategory: "Wardrobes", title: "Alba Fitted Wardrobe", description: "A clear, considered storage direction configured to your room, routines and belongings.", imageIndex: 1, featured: true },
  { category: "FLOORING", subcategory: "Flooring", title: "Quiet Grain Flooring", description: "A warm natural floor direction, selected and finished to suit the tone and flow of your space.", imageIndex: 0, featured: true }
];

async function loadTaxonomy() {
  try {
    const response = await fetch("/api/taxonomy");
    if (!response.ok) throw new Error("Could not load categories.");
    taxonomy = await response.json();
    clearCatalogRecovery();
    categoryFilter.replaceChildren(new Option("All categories", ""));
    for (const category of taxonomy) {
      const option = document.createElement("option");
      option.value = category.name;
      option.textContent = titleCase(category.name);
      categoryFilter.append(option);
    }
    const linkedProductId = new URLSearchParams(window.location.search).get("product");
    if (linkedProductId && /^\d+$/.test(linkedProductId)) {
      const response = await fetch(`/api/products/${linkedProductId}`);
      if (!response.ok) throw new Error("This shared design link is no longer available.");
      const product = await response.json();
      categoryFilter.value = product.category;
      updateSubcategories();
      subcategoryFilter.value = product.subcategory;
      await loadProducts();
      openProductDetails(product);
    } else {
      await loadProducts();
    }
  } catch (error) {
    if (!categoryFilter.querySelector('option[value="HOME"]')) {
      categoryFilter.replaceChildren(new Option("All categories", ""));
      for (const category of offlinePreviews.filter((product, index, items) => items.findIndex((item) => item.category === product.category) === index)) {
        categoryFilter.add(new Option(titleCase(category.category), category.category));
      }
    }
    renderOfflinePreviews();
    loadMoreButton.hidden = true;
    resultsCount.textContent = "Preview designs · reconnecting to catalog";
    emptyState.hidden = false;
    emptyState.textContent = "A few design ideas are shown below while the live catalog is unavailable.";
    scheduleCatalogRecovery();
  }
}

function scheduleCatalogRecovery() {
  if (catalogRecoveryTimer) return;
  const delay = catalogRecoveryDelay;
  catalogRecoveryDelay = Math.min(catalogRecoveryDelay * 2, 60000);
  catalogRecoveryTimer = window.setTimeout(() => {
    catalogRecoveryTimer = undefined;
    if (taxonomy.length) loadProducts();
    else loadTaxonomy();
  }, delay);
}

function clearCatalogRecovery() {
  window.clearTimeout(catalogRecoveryTimer);
  catalogRecoveryTimer = undefined;
  catalogRecoveryDelay = 5000;
}

function titleCase(value) {
  if (value === "HOME") return "Home & Living";
  return value.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function updateSubcategories() {
  const selectedCategory = categoryFilter.value;
  subcategoryFilter.replaceChildren(new Option(selectedCategory ? "All collections" : "Choose a room first", ""));
  const selected = taxonomy.find((category) => category.name === selectedCategory);
  subcategoryFilter.disabled = !selected;
  for (const collection of selected?.collections ?? []) {
    const option = new Option(collection.name, collection.name);
    subcategoryFilter.append(option);
  }
}

async function loadAttributeFilters() {
  try {
    const response = await fetch("/api/filters");
    if (!response.ok) throw new Error("Could not load catalog filters.");
    const filters = await response.json();
    for (const [select, key, label] of [
      [designFilter, "design", "All designs"],
      [layoutFilter, "layout", "All layouts"],
      [capacityFilter, "capacity", "Any capacity"]
    ]) {
      select.replaceChildren(new Option(label, ""));
      for (const value of filters[key] || []) {
        select.add(new Option(key === "capacity" ? `${value} ${value === "1" ? "seat" : "seats"}` : value, value));
      }
    }
  } catch (error) {
    showToast("Workstation filters are temporarily unavailable.");
  }
}

function renderOfflinePreviews() {
  const search = searchInput.value.trim().toLowerCase();
  const previews = offlinePreviews.filter((product) => {
    const matchesCategory = !categoryFilter.value || product.category === categoryFilter.value;
    const matchesSubcategory = !subcategoryFilter.value || product.subcategory === subcategoryFilter.value;
    const matchesSearch = !search || `${product.category} ${product.subcategory} ${product.title} ${product.description}`.toLowerCase().includes(search);
    return matchesCategory && matchesSubcategory && matchesSearch;
  });
  productGrid.replaceChildren();
  for (const product of previews) productGrid.append(makeProductCard(product));
  emptyState.hidden = previews.length > 0;
  if (!previews.length) emptyState.textContent = "No preview designs match this selection.";
  shownProducts = previews.length;
  totalProducts = previews.length;
}

async function loadProducts({ append = false } = {}) {
  const sequence = ++requestSequence;
  const params = new URLSearchParams({
    limit: String(pageSize),
    offset: String(append ? shownProducts : 0)
  });
  if (categoryFilter.value) params.set("category", categoryFilter.value);
  if (subcategoryFilter.value) params.set("subcategory", subcategoryFilter.value);
  if (designFilter.value) params.set("design", designFilter.value);
  if (layoutFilter.value) params.set("layout", layoutFilter.value);
  if (capacityFilter.value) params.set("capacity", capacityFilter.value);
  if (searchInput.value.trim()) params.set("search", searchInput.value.trim());
  resultsCount.textContent = "Finding your starting point…";

  try {
    let payload;
    let lastError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(`/api/products?${params}`);
        if (!response.ok) throw new Error("Catalog request failed.");
        payload = await response.json();
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        if (attempt === 0) await new Promise((resolve) => window.setTimeout(resolve, 450));
      }
    }
    if (lastError || !payload) throw lastError || new Error("Catalog request failed.");
    if (sequence !== requestSequence) return;
    clearCatalogRecovery();
    totalProducts = payload.total;
    shownProducts = append ? shownProducts + payload.products.length : payload.products.length;
    if (!append) productGrid.replaceChildren();
    for (const product of payload.products) productGrid.append(makeProductCard(product));
    resultsCount.textContent = `${totalProducts} made-to-order ${totalProducts === 1 ? "design" : "designs"}`;
    emptyState.hidden = totalProducts !== 0;
    loadMoreButton.hidden = shownProducts >= totalProducts || totalProducts === 0;
  } catch (error) {
    if (sequence !== requestSequence) return;
    if (append && productGrid.childElementCount) {
      resultsCount.textContent = `${shownProducts} designs shown · couldn’t load more`;
      emptyState.hidden = true;
      loadMoreButton.hidden = true;
      scheduleCatalogRecovery();
      return;
    }
    renderOfflinePreviews();
    loadMoreButton.hidden = true;
    resultsCount.textContent = `Showing ${shownProducts} preview ${shownProducts === 1 ? "design" : "designs"} · catalog reconnecting`;
    if (shownProducts) {
      emptyState.hidden = false;
      emptyState.textContent = "These are preview designs while the live catalog is unavailable.";
    } else {
      emptyState.hidden = false;
      emptyState.textContent = "The catalog is temporarily unavailable. Please check back shortly.";
    }
    scheduleCatalogRecovery();
  }
}

function makeProductCard(product) {
  const card = document.createElement("article");
  card.className = "product-card";
  const images = categoryImages[product.category] ?? categoryImages.HOME;
  const image = images[product.imageIndex % images.length];
  const imageWrap = document.createElement("div");
  imageWrap.className = "product-image-wrap";
  const photo = document.createElement("img");
  photo.src = image;
  photo.alt = `${product.title}, a made-to-order ${product.category.toLowerCase()} design by Timezline`;
  photo.loading = "lazy";
  photo.decoding = "async";
  imageWrap.append(photo);
  const tag = document.createElement("span");
  tag.className = "product-tag";
  tag.textContent = "MADE TO ORDER";
  imageWrap.append(tag);

  const meta = document.createElement("div");
  meta.className = "product-meta";
  const details = document.createElement("div");
  const categoryLabel = document.createElement("p");
  categoryLabel.className = "product-category";
  categoryLabel.textContent = `${titleCase(product.category)} / ${product.subcategory}`;
  const title = document.createElement("h3");
  title.textContent = product.title;
  const description = document.createElement("p");
  description.className = "product-description";
  description.textContent = product.description;
  details.append(categoryLabel, title, description);
  const actions = document.createElement("div");
  actions.className = "product-actions";
  const view = document.createElement("button");
  view.className = "product-details-link";
  view.type = "button";
  view.textContent = "View design";
  view.addEventListener("click", () => openProductDetails(product));
  const quote = document.createElement("button");
  quote.className = "product-quote";
  quote.type = "button";
  quote.dataset.productId = String(product.id);
  quote.dataset.productName = product.title;
  quote.innerHTML = 'Request Custom Quote <span aria-hidden="true">↗</span>';
  quote.addEventListener("click", () => openQuote(product));
  actions.append(view, quote);
  meta.append(details, actions);
  card.append(imageWrap, meta);
  return card;
}

function openQuote(product = null, dimensions = null, finish = "") {
  formFeedback.textContent = "";
  formFeedback.classList.remove("success");
  quoteForm.reset();
  document.querySelector("#whatsapp-followup").hidden = true;
  selectedQuoteProduct = product;
  document.querySelector("#quote-product-id").value = product?.id != null ? String(product.id) : "";
  document.querySelector("#design-reference").value = product ? product.title : "";
  if (dimensions) {
    document.querySelector('[name="dimensionsWidth"]').value = dimensions.width;
    document.querySelector('[name="dimensionsDepth"]').value = dimensions.depth;
    document.querySelector('[name="dimensionsHeight"]').value = dimensions.height;
  }
  if (finish) quoteForm.elements.finish.value = finish;
  document.querySelector("#file-list").textContent = "No files selected";
  quoteDialog.showModal();
  window.setTimeout(() => document.querySelector("#design-reference").focus(), 50);
}

function openProductDetails(product) {
  const images = categoryImages[product.category] ?? categoryImages.HOME;
  const initialImage = images[product.imageIndex % images.length];
  document.querySelector("#detail-image").src = initialImage;
  document.querySelector("#detail-image").alt = `${product.title}, made-to-order by Timezline`;
  document.querySelector("#detail-category").textContent = `${titleCase(product.category)} / ${product.subcategory}`;
  document.querySelector("#product-dialog-title").textContent = product.title;
  document.querySelector("#detail-description").textContent = product.description;
  const thumbnails = document.querySelector("#gallery-thumbnails");
  thumbnails.replaceChildren();
  images.forEach((image, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gallery-thumbnail";
    button.setAttribute("aria-label", `View design gallery image ${index + 1}`);
    const thumbnail = document.createElement("img");
    thumbnail.src = image;
    thumbnail.alt = "";
    button.append(thumbnail);
    button.addEventListener("click", () => {
      document.querySelector("#detail-image").src = image;
    });
    thumbnails.append(button);
  });
  const swatches = [
    { name: "Natural oak veneer", color: "#b28a5d", image: "https://images.unsplash.com/photo-1523413651479-597eb2da0ad6?auto=format&fit=crop&w=640&q=85" },
    { name: "Walnut veneer", color: "#654b3b", image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=640&q=85" },
    { name: "Smoked ash veneer", color: "#77736a", image: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=640&q=85" },
    { name: "Warm white laminate", color: "#e5dfd1", image: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=640&q=85" },
    { name: "Olive upholstery", color: "#77785d", image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=640&q=85" },
    { name: "Terracotta fabric", color: "#b86f50", image: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=640&q=85" }
  ];
  const swatchContainer = document.querySelector("#finish-swatches");
  swatchContainer.replaceChildren();
  for (const swatch of swatches) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "finish-swatch";
    button.style.setProperty("--swatch-color", swatch.color);
    button.setAttribute("aria-label", `${swatch.name} finish`);
    button.setAttribute("aria-pressed", String(swatch.name === selectedDetailFinish));
    const sample = document.createElement("img");
    sample.src = swatch.image;
    sample.alt = "";
    sample.loading = "lazy";
    sample.addEventListener("error", () => sample.remove(), { once: true });
    button.append(sample);
    button.addEventListener("click", () => {
      selectedDetailFinish = swatch.name;
      document.querySelector("#selected-finish").textContent = `Selected finish: ${swatch.name}`;
      swatchContainer.querySelectorAll(".finish-swatch").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    });
    swatchContainer.append(button);
  }
  document.querySelector("#selected-finish").textContent = `Selected finish: ${selectedDetailFinish}`;
  productDialog.querySelector(".detail-quote-button").onclick = () => {
    const dimensions = {
      width: document.querySelector("#visual-width").value,
      depth: document.querySelector("#visual-depth").value,
      height: document.querySelector("#visual-height").value
    };
    productDialog.close();
    openQuote(product, dimensions, selectedDetailFinish);
  };
  productDialog.showModal();
}

function updateDimensionPreview() {
  const width = Number(document.querySelector("#visual-width").value) || 180;
  const depth = Number(document.querySelector("#visual-depth").value) || 90;
  const height = Number(document.querySelector("#visual-height").value) || 75;
  const visual = document.querySelector("#dimension-object");
  visual.style.setProperty("--object-width", `${Math.min(100, Math.max(28, width / 4))}%`);
  visual.style.setProperty("--object-depth", `${Math.min(92, Math.max(28, depth / 2))}%`);
  visual.style.setProperty("--object-height", `${Math.min(80, Math.max(28, height / 2))}%`);
  visual.style.setProperty("--depth-offset", `${Math.round(Math.min(14, Math.max(4, depth / 12)))}px`);
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("visible");
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 4800);
}

function setChatOpen(isOpen) {
  chatPanel.hidden = !isOpen;
  chatLauncher.setAttribute("aria-expanded", String(isOpen));
  chatLauncher.setAttribute("aria-label", isOpen ? "Close the Timezline chat assistant" : "Open the Timezline chat assistant");
  if (isOpen) chatInput.focus();
  else chatLauncher.focus();
}

function addChatMessage(text, sender = "assistant", actions = []) {
  const message = document.createElement("div");
  message.className = `chat-message chat-message-${sender}`;
  if (sender === "assistant") {
    const avatar = document.createElement("span");
    avatar.className = "chat-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = "T";
    message.append(avatar);
  }
  const content = document.createElement("div");
  const bubble = document.createElement("div");
  bubble.className = "chat-bubble";
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  bubble.append(paragraph);
  content.append(bubble);
  if (actions.length) {
    const actionRow = document.createElement("div");
    actionRow.className = "chat-message-actions";
    for (const action of actions) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = action.label;
      button.dataset.chatAction = action.type;
      if (action.value) button.dataset.chatValue = action.value;
      actionRow.append(button);
    }
    content.append(actionRow);
  }
  message.append(content);
  chatMessages.append(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return message;
}

function addChatTyping() {
  const message = document.createElement("div");
  message.className = "chat-message chat-message-assistant";
  message.dataset.typing = "true";
  const avatar = document.createElement("span");
  avatar.className = "chat-avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = "T";
  const bubble = document.createElement("div");
  bubble.className = "chat-bubble chat-typing";
  bubble.setAttribute("aria-label", "Timezline assistant is responding");
  bubble.innerHTML = "<i></i><i></i><i></i>";
  message.append(avatar, bubble);
  chatMessages.append(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return message;
}

async function getChatReply(message) {
  const text = message.toLowerCase();
  if (/\b(hi|hello|hey|salam|assalam)\b/.test(text)) {
    return { text: "Wa alaikum salam. Welcome to Timezline. Tell me what you’re planning, and I’ll help you find a good next step." };
  }
  if (/made.?to.?order|ready.?made|in stock|stock|custom.{0,12}made|bespoke process/.test(text)) {
    return { text: "We don’t keep ready-made stock. Each piece is designed and handcrafted to your measurements, material choices and the way you’ll use it. We start with a conversation, then agree the design before making begins.", actions: [{ label: "Start a custom quote", type: "quote" }] };
  }
  if (/price|pricing|cost|quote|budget|how much/.test(text)) {
    return { text: "Every project is different, so we prepare a considered quote around the dimensions, materials and details you choose. Share what you have in mind and our Karachi team will take it from there.", actions: [{ label: "Request a custom quote", type: "quote" }] };
  }
  if (/material|wood|veneer|fabric|finish|upholster/.test(text)) {
    return { text: "Material and finish options depend on the piece and how it will be used. Solid wood, veneer, laminates, metal and upholstery can all be discussed during design. Have a reference in mind? Attach it to a quote request.", actions: [{ label: "Discuss materials", type: "quote" }] };
  }
  if (/delivery|install|lead time|how long|timeline|turnaround/.test(text)) {
    return { text: "Timing depends on the design, materials and installation needs. We’ll confirm a realistic schedule once we understand your project. Our workshop is in Buffer Zone, Karachi." };
  }
  if (/where|location|address|visit|karachi|contact|phone|email/.test(text)) {
    return { text: "We’re at Plot R425, Sector 15-B, Buffer Zone, Karachi. You can call us on +92 300 9263 594 or email timezline@gmail.com." };
  }
  if (/catalog|catalogue|browse|categories|designs|what furniture/.test(text)) {
    return { text: "We make for home, office, kitchen, doors, wardrobes and flooring. Tell me what piece you’re looking for and I’ll find a few starting points.", actions: [{ label: "Browse all designs", type: "browse" }] };
  }

  const searchTerms = ["workstation", "wardrobe", "sofa", "dining", "bed", "chair", "desk", "table", "door", "kitchen", "floor", "mirror", "shelf", "stool", "pod", "safe"];
  const searchTerm = searchTerms.find((term) => text.includes(term));
  if (searchTerm) {
    try {
      const params = new URLSearchParams({ search: searchTerm, limit: "4" });
      const response = await fetch(`/api/products?${params}`);
      if (!response.ok) throw new Error("Catalog search failed.");
      const result = await response.json();
      if (result.products.length) {
        const names = result.products.map((product) => product.title).join(", ");
        return { text: `Here are a few ${searchTerm} designs to get you started: ${names}. Each one can be tailored to your space.`, actions: [{ label: `See ${searchTerm} designs`, type: "browse", value: searchTerm }] };
      }
    } catch (error) {
      return { text: "I couldn’t reach the catalog just now. You can still tell us what you need and we’ll help directly.", actions: [{ label: "Request a custom quote", type: "quote" }] };
    }
  }
  return { text: "I can help with made-to-order furniture, materials, the process or finding a design. What are you planning for your space?", actions: [{ label: "Browse designs", type: "browse" }, { label: "Talk about a quote", type: "quote" }] };
}

async function sendChatMessage(text) {
  const message = text.trim().slice(0, 500);
  if (!message) return;
  chatQuickPrompts.hidden = true;
  addChatMessage(message, "user");
  const typing = addChatTyping();
  const reply = await getChatReply(message);
  await new Promise((resolve) => window.setTimeout(resolve, 420));
  typing.remove();
  addChatMessage(reply.text, "assistant", reply.actions || []);
}

categoryFilter.addEventListener("change", () => {
  updateSubcategories();
  loadProducts();
});
subcategoryFilter.addEventListener("change", () => loadProducts());
for (const filter of [designFilter, layoutFilter, capacityFilter]) {
  filter.addEventListener("change", () => loadProducts());
}
let searchTimer;
searchInput.addEventListener("input", () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => loadProducts(), 240);
});
loadMoreButton.addEventListener("click", () => loadProducts({ append: true }));
document.querySelectorAll("[data-category]").forEach((button) => {
  button.addEventListener("click", () => {
    categoryFilter.value = button.dataset.category;
    updateSubcategories();
    loadProducts();
    document.querySelector("#catalog").scrollIntoView({ behavior: "smooth" });
  });
});
document.querySelectorAll("[data-open-quote]").forEach((button) => button.addEventListener("click", () => openQuote()));
document.querySelectorAll("[data-footer-category]").forEach((link) => {
  link.addEventListener("click", () => {
    categoryFilter.value = link.dataset.footerCategory;
    updateSubcategories();
    loadProducts();
    document.querySelector("#catalog").scrollIntoView({ behavior: "smooth" });
  });
});

const menuToggle = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".primary-navigation");
menuToggle.addEventListener("click", () => {
  const expanded = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!expanded));
  menuToggle.setAttribute("aria-label", expanded ? "Open navigation" : "Close navigation");
  navigation.classList.toggle("is-open", !expanded);
});
navigation.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Open navigation");
  navigation.classList.remove("is-open");
}));
document.querySelector(".dialog-close").addEventListener("click", () => quoteDialog.close());
document.querySelector(".product-dialog-close").addEventListener("click", () => productDialog.close());
quoteDialog.addEventListener("click", (event) => {
  if (event.target === quoteDialog) quoteDialog.close();
});
productDialog.addEventListener("click", (event) => {
  if (event.target === productDialog) productDialog.close();
});
document.querySelectorAll(".dimension-inputs input").forEach((input) => {
  if (input.closest(".dimension-visualizer")) input.addEventListener("input", updateDimensionPreview);
});
document.querySelector("#reference-images").addEventListener("change", (event) => {
  const files = [...event.target.files];
  document.querySelector("#file-list").textContent = files.length ? files.map((file) => file.name).join(", ") : "No files selected";
});

chatLauncher.addEventListener("click", () => setChatOpen(chatPanel.hidden));
chatClose.addEventListener("click", () => setChatOpen(false));
chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const message = chatInput.value;
  chatInput.value = "";
  sendChatMessage(message);
});
chatQuickPrompts.addEventListener("click", (event) => {
  const button = event.target.closest("[data-chat-prompt]");
  if (button) sendChatMessage(button.dataset.chatPrompt);
});
chatMessages.addEventListener("click", (event) => {
  const button = event.target.closest("[data-chat-action]");
  if (!button) return;
  if (button.dataset.chatAction === "quote") {
    setChatOpen(false);
    openQuote();
    return;
  }
  categoryFilter.value = "";
  updateSubcategories();
  searchInput.value = button.dataset.chatValue || "";
  loadProducts();
  setChatOpen(false);
  document.querySelector("#catalog").scrollIntoView({ behavior: "smooth" });
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !chatPanel.hidden && !quoteDialog.open) setChatOpen(false);
});

quoteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  formFeedback.textContent = "";
  const data = new FormData(quoteForm);
  const width = data.get("dimensionsWidth");
  const depth = data.get("dimensionsDepth");
  const height = data.get("dimensionsHeight");
  const dimensions = [width && `W ${width} cm`, depth && `D ${depth} cm`, height && `H ${height} cm`].filter(Boolean).join(" × ");
  const dimensionsNotes = String(data.get("dimensionsNotes") || "").trim();
  data.set("dimensions", [dimensions, dimensionsNotes].filter(Boolean).join(" · "));
  data.delete("dimensionsWidth");
  data.delete("dimensionsDepth");
  data.delete("dimensionsHeight");
  data.delete("dimensionsNotes");
  const product = selectedQuoteProduct;
  const productCode = product?.id != null ? `TZ-${String(product.id).padStart(4, "0")}` : "CUSTOM";
  const productUrl = new URL(window.location.href);
  productUrl.search = "";
  if (product?.id != null) productUrl.searchParams.set("product", String(product.id));
  productUrl.hash = "catalog";
  const whatsappText = [
    "Timezline custom quote enquiry",
    `Item: ${data.get("designReference")}`,
    `Item code: ${productCode}`,
    `Product URL: ${productUrl.href}`,
    `Name: ${data.get("name")}`,
    `Phone: ${data.get("phone")}`,
    `Email: ${data.get("email")}`,
    `Dimensions: ${dimensions || "To be discussed"}${dimensionsNotes ? `; ${dimensionsNotes}` : ""}`,
    `Material: ${data.get("material") || "To be discussed"}`,
    `Finish / color: ${data.get("finish") || "To be discussed"}`,
    `Notes: ${data.get("notes") || "None"}`
  ].join("\n");
  const whatsappUrl = `https://wa.me/923009263594?text=${encodeURIComponent(whatsappText)}`;
  const whatsappWindow = window.open("about:blank", "_blank");
  let enquirySavedWithoutWhatsAppTab = false;
  quoteButton.disabled = true;
  quoteButton.querySelector(".submit-label").textContent = "Sending…";
  try {
    const response = await fetch("/api/quotes", { method: "POST", body: data });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "We couldn’t send your request.");
    const emailStatusMessage = payload.notifications?.email === "not_configured"
      ? " Email notifications need SMTP setup."
      : payload.notifications?.email === "failed"
        ? " Email notification could not be delivered."
        : "";
    const whatsappFollowup = document.querySelector("#whatsapp-followup");
    whatsappFollowup.href = whatsappUrl;
    whatsappFollowup.hidden = false;
    if (whatsappWindow) {
      whatsappWindow.location.href = whatsappUrl;
      quoteDialog.close();
      showToast(`Thank you, ${payload.name}. Your enquiry is saved and ready to send on WhatsApp.${emailStatusMessage}`);
    } else {
      enquirySavedWithoutWhatsAppTab = true;
      quoteButton.disabled = true;
      quoteButton.querySelector(".submit-label").textContent = "Enquiry saved";
      formFeedback.textContent = `Your enquiry is saved. Use the link below to send the same details to our WhatsApp team.${emailStatusMessage}`;
      formFeedback.classList.add("success");
    }
  } catch (error) {
    if (whatsappWindow) whatsappWindow.close();
    formFeedback.textContent = error.message || "A connection issue stopped your enquiry from sending. Please try again.";
    formFeedback.classList.remove("success");
  } finally {
    if (!enquirySavedWithoutWhatsAppTab) {
      quoteButton.disabled = false;
      quoteButton.querySelector(".submit-label").textContent = "Send enquiry";
    }
  }
});

document.querySelector("#current-year").textContent = String(new Date().getFullYear());
loadAttributeFilters();
updateDimensionPreview();
loadTaxonomy();
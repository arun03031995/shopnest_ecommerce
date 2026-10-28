"use strict";

/**
 * ShopNest - Modern E-Commerce Application Logic
 * Pure vanilla JavaScript with DOM methods, Fetch API, and localStorage.
 */

// 1. Application State
let products = [];
let cart = [];
let activeCategory = "All";

// Fallback image SVG data-uri if remote network fails
const FALLBACK_IMAGE =
  "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22600%22%20height%3D%22450%22%20viewBox%3D%220%200%20600%20450%22%3E%3Crect%20fill%3D%22%23f1f5f9%22%20width%3D%22600%22%20height%3D%22450%22%2F%3E%3Ctext%20fill%3D%22%2364748b%22%20font-family%3D%22sans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22600%22%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%20dominant-baseline%3D%22middle%22%3EShopNest%20Product%3C%2Ftext%3E%3C%2Fsvg%3E";

// 2. DOM Elements Selection
const productsContainer = document.getElementById("products-container");
const searchInput = document.getElementById("search-input");
const clearSearchBtn = document.getElementById("clear-search-btn");
const categoryButtons = document.querySelectorAll(".category-btn");
const cartCount = document.getElementById("cart-count");
const cartItemsContainer = document.getElementById("cart-items");
const cartTotal = document.getElementById("cart-total");
const cartSubtotal = document.getElementById("cart-subtotal");
const cartDrawerCount = document.getElementById("cart-drawer-count");
const cartPanel = document.getElementById("cart-panel");
const cartBackdrop = document.getElementById("cart-backdrop");
const cartToggleBtn = document.getElementById("cart-toggle-btn");
const closeCartBtn = document.getElementById("close-cart-btn");
const noProductsMessage = document.getElementById("no-products");
const loadingMessage = document.getElementById("loading-message");
const errorMessage = document.getElementById("error-message");
const errorText = document.getElementById("error-text");
const retryBtn = document.getElementById("retry-btn");
const resultsCount = document.getElementById("results-count");
const clearCartButton = document.getElementById("clear-cart");
const resetFiltersBtn = document.getElementById("reset-filters-btn");
const checkoutBtn = document.getElementById("checkout-btn");
const checkoutModal = document.getElementById("checkout-modal");
const modalCloseBtn = document.getElementById("modal-close-btn");
const modalTotal = document.getElementById("modal-total");
const toastContainer = document.getElementById("toast-container");
const footerFilterLinks = document.querySelectorAll(".footer-filter-link");

// 3. Currency Formatter (Indian Rupees)
function formatPrice(price) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(price);
}

// 4. Cart Drawer Controls
function openCartDrawer() {
  cartPanel.classList.add("drawer-open");
  cartBackdrop.classList.add("active");
  cartToggleBtn.setAttribute("aria-expanded", "true");
  document.body.style.overflow = window.innerWidth <= 1024 ? "hidden" : "";
}

function closeCartDrawer() {
  cartPanel.classList.remove("drawer-open");
  cartBackdrop.classList.remove("active");
  cartToggleBtn.setAttribute("aria-expanded", "false");
  document.body.style.overflow = "";
}

// 5. Toast Notifications
function showToast(message, actionText, actionCallback) {
  const toast = document.createElement("div");
  toast.className = "toast";

  const textSpan = document.createElement("span");
  textSpan.textContent = message;
  toast.appendChild(textSpan);

  if (actionText && typeof actionCallback === "function") {
    const actionBtn = document.createElement("button");
    actionBtn.className = "toast-action-btn";
    actionBtn.textContent = actionText;
    actionBtn.type = "button";
    actionBtn.addEventListener("click", () => {
      actionCallback();
      toast.remove();
    });
    toast.appendChild(actionBtn);
  }

  toastContainer.appendChild(toast);

  // Auto-dismiss after 3.2 seconds
  setTimeout(() => {
    toast.classList.add("toast-fadeout");
    setTimeout(() => {
      toast.remove();
    }, 260);
  }, 3200);
}

// 6. Load Cart from localStorage with validation
function loadCart() {
  try {
    const savedCart = localStorage.getItem("shopnest-cart");

    if (savedCart === null) {
      cart = [];
      return;
    }

    const parsedCart = JSON.parse(savedCart);

    if (!Array.isArray(parsedCart)) {
      cart = [];
      return;
    }

    // Accept only valid cart items with positive quantities
    cart = parsedCart.filter((item) => {
      return (
        item &&
        Number.isInteger(item.id) &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0 &&
        item.quantity <= 999 &&
        Number.isFinite(item.price) &&
        item.price >= 0
      );
    });
  } catch (error) {
    console.error("Could not load saved cart from localStorage:", error);
    cart = [];
  }
}

// 7. Save Cart to localStorage
function saveCart() {
  try {
    localStorage.setItem("shopnest-cart", JSON.stringify(cart));
  } catch (error) {
    console.error("Could not save cart to localStorage:", error);
  }
}

// 8. Fetch Product Data from JSON File
async function loadProducts() {
  loadingMessage.hidden = false;
  errorMessage.hidden = true;
  noProductsMessage.hidden = true;
  productsContainer.replaceChildren();
  resultsCount.textContent = "Loading catalog...";

  try {
    const response = await fetch("./products.json");

    if (!response.ok) {
      throw new Error(`HTTP error while fetching products: ${response.status}`);
    }

    const data = await response.json();

    if (
      !Array.isArray(data) ||
      data.length === 0 ||
      !data.every((product) => {
        return (
          Number.isInteger(product.id) &&
          typeof product.name === "string" &&
          product.name.trim() !== "" &&
          typeof product.category === "string" &&
          Number.isFinite(product.price) &&
          product.price >= 0 &&
          Number.isFinite(product.originalPrice) &&
          product.originalPrice >= 0 &&
          Number.isFinite(product.rating) &&
          typeof product.imageUrl === "string"
        );
      })
    ) {
      throw new Error("Product data format is invalid or empty.");
    }

    products = data;

    // Verify and synchronize cart items with official prices and details from products.json
    cart = cart
      .filter((cartItem) => products.some((p) => p.id === cartItem.id))
      .map((cartItem) => {
        const prod = products.find((p) => p.id === cartItem.id);
        return {
          id: prod.id,
          name: prod.name,
          category: prod.category,
          price: prod.price,
          imageUrl: prod.imageUrl,
          quantity: cartItem.quantity
        };
      });

    saveCart();
    renderProducts();
    renderCart();
  } catch (error) {
    console.error("Failed to load products:", error);
    if (errorText) {
      errorText.textContent =
        "Could not load products. Please make sure products.json is available and the site is running on a local server.";
    }
    errorMessage.hidden = false;
    resultsCount.textContent = "Error loading products";
  } finally {
    loadingMessage.hidden = true;
  }
}

// 9. Create Product Card using DOM Methods
function createProductCard(product) {
  const card = document.createElement("article");
  card.className = "product-card";
  card.setAttribute("data-id", String(product.id));

  // Media Wrapper with image and badges
  const mediaWrapper = document.createElement("div");
  mediaWrapper.className = "product-media-wrapper";

  const image = document.createElement("img");
  image.className = "product-image";
  image.src = product.imageUrl;
  image.alt = product.name;
  image.loading = "lazy";

  // Fallback handler if image fails
  image.addEventListener(
    "error",
    () => {
      image.src = FALLBACK_IMAGE;
    },
    { once: true }
  );

  mediaWrapper.appendChild(image);

  // Discount Badge (if discount is >= 5%)
  if (product.originalPrice > product.price) {
    const discountPercent = Math.round(
      ((product.originalPrice - product.price) / product.originalPrice) * 100
    );
    if (discountPercent > 0) {
      const discountBadge = document.createElement("span");
      discountBadge.className = "discount-badge";
      discountBadge.textContent = `${discountPercent}% OFF`;
      mediaWrapper.appendChild(discountBadge);
    }
  }

  // Info Container
  const info = document.createElement("div");
  info.className = "product-info";

  // Top Category and Rating Row
  const topRow = document.createElement("div");
  topRow.className = "card-top-row";

  const category = document.createElement("span");
  category.className = "product-category";
  category.textContent = product.category;

  const ratingBadge = document.createElement("div");
  ratingBadge.className = "rating-badge";
  ratingBadge.setAttribute("aria-label", `Rating ${product.rating.toFixed(1)} out of 5 stars`);

  const ratingStar = document.createElement("span");
  ratingStar.className = "rating-star";
  ratingStar.textContent = "★";

  const ratingScore = document.createElement("span");
  ratingScore.textContent = product.rating.toFixed(1);

  ratingBadge.append(ratingStar, ratingScore);
  topRow.append(category, ratingBadge);

  // Product Title
  const name = document.createElement("h3");
  name.className = "product-name";
  name.textContent = product.name;

  // Pricing Row
  const priceRow = document.createElement("div");
  priceRow.className = "price-row";

  const price = document.createElement("span");
  price.className = "product-price";
  price.textContent = formatPrice(product.price);

  const originalPrice = document.createElement("span");
  originalPrice.className = "original-price";
  originalPrice.textContent = formatPrice(product.originalPrice);

  priceRow.append(price, originalPrice);

  if (product.originalPrice > product.price) {
    const savings = document.createElement("span");
    savings.className = "savings-tag";
    savings.textContent = `Save ${formatPrice(product.originalPrice - product.price)}`;
    priceRow.appendChild(savings);
  }

  // Add to Cart Button
  const addButton = document.createElement("button");
  addButton.className = "add-to-cart";
  addButton.type = "button";
  addButton.setAttribute("aria-label", `Add ${product.name} to cart`);

  const btnIcon = document.createElement("span");
  btnIcon.setAttribute("aria-hidden", "true");
  btnIcon.textContent = "🛒";

  const btnText = document.createElement("span");
  btnText.textContent = "Add to Cart";

  addButton.append(btnIcon, btnText);

  addButton.addEventListener("click", () => {
    addToCart(product);

    // Micro-interaction feedback
    addButton.classList.add("btn-added");
    btnText.textContent = "Added! ✓";
    setTimeout(() => {
      addButton.classList.remove("btn-added");
      btnText.textContent = "Add to Cart";
    }, 1200);
  });

  info.append(topRow, name, priceRow, addButton);
  card.append(mediaWrapper, info);

  return card;
}

// 10. Render Products based on Search AND Category Filters
function renderProducts() {
  const rawSearch = searchInput.value.trim().toLowerCase();

  // Toggle clear search button visibility
  if (clearSearchBtn) {
    clearSearchBtn.hidden = rawSearch.length === 0;
  }

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      rawSearch === "" ||
      product.name.toLowerCase().includes(rawSearch) ||
      product.category.toLowerCase().includes(rawSearch);

    const matchesCategory =
      activeCategory === "All" ||
      product.category.toLowerCase() === activeCategory.toLowerCase();

    return matchesSearch && matchesCategory;
  });

  // Clear previous product cards
  productsContainer.replaceChildren();

  // Append new product cards
  filteredProducts.forEach((product) => {
    productsContainer.appendChild(createProductCard(product));
  });

  // Display 'No products found' state if filtered array is empty
  const hasNoMatches = filteredProducts.length === 0;
  noProductsMessage.hidden = !hasNoMatches;

  if (hasNoMatches) {
    resultsCount.textContent = `0 products found`;
  } else {
    resultsCount.textContent = `Showing ${filteredProducts.length} product${filteredProducts.length === 1 ? "" : "s"
      }${activeCategory !== "All" ? ` in ${activeCategory}` : ""}`;
  }
}

// 11. Add Product to Cart
function addToCart(product) {
  const existingItem = cart.find((item) => item.id === product.id);

  if (existingItem) {
    if (existingItem.quantity >= 999) {
      showToast(`Maximum quantity of 999 reached for ${product.name}.`);
      return;
    }
    existingItem.quantity += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      category: product.category,
      price: product.price,
      imageUrl: product.imageUrl,
      quantity: 1
    });
  }

  updateCart();

  // Trigger bounce animation on cart badge
  cartCount.classList.remove("bump");
  void cartCount.offsetWidth; // trigger reflow
  cartCount.classList.add("bump");

  // Show friendly confirmation toast with option to open cart
  showToast(`Added "${product.name}" to cart`, "View Cart", () => {
    openCartDrawer();
  });
}

// 12. Increase Cart Item Quantity
function increaseQuantity(productId) {
  const item = cart.find((cartItem) => cartItem.id === productId);

  if (!item || item.quantity >= 999) {
    return;
  }

  item.quantity += 1;
  updateCart();
}

// 13. Decrease Cart Item Quantity
function decreaseQuantity(productId) {
  const item = cart.find((cartItem) => cartItem.id === productId);

  if (!item) {
    return;
  }

  if (item.quantity > 1) {
    item.quantity -= 1;
  } else {
    // If quantity is 1 and user decreases, remove item
    cart = cart.filter((cartItem) => cartItem.id !== productId);
  }

  updateCart();
}

// 14. Remove Product from Cart
function removeFromCart(productId) {
  const item = cart.find((i) => i.id === productId);
  const itemName = item ? item.name : "Item";
  cart = cart.filter((cartItem) => cartItem.id !== productId);
  updateCart();
  showToast(`Removed "${itemName}" from cart`);
}

// 15. Update Cart Financials and Save State
function updateCart() {
  saveCart();
  renderCart();
}

// 16. Render Shopping Cart
function renderCart() {
  cartItemsContainer.replaceChildren();

  // Total quantity of all items in cart
  const totalUnits = cart.reduce((sum, item) => sum + item.quantity, 0);
  cartCount.textContent = totalUnits;
  if (cartDrawerCount) {
    cartDrawerCount.textContent = `${totalUnits} item${totalUnits === 1 ? "" : "s"}`;
  }

  // Calculate Subtotal & Total
  const subtotalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const formattedSubtotal = formatPrice(subtotalPrice);

  if (cartSubtotal) {
    cartSubtotal.textContent = formattedSubtotal;
  }
  cartTotal.textContent = formattedSubtotal;

  // Empty state handling
  if (cart.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-cart-state";

    const emptyIcon = document.createElement("div");
    emptyIcon.className = "empty-cart-icon";
    emptyIcon.setAttribute("aria-hidden", "true");
    emptyIcon.textContent = "🛒";

    const emptyTitle = document.createElement("p");
    emptyTitle.className = "empty-cart-title";
    emptyTitle.textContent = "Your cart is empty";

    const emptySub = document.createElement("p");
    emptySub.className = "empty-cart-sub";
    emptySub.textContent = "Explore our collection and add your favorite items!";

    emptyState.append(emptyIcon, emptyTitle, emptySub);
    cartItemsContainer.appendChild(emptyState);
    return;
  }

  // Render each cart item
  cart.forEach((item) => {
    const cartItem = document.createElement("div");
    cartItem.className = "cart-item";
    cartItem.setAttribute("data-id", String(item.id));

    // Thumbnail
    const thumb = document.createElement("img");
    thumb.className = "cart-item-thumb";
    thumb.src = item.imageUrl || FALLBACK_IMAGE;
    thumb.alt = item.name;
    thumb.loading = "lazy";
    thumb.addEventListener(
      "error",
      () => {
        thumb.src = FALLBACK_IMAGE;
      },
      { once: true }
    );

    // Details container
    const details = document.createElement("div");
    details.className = "cart-item-details";

    const name = document.createElement("p");
    name.className = "cart-item-name";
    name.textContent = item.name;

    const price = document.createElement("p");
    price.className = "cart-item-price";
    price.textContent = `${formatPrice(item.price)} × ${item.quantity} = ${formatPrice(
      item.price * item.quantity
    )}`;

    // Quantity controls
    const quantityControls = document.createElement("div");
    quantityControls.className = "quantity-controls";

    const minusButton = document.createElement("button");
    minusButton.className = "quantity-btn";
    minusButton.textContent = "−";
    minusButton.type = "button";
    minusButton.setAttribute("aria-label", `Decrease ${item.name} quantity`);
    minusButton.addEventListener("click", () => {
      decreaseQuantity(item.id);
    });

    const quantityDisplay = document.createElement("span");
    quantityDisplay.className = "quantity-value";
    quantityDisplay.textContent = item.quantity;

    const plusButton = document.createElement("button");
    plusButton.className = "quantity-btn";
    plusButton.textContent = "+";
    plusButton.type = "button";
    plusButton.setAttribute("aria-label", `Increase ${item.name} quantity`);
    plusButton.disabled = item.quantity >= 999;
    plusButton.addEventListener("click", () => {
      increaseQuantity(item.id);
    });

    quantityControls.append(minusButton, quantityDisplay, plusButton);

    details.append(name, price, quantityControls);

    // Remove button
    const removeButton = document.createElement("button");
    removeButton.className = "remove-btn";
    removeButton.textContent = "Remove";
    removeButton.type = "button";
    removeButton.setAttribute("aria-label", `Remove ${item.name} from cart`);
    removeButton.addEventListener("click", () => {
      removeFromCart(item.id);
    });

    cartItem.append(thumb, details, removeButton);
    cartItemsContainer.appendChild(cartItem);
  });
}

// 17. Event Listeners

// Live search input
searchInput.addEventListener("input", renderProducts);

// Clear search button
if (clearSearchBtn) {
  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    searchInput.focus();
    renderProducts();
  });
}

// Category filter buttons
categoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeCategory = button.dataset.category || "All";

    categoryButtons.forEach((btn) => {
      const isActive = btn.dataset.category === activeCategory;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", String(isActive));
    });

    renderProducts();
  });
});

// Footer category quick links
footerFilterLinks.forEach((link) => {
  link.addEventListener("click", (e) => {
    const targetCategory = link.dataset.category;
    if (targetCategory) {
      activeCategory = targetCategory;
      categoryButtons.forEach((btn) => {
        const isActive = btn.dataset.category === activeCategory;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-selected", String(isActive));
      });
      renderProducts();
    }
  });
});

// Reset filters button (when 0 products found)
if (resetFiltersBtn) {
  resetFiltersBtn.addEventListener("click", () => {
    searchInput.value = "";
    activeCategory = "All";

    categoryButtons.forEach((btn) => {
      const isActive = btn.dataset.category === "All";
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", String(isActive));
    });

    renderProducts();
    searchInput.focus();
  });
}

// Clear the entire cart
clearCartButton.addEventListener("click", () => {
  if (cart.length === 0) return;
  cart = [];
  updateCart();
  showToast("Your cart has been cleared.");
});

// Toggle Cart Drawer
if (cartToggleBtn) {
  cartToggleBtn.addEventListener("click", () => {
    if (window.innerWidth <= 1024) {
      if (cartPanel.classList.contains("drawer-open")) {
        closeCartDrawer();
      } else {
        openCartDrawer();
      }
    } else {
      // Desktop: smoothly scroll into view of cart panel
      cartPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

if (closeCartBtn) {
  closeCartBtn.addEventListener("click", closeCartDrawer);
}

if (cartBackdrop) {
  cartBackdrop.addEventListener("click", closeCartDrawer);
}

// Checkout Button Demo Notice
if (checkoutBtn) {
  checkoutBtn.addEventListener("click", () => {
    if (cart.length === 0) {
      showToast("Your cart is empty. Add items before checking out!");
      return;
    }

    if (modalTotal) {
      modalTotal.textContent = cartTotal.textContent;
    }

    if (checkoutModal && typeof checkoutModal.showModal === "function") {
      checkoutModal.showModal();
    } else {
      alert("ShopNest is a demonstration store. No real payments are processed.");
    }
  });
}

if (modalCloseBtn && checkoutModal) {
  modalCloseBtn.addEventListener("click", () => {
    checkoutModal.close();
  });
}

// Retry button on error
if (retryBtn) {
  retryBtn.addEventListener("click", () => {
    loadProducts();
  });
}

// Keyboard shortcuts (Escape key closes drawer & modal)
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (cartPanel.classList.contains("drawer-open")) {
      closeCartDrawer();
    }
    if (checkoutModal && checkoutModal.open) {
      checkoutModal.close();
    }
  }
});

// 18. Initialize Application
loadCart();
renderCart();
loadProducts();

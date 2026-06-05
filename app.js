(function () {
  "use strict";

  const STORAGE_MENU = "restaurant_menu";
  const STORAGE_SALES = "restaurant_sales";
  const UPI_ID = "annapurna@upi";
  const GST_RATE = 0.05;

  const DEFAULT_MENU = [
    {
      id: "1",
      name: "Idly",
      price: 40,
      category: "Breakfast",
      image: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Idli_Sambar.JPG/400px-Idli_Sambar.JPG"
    },
    {
      id: "2",
      name: "Ven Pongal",
      price: 50,
      category: "Breakfast",
      image: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Ven_Pongal.JPG/400px-Ven_Pongal.JPG"
    },
    {
      id: "3",
      name: "Vada",
      price: 30,
      category: "Snacks",
      image: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Medu_vada.JPG/400px-Medu_vada.JPG"
    },
    {
      id: "4",
      name: "Dosa",
      price: 60,
      category: "Breakfast",
      image: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Masala_Dosa_at_MTR_restaurant_in_Bangalore.jpg/400px-Masala_Dosa_at_MTR_restaurant_in_Bangalore.jpg"
    },
    {
      id: "5",
      name: "Tea",
      price: 15,
      category: "Beverages",
      image: "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=400&h=300&fit=crop"
    },
    {
      id: "6",
      name: "Coffee",
      price: 20,
      category: "Beverages",
      image: "https://images.unsplash.com/photo-1495474472283-4d4bcdd0d7ad?w=400&h=300&fit=crop"
    }
  ];

  let menu = [];
  let cart = [];
  let sales = [];
  let editingId = null;
  let qrInstance = null;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function loadMenu() {
    const stored = localStorage.getItem(STORAGE_MENU);
    menu = stored ? JSON.parse(stored) : [...DEFAULT_MENU];
    if (!stored) saveMenu();
  }

  function saveMenu() {
    localStorage.setItem(STORAGE_MENU, JSON.stringify(menu));
  }

  function loadSales() {
    const stored = localStorage.getItem(STORAGE_SALES);
    sales = stored ? JSON.parse(stored) : [];
  }

  function saveSales() {
    localStorage.setItem(STORAGE_SALES, JSON.stringify(sales));
  }

  function formatCurrency(amount) {
    return "₹" + Math.round(amount);
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function getCartTotals() {
    const subtotal = cart.reduce((sum, line) => sum + line.price * line.qty, 0);
    const gst = subtotal * GST_RATE;
    const total = subtotal + gst;
    return { subtotal, gst, total };
  }

  /* ---- Tabs ---- */
  function initTabs() {
    $$(".nav-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const target = tab.dataset.tab;
        $$(".nav-tab").forEach((t) => {
          t.classList.toggle("active", t === tab);
          t.setAttribute("aria-selected", t === tab ? "true" : "false");
        });
        $$(".tab-panel").forEach((panel) => {
          panel.classList.toggle("active", panel.id === "tab-" + target);
        });
        if (target === "report") renderReport();
        if (target === "manage") renderManageTable();
      });
    });
  }

  /* ---- Menu grid (Order) ---- */
  function renderMenu() {
    const grid = $("#menu-grid");
    if (!menu.length) {
      grid.innerHTML = '<p class="empty-cart">No menu items. Add items in Manage Menu.</p>';
      return;
    }
    grid.innerHTML = menu
      .map(
        (item) => `
      <article class="menu-card" data-id="${item.id}" title="Click to add ${item.name}">
        <img src="${item.image}" alt="${item.name}" loading="lazy"
          onerror="this.src='https://placehold.co/400x300/f5e6d3/7b241c?text=${encodeURIComponent(item.name)}'">
        <div class="menu-card-body">
          <span class="category">${item.category}</span>
          <h3>${item.name}</h3>
          <span class="price">${formatCurrency(item.price)}</span>
        </div>
      </article>`
      )
      .join("");

    grid.querySelectorAll(".menu-card").forEach((card) => {
      card.addEventListener("click", () => addToCart(card.dataset.id));
    });
  }

  /* ---- Cart ---- */
  function addToCart(itemId) {
    const item = menu.find((m) => m.id === itemId);
    if (!item) return;

    const existing = cart.find((c) => c.id === itemId);
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({ id: item.id, name: item.name, price: item.price, qty: 1 });
    }
    renderCart();
  }

  function updateQty(itemId, delta) {
    const line = cart.find((c) => c.id === itemId);
    if (!line) return;
    line.qty += delta;
    if (line.qty <= 0) {
      cart = cart.filter((c) => c.id !== itemId);
    }
    renderCart();
  }

  function clearCart() {
    if (!cart.length) return;
    if (confirm("Clear all items from the cart?")) {
      cart = [];
      renderCart();
    }
  }

  function renderCart() {
    const container = $("#cart-items");
    const { subtotal, gst, total } = getCartTotals();
    const itemCount = cart.reduce((s, c) => s + c.qty, 0);

    $("#cart-count").textContent = itemCount + (itemCount === 1 ? " item" : " items");
    $("#subtotal").textContent = formatCurrency(subtotal);
    $("#gst").textContent = formatCurrency(gst);
    $("#total").textContent = formatCurrency(total);
    $("#btn-pay").disabled = cart.length === 0;

    if (!cart.length) {
      container.innerHTML = '<p class="empty-cart">Cart is empty. Select items from the menu.</p>';
      return;
    }

    container.innerHTML = cart
      .map(
        (line) => `
      <div class="cart-line">
        <div class="cart-line-info">
          <strong>${line.name}</strong>
          <span>${formatCurrency(line.price)} each</span>
        </div>
        <div class="cart-line-controls">
          <button class="qty-btn" data-action="dec" data-id="${line.id}" type="button">−</button>
          <span>${line.qty}</span>
          <button class="qty-btn" data-action="inc" data-id="${line.id}" type="button">+</button>
        </div>
        <span class="cart-line-total">${formatCurrency(line.price * line.qty)}</span>
      </div>`
      )
      .join("");

    container.querySelectorAll(".qty-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const delta = btn.dataset.action === "inc" ? 1 : -1;
        updateQty(btn.dataset.id, delta);
      });
    });
  }

  /* ---- Pay & QR ---- */
  function openPayModal() {
    if (!cart.length) return;
    const { total } = getCartTotals();
    $("#pay-amount").textContent = formatCurrency(total);
    $("#upi-display").textContent = UPI_ID;

    const qrContainer = $("#qr-code");
    qrContainer.innerHTML = "";

    const upiString = `upi://pay?pa=${UPI_ID}&pn=Annapurna%20Restaurant&am=${total.toFixed(2)}&cu=INR`;

    if (typeof QRCode !== "undefined") {
      qrInstance = new QRCode(qrContainer, {
        text: upiString,
        width: 200,
        height: 200,
        colorDark: "#2c1810",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
      });
    } else {
      qrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiString)}" alt="Payment QR Code">`;
    }

    $("#pay-modal").hidden = false;
  }

  function closePayModal() {
    $("#pay-modal").hidden = true;
    $("#qr-code").innerHTML = "";
    qrInstance = null;
  }

  function confirmPayment() {
    if (!cart.length) return;

    const { subtotal, gst, total } = getCartTotals();
    const order = {
      id: generateId(),
      date: new Date().toISOString(),
      items: cart.map((c) => ({ name: c.name, qty: c.qty, price: c.price })),
      subtotal,
      gst,
      total
    };

    sales.push(order);
    saveSales();
    cart = [];
    renderCart();
    closePayModal();
    alert("Payment recorded! Order #" + order.id.slice(-6).toUpperCase());
  }

  /* ---- Print bill ---- */
  function printBill() {
    if (!cart.length) {
      alert("Cart is empty. Add items before printing.");
      return;
    }

    const { subtotal, gst, total } = getCartTotals();
    const now = new Date();
    const receipt = $("#print-receipt");

    receipt.innerHTML = `
      <div style="text-align:center;margin-bottom:12px;">
        <strong style="font-size:16px;">ANNAPURNA</strong><br>
        South Indian Restaurant<br>
        ${now.toLocaleDateString()} ${now.toLocaleTimeString()}
      </div>
      <hr>
      ${cart
        .map(
          (line) =>
            `<div style="display:flex;justify-content:space-between;margin:4px 0;">
          <span>${line.name} x${line.qty}</span>
          <span>${formatCurrency(line.price * line.qty)}</span>
        </div>`
        )
        .join("")}
      <hr>
      <div style="display:flex;justify-content:space-between;"><span>Subtotal</span><span>${formatCurrency(subtotal)}</span></div>
      <div style="display:flex;justify-content:space-between;"><span>GST (5%)</span><span>${formatCurrency(gst)}</span></div>
      <div style="display:flex;justify-content:space-between;font-weight:bold;margin-top:6px;"><span>TOTAL</span><span>${formatCurrency(total)}</span></div>
      <hr>
      <div style="text-align:center;margin-top:12px;">Thank you! Visit again.</div>
    `;

    window.print();
  }

  /* ---- Manage menu CRUD ---- */
  function resetForm() {
    editingId = null;
    $("#item-id").value = "";
    $("#menu-form").reset();
    $("#form-title").textContent = "Add Menu Item";
    $("#btn-save").textContent = "Save Item";
    $("#btn-cancel").hidden = true;
  }

  function fillForm(item) {
    editingId = item.id;
    $("#item-id").value = item.id;
    $("#item-name").value = item.name;
    $("#item-price").value = item.price;
    $("#item-category").value = item.category;
    $("#item-image").value = item.image;
    $("#form-title").textContent = "Edit Menu Item";
    $("#btn-save").textContent = "Update Item";
    $("#btn-cancel").hidden = false;
  }

  function saveMenuItem(e) {
    e.preventDefault();

    const name = $("#item-name").value.trim();
    const price = parseFloat($("#item-price").value);
    const category = $("#item-category").value;
    const image = $("#item-image").value.trim();

    if (!name || !price || !image) return;

    if (editingId) {
      const idx = menu.findIndex((m) => m.id === editingId);
      if (idx !== -1) {
        menu[idx] = { id: editingId, name, price, category, image };
      }
    } else {
      menu.push({ id: generateId(), name, price, category, image });
    }

    saveMenu();
    resetForm();
    renderMenu();
    renderManageTable();
  }

  function deleteMenuItem(id) {
    const item = menu.find((m) => m.id === id);
    if (!item) return;
    if (!confirm(`Delete "${item.name}" from the menu?`)) return;

    menu = menu.filter((m) => m.id !== id);
    saveMenu();
    if (editingId === id) resetForm();
    renderMenu();
    renderManageTable();
  }

  function renderManageTable() {
    const tbody = $("#manage-table-body");
    if (!menu.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#6b5344;">No items yet.</td></tr>';
      return;
    }

    tbody.innerHTML = menu
      .map(
        (item) => `
      <tr>
        <td><img src="${item.image}" alt="${item.name}"
          onerror="this.src='https://placehold.co/96x96/f5e6d3/7b241c?text=${encodeURIComponent(item.name)}'"></td>
        <td><strong>${item.name}</strong></td>
        <td>${item.category}</td>
        <td>${formatCurrency(item.price)}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-sm btn-edit" data-edit="${item.id}" type="button">Edit</button>
            <button class="btn btn-sm btn-danger" data-delete="${item.id}" type="button">Delete</button>
          </div>
        </td>
      </tr>`
      )
      .join("");

    tbody.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = menu.find((m) => m.id === btn.dataset.edit);
        if (item) fillForm(item);
      });
    });

    tbody.querySelectorAll("[data-delete]").forEach((btn) => {
      btn.addEventListener("click", () => deleteMenuItem(btn.dataset.delete));
    });
  }

  /* ---- Sales report ---- */
  function initReportMonth() {
    const input = $("#report-month");
    const now = new Date();
    input.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    input.addEventListener("change", renderReport);
  }

  function renderReport() {
    const monthVal = $("#report-month").value;
    if (!monthVal) return;

    const [year, month] = monthVal.split("-").map(Number);
    const filtered = sales.filter((s) => {
      const d = new Date(s.date);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });

    const revenue = filtered.reduce((sum, o) => sum + o.total, 0);
    const itemsSold = filtered.reduce(
      (sum, o) => sum + o.items.reduce((s, i) => s + i.qty, 0),
      0
    );

    $("#stat-orders").textContent = filtered.length;
    $("#stat-revenue").textContent = formatCurrency(revenue);
    $("#stat-items").textContent = itemsSold;

    const tbody = $("#report-table-body");
    if (!filtered.length) {
      tbody.innerHTML =
        '<tr><td colspan="3" style="text-align:center;color:#6b5344;">No sales for this month.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered
      .slice()
      .reverse()
      .map((order) => {
        const d = new Date(order.date);
        const itemsList = order.items.map((i) => `${i.name} x${i.qty}`).join(", ");
        return `
        <tr>
          <td>${d.toLocaleDateString()} ${d.toLocaleTimeString()}</td>
          <td>${itemsList}</td>
          <td><strong>${formatCurrency(order.total)}</strong></td>
        </tr>`;
      })
      .join("");
  }

  /* ---- Init ---- */
  function init() {
    loadMenu();
    loadSales();
    initTabs();
    initReportMonth();

    renderMenu();
    renderCart();
    renderManageTable();

    $("#btn-clear").addEventListener("click", clearCart);
    $("#btn-print").addEventListener("click", printBill);
    $("#btn-pay").addEventListener("click", openPayModal);
    $("#btn-confirm-pay").addEventListener("click", confirmPayment);
    $("#menu-form").addEventListener("submit", saveMenuItem);
    $("#btn-cancel").addEventListener("click", resetForm);

    $$("[data-close]").forEach((el) => {
      el.addEventListener("click", closePayModal);
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();

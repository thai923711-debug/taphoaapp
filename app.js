// Lưu trữ giỏ hàng
let selectedProducts = {};
// 🔧 Hàm chuyển tên sản phẩm thành tên file không dấu, có gạch dưới
function toFileName(str) {
  return (str || "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/&/g, "va")
    .replace(/[^a-z0-9_.-]/g, ""); // loại bỏ ký tự lạ
}

let currentCategory = "Tất cả";

// Lưu lịch sử (chỉ trong RAM, không lưu localStorage)
let historyLog = [];

// ✅ Ghi lịch sử
function addHistory(action, productName, qty) {
  const now = new Date();
  const time = now.toLocaleString("vi-VN");

  historyLog.unshift({
    action,
    product: productName,
    quantity: qty,
    time
  });

  renderHistory();
}



// ✅ Render lịch sử
function renderHistory() {
  const div = document.getElementById("history-content");
  if (!div) return;
  div.innerHTML = historyLog.map((h, index) =>
    `<div class="history-item${index % 2 === 0 ? ' even' : ''}">
       <span class="time">[${h.time}]</span>
       <span class="action">${h.action}</span>
       <span class="product">sản phẩm "${h.product}"</span>
       <span class="qty">(SL: ${h.quantity})</span>
     </div>`
  ).join("");
}

// ✅ Mở / đóng overlay lịch sử
function toggleHistory() {
  const overlay = document.getElementById("history-overlay");
  if (overlay.classList.contains("show")) {
    overlay.classList.remove("show");
    setTimeout(() => { overlay.style.display = "none"; }, 300);
  } else {
    renderHistory();
    overlay.style.display = "flex";
    setTimeout(() => overlay.classList.add("show"), 10);
  }
}

// ✅ Xóa lịch sử
function clearHistory() {
  if (!confirm("Bạn có chắc muốn xóa toàn bộ lịch sử không?")) return;
  historyLog = [];
  renderHistory();
  showToast("Đã xóa toàn bộ lịch sử!");
}

// ====== Hiển thị sản phẩm ======
function renderProducts(animatedProduct = null) {
  let container = document.getElementById("product-container");
  let query = normalizeText(document.getElementById("search-box").value.toLowerCase());
  container.innerHTML = "";

  Object.entries(products).forEach(([category, items]) => {
    if (currentCategory === "Tất cả" || currentCategory === category) {
      items.forEach(name => {
        if (!query || normalizeText(name.toLowerCase()).includes(query)) {
          let productDiv = document.createElement("div");
          productDiv.classList.add("product");

          // Thêm ảnh sản phẩm
          let img = document.createElement("img");
          let imgFileName = toFileName(name);
          let imgPath = `./images/${category}/${imgFileName}.jpg`;
          console.log("Ảnh:", name, "→", imgPath);

          img.src = imgPath;
          img.alt = name;
          img.onerror = () => {
            console.warn("Không tìm thấy ảnh:", imgPath);
            img.style.display = "none";
          };
          img.classList.add("product-img");

          productDiv.appendChild(img);


          let nameSpan = document.createElement("div");
          nameSpan.textContent = name;

          let qty = selectedProducts[name] || 0;
          if (qty > 0) {
            let badge = document.createElement("span");
            badge.classList.add("qty-badge");
            badge.textContent = qty;

            if (animatedProduct === name) {
              setTimeout(() => {
                badge.classList.add("animate");
                setTimeout(() => badge.classList.remove("animate"), 300);
              }, 10);
            }
            productDiv.appendChild(badge);
          }

          productDiv.appendChild(nameSpan);
          productDiv.onclick = () => toggleProduct(name);
          if (selectedProducts[name]) productDiv.classList.add("selected");
          container.appendChild(productDiv);
        }
      });
    }
  });
}

// ====== Hiển thị danh mục ======
function renderCategories() {
  let categoryList = document.getElementById("categories");
  if (!categoryList) return;

  categoryList.innerHTML = "";

  // 1. Thêm mục "Tất cả"
  let allItem = document.createElement("li");
  allItem.textContent = "Tất cả";
  if (currentCategory === "Tất cả") allItem.classList.add("active");
  allItem.onclick = () => {
    currentCategory = "Tất cả";
    renderProducts();
    renderCategories();
    document.getElementById("sidebar").classList.remove("open");
  };
  categoryList.appendChild(allItem);

  // 2. Fix lỗi: Kiểm tra và nạp danh mục từ products.js
  // Dùng Object.keys để lấy tất cả Gia vị, Sữa, Mì...
  if (typeof products !== 'undefined' && products !== null) {
     Object.keys(products).forEach(cat => {
         let li = document.createElement("li");
         li.textContent = cat;
         if (currentCategory === cat) li.classList.add("active");
         li.onclick = () => {
             currentCategory = cat;
             renderProducts();
             renderCategories();
             document.getElementById("sidebar").classList.remove("open");
         };
         categoryList.appendChild(li);
     });
  } else {
     console.error("Biến 'products' chưa có dữ liệu!");
  }

  // 3. Thêm mục Lịch sử
  let historyItem = document.createElement("li");
  historyItem.textContent = "📜 Xem lịch sử";
  historyItem.style.marginTop = "20px"; // Cho nó tách ra một chút cho đẹp
  historyItem.onclick = () => {
    document.getElementById("sidebar").classList.remove("open");
    toggleHistory();
  };
  categoryList.appendChild(historyItem);
}

// ====== Quản lý giỏ hàng ======
function toggleProduct(name) {
  const event = window.event;
  const cartIcon = document.getElementById('cart-icon');

  if (event && cartIcon) {
    const flyer = document.createElement('div');
    flyer.className = 'flying-item';

    // Vị trí bắt đầu (ngay tại chuột)
    flyer.style.left = event.clientX + 'px';
    flyer.style.top = event.clientY + 'px';
    document.body.appendChild(flyer);

    const cartRect = cartIcon.getBoundingClientRect();

    // Để 100ms để người dùng kịp thấy viên bi xuất hiện tại chỗ click
    setTimeout(() => {
      flyer.style.left = (cartRect.left + 10) + 'px';
      flyer.style.top = (cartRect.top + 10) + 'px';
      flyer.style.transform = 'scale(0.3)';
      flyer.style.opacity = '0.7';
    }, 100); // Tăng độ trễ lên 100ms

    // Xóa sau 1.3 giây (khớp với thời gian transition 1.2s)
    setTimeout(() => {
      flyer.remove();
      cartIcon.classList.add('shake');
      setTimeout(() => cartIcon.classList.remove('shake'), 300);
    }, 1300);
  }

  // --- Logic cũ bên dưới giữ nguyên ---
  if (!selectedProducts[name]) {
    selectedProducts[name] = 1;
    addHistory("thêm mới", name, 1);
  } else {
    selectedProducts[name]++;
    addHistory("tăng", name, selectedProducts[name]);
  }
  updateSelectedList();
  renderProducts(name);
  saveCart();
  updateCartIcon();
}

function updateSelectedList() {
  let tbody = document.getElementById("selected-list");
  tbody.innerHTML = "";

  // Dùng .reverse() để đưa món mới thêm lên đầu bảng
  const entries = Object.entries(selectedProducts).reverse();

  entries.forEach(([name, qty]) => {
    let row = document.createElement("tr");

    // --- CỘT 1: SỐ LƯỢNG (Giữ nguyên logic của bạn) ---
    let qtyCell = document.createElement("td");
    qtyCell.style.textAlign = "center";
    let qtyContainer = document.createElement("div");
    qtyContainer.style.display = "flex";
    qtyContainer.style.flexDirection = "column";
    qtyContainer.style.alignItems = "center";
    qtyContainer.style.gap = "5px";

    let qtyValue = document.createElement("div");
    qtyValue.textContent = qty;
    qtyValue.style.fontWeight = "bold";
    qtyValue.style.cursor = "pointer";
    qtyValue.onclick = () => editProductQty(qtyValue, name, qty);

    let btnGroup = document.createElement("div");
    btnGroup.classList.add("qty-col");
    let minusBtn = document.createElement("button");
    minusBtn.textContent = "-";
    minusBtn.onclick = (e) => { e.stopPropagation(); changeQty(name, -1); };
    let plusBtn = document.createElement("button");
    plusBtn.textContent = "+";
    plusBtn.onclick = (e) => { e.stopPropagation(); changeQty(name, 1); };

    btnGroup.appendChild(minusBtn);
    btnGroup.appendChild(plusBtn);
    qtyContainer.appendChild(qtyValue);
    qtyContainer.appendChild(btnGroup);
    qtyCell.appendChild(qtyContainer);
    row.appendChild(qtyCell);

    // --- CỘT 2: TÊN SẢN PHẨM + HÌNH ẢNH (Phần thêm mới) ---
    let nameCell = document.createElement("td");
    nameCell.style.textAlign = "left";
    nameCell.style.paddingLeft = "10px";

    // Tạo container flex để ảnh và chữ nằm cùng hàng
    let contentWrapper = document.createElement("div");
    contentWrapper.style.display = "flex";
    contentWrapper.style.alignItems = "center";
    contentWrapper.style.gap = "10px";

    // Tìm danh mục để lấy ảnh
    let categoryFound = "Khác";
    for (let [cat, items] of Object.entries(products)) {
      if (items.includes(name)) {
        categoryFound = cat;
        break;
      }
    }

    let img = document.createElement("img");
    let imgFileName = toFileName(name);
    img.src = `./images/${categoryFound}/${imgFileName}.jpg`;
    img.style.width = "40px";
    img.style.height = "40px";
    img.style.objectFit = "contain";
    img.style.borderRadius = "4px";
    img.style.background = "#3a3a4d";
    img.onerror = () => { img.style.display = "none"; };

    let textNode = document.createElement("span");
    textNode.textContent = name;
    textNode.style.color = "white"; // Chuyển màu chữ sang trắng

    contentWrapper.appendChild(img);
    contentWrapper.appendChild(textNode);

    nameCell.appendChild(contentWrapper);
    nameCell.onclick = () => editProductName(nameCell, name);
    row.appendChild(nameCell);

    // --- CỘT 3: NÚT XÓA (Giữ nguyên logic của bạn) ---
    let removeCell = document.createElement("td");
    let removeBtn = document.createElement("span");
    removeBtn.textContent = "X";
    removeBtn.style.color = "#e74c3c";
    removeBtn.style.fontSize = "18px";
    removeBtn.style.cursor = "pointer";
    removeBtn.onclick = () => removeProduct(name);
    removeCell.appendChild(removeBtn);
    row.appendChild(removeCell);

    tbody.appendChild(row);
  });

  updateCartIcon(); //
}

function editProductName(cell, oldName) {
  let input = document.createElement("input");
  input.type = "text";
  input.value = oldName;
  input.style.width = "90%";
  input.style.padding = "4px";
  input.style.borderRadius = "4px";
  input.style.border = "1px solid #ccc";

  cell.innerHTML = "";
  cell.appendChild(input);
  input.focus();

  input.addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      saveEditedName(cell, oldName, input.value);
    }
  });
  input.addEventListener("blur", function () {
    saveEditedName(cell, oldName, input.value);
  });
}

function saveEditedName(cell, oldName, newName) {
  newName = newName.trim();
  if (!newName) newName = oldName;
  selectedProducts[newName] = selectedProducts[oldName];
  if (newName !== oldName) {
    delete selectedProducts[oldName];
  }
  addHistory("đổi tên", newName, selectedProducts[newName]);
  updateSelectedList();
  renderProducts();
  saveCart();
  updateCartIcon();
}

function editProductQty(cell, name, oldQty) {
  let input = document.createElement("input");
  input.type = "number";
  input.value = oldQty;
  input.min = 1;
  input.style.width = "60px";
  input.style.padding = "4px";
  input.style.borderRadius = "4px";
  input.style.border = "1px solid #ccc";
  input.style.textAlign = "center";

  cell.innerHTML = "";
  cell.appendChild(input);
  input.focus();

  input.addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      saveEditedQty(cell, name, input.value);
    }
  });
  input.addEventListener("blur", function () {
    saveEditedQty(cell, name, input.value);
  });
}

function saveEditedQty(cell, name, newQty) {
  newQty = parseInt(newQty);
  if (isNaN(newQty) || newQty < 1) newQty = 1;
  selectedProducts[name] = newQty;
  addHistory("sửa số lượng", name, newQty);
  updateSelectedList();
  renderProducts();
  saveCart();
  updateCartIcon();
}

// ✅ Hộp xác nhận + logic callback
function showConfirm(message, callback) {
  const overlay = document.getElementById("confirm-overlay");
  const msgBox = overlay.querySelector(".confirm-box p");
  const yesBtn = document.getElementById("confirm-yes");
  const noBtn = document.getElementById("confirm-no");

  msgBox.innerHTML = message; // Cho phép HTML hiển thị strong, màu, v.v.

  overlay.style.display = "flex";
  overlay.style.opacity = "1";

  // Xử lý click
  const cleanup = () => {
    overlay.style.display = "none";
    yesBtn.removeEventListener("click", onYes);
    noBtn.removeEventListener("click", onNo);
  };

  const onYes = () => {
    cleanup();
    callback(true);
  };

  const onNo = () => {
    cleanup();
    callback(false);
  };

  yesBtn.addEventListener("click", onYes);
  noBtn.addEventListener("click", onNo);
}

// ✅ Cập nhật số lượng (hiện hộp xác nhận + cập nhật đúng)
function changeQty(name, delta) {
  const actionText = delta > 0 ? "TĂNG" : "GIẢM";

  showConfirm(
    `Bạn có chắc muốn <strong>${actionText}</strong> số lượng của "<strong>${name}</strong>" không?`,
    (ok) => {
      if (!ok) return;

      if (selectedProducts[name]) {
        selectedProducts[name] += delta;

        if (selectedProducts[name] <= 0) {
          addHistory("xóa", name, 0);
          delete selectedProducts[name];
        } else {
          addHistory(delta > 0 ? "tăng" : "giảm", name, selectedProducts[name]);
        }
      }

      // ✅ Cập nhật lại toàn bộ giao diện
      updateSelectedList();
      renderProducts();
      saveCart();
      updateCartIcon();
    }
  );
}






function removeProduct(name) {
  delete selectedProducts[name];
  addHistory("xóa", name, 0);
  updateSelectedList();
  renderProducts();
  saveCart();
  updateCartIcon();
}

function copyList() {
  let text = Object.entries(selectedProducts).map(([name, qty]) => `${name} (${qty})`).join("\n");
  navigator.clipboard.writeText(text).then(() => showToast("Đã sao chép!"));
}

function showToast(message) {
  let toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = "show";
  setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 3000);
}

function toggleCart() {
  const overlay = document.getElementById("cart-overlay");
  if (overlay.classList.contains("show")) {
    overlay.classList.remove("show");
    setTimeout(() => { overlay.style.display = "none"; }, 300);
  } else {
    overlay.style.display = "flex";
    setTimeout(() => overlay.classList.add("show"), 10);
  }
}

function normalizeText(str) {
  return str
    .toLowerCase()
    .replace(/đ/g, "d")   // ✅ thêm dòng này
    .replace(/Đ/g, "D")   // ✅ thêm dòng này
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ /g, "_")
    .replace(/&/g, "va"); // ✅ tuỳ chọn (để xử lý dấu & trong tên)
}


function saveCart() {
  localStorage.setItem("cart", JSON.stringify(selectedProducts));
}
function loadCart() {
  let data = localStorage.getItem("cart");
  if (data) selectedProducts = JSON.parse(data);
  updateCartIcon();
}

function updateCartIcon() {
  // Tính tổng số lượng
  let total = Object.values(selectedProducts).reduce((a, b) => a + b, 0);

  // Cập nhật icon bên ngoài
  let cartCountEl = document.getElementById("cart-count");
  if (cartCountEl) cartCountEl.textContent = total;

  // Cập nhật con số kế bên chữ "Giỏ Hàng" bạn vừa thêm ở Bước 1
  let cartTotalCountEl = document.getElementById("cart-total-count");
  if (cartTotalCountEl) {
    cartTotalCountEl.textContent = `(${total})`;
  }
}

// ====== Khởi động ======
window.onload = function () {
  document.getElementById("search-box").addEventListener("input", function () {
    renderProducts();
  });

  loadCart();
  updateSelectedList();
  renderCategories();
  renderProducts();
};

// Đảm bảo nút ☰ hoạt động
document.addEventListener("DOMContentLoaded", function() {
  const menuBtn = document.getElementById("menu-btn");
  if (menuBtn) {
    menuBtn.onclick = function(e) {
      e.stopPropagation();
      document.getElementById("sidebar").classList.toggle("open");
    };
  }

  // Click ra ngoài để đóng sidebar
  document.addEventListener("click", function(e) {
    const sidebar = document.getElementById("sidebar");
    if (sidebar && !sidebar.contains(e.target) && e.target.id !== "menu-btn") {
      sidebar.classList.remove("open");
    }
  });
});

// Hàm xóa toàn bộ sản phẩm
function clearAllCart() {
  // Kiểm tra nếu giỏ hàng trống thì báo lỗi luôn
  if (Object.keys(selectedProducts).length === 0) {
    showToast("Giỏ hàng đang trống mà xóa gì ba!");
    return;
  }

  // Gọi hộp thoại xác nhận có sẵn của bạn
  showConfirm(
    "Bạn có chắc chắn muốn <strong>XÓA SẠCH</strong> toàn bộ giỏ hàng không?",
    (ok) => {
      if (ok) {
        // 1. Xóa sạch dữ liệu
        selectedProducts = {};

        // 2. Ghi vào lịch sử
        if (typeof addHistory === "function") {
            addHistory("xóa toàn bộ", "Tất cả sản phẩm", 0);
        }

        // 3. Cập nhật giao diện
        updateSelectedList(); // Vẽ lại bảng trống
        renderProducts();     // Bỏ các màu xanh đang chọn ngoài màn hình
        saveCart();           // Lưu vào localStorage
        updateCartIcon();     // Cập nhật số 0 cạnh chữ Giỏ Hàng

        showToast("Đã xóa sạch giỏ hàng!");
      }
    }
  );
}

function updateClock() {
    const now = new Date();
    const days = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

    const dayName = days[now.getDay()];
    const date = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const time = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const timeString = `${dayName}, ${date}/${month} - ${time}`;
    const timeDisplay = document.getElementById("current-time");
    if (timeDisplay) {
        timeDisplay.innerText = timeString;
    }
}

// Chạy đồng hồ ngay khi load trang
setInterval(updateClock, 1000);
updateClock();

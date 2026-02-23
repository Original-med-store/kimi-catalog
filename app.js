window.onerror = function (message, source, lineno, colno, error) {
    alert("JS Error: " + message + " at line " + lineno);
};
window.addEventListener("unhandledrejection", function (event) {
    alert("Unhandled Promise Rejection: " + event.reason);
});

// Supabase Configuration
const SUPABASE_URL = 'https://qwijottxtonytfysnguk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_HjCj62IAOLkFnKcEggjHsQ_7jkbdjGo';

let supabaseClient;
try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (e) {
    console.error("Supabase Init Error:", e);
    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('loadingSpinner').innerHTML = `<p style="color:red">خطأ في تهيئة Supabase: ${e.message}</p>`;
    });
}

// State Arrays
let allItems = [];
let allCategories = [];
let currentCategoryId = 'all';

// DOM Elements
const itemsGrid = document.getElementById('itemsGrid');
const categoriesContainer = document.getElementById('categoriesContainer');
const loadingSpinner = document.getElementById('loadingSpinner');
const noResults = document.getElementById('noResults');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');

// Modal Elements
const modal = document.getElementById("imageModal");
const modalImg = document.getElementById("img01");
const captionText = document.getElementById("caption");
const closeModal = document.querySelector(".close-modal");

// Cart Elements
let cart = JSON.parse(localStorage.getItem('kimiCart')) || [];
const cartBadge = document.getElementById('cartBadge');
const cartItemsContainer = document.getElementById('cartItemsContainer');
const cartTotal = document.getElementById('cartTotal');
const checkoutForm = document.getElementById('checkoutForm');
const cartSidebar = document.getElementById('cartSidebar');
const checkoutModal = document.getElementById('checkoutModal');

// Fallback Image URL
const FALLBACK_IMG = 'https://via.placeholder.com/300x250?text=لا+توجد+صورة';

// Initialize the App
async function init() {
    try {
        if (!supabaseClient) {
            showLoading(false);
            itemsGrid.innerHTML = `<div style="color:red; text-align:center; padding: 20px;">خطأ: لم يتم تحميل مكتبة Supabase. تأكد من اتصالك بالإنترنت.</div>`;
            return;
        }
        showLoading(true);
        await fetchCategories();
        await fetchItems();
        await checkUserSession();

        showLoading(false);
        renderCategories();
        renderItems(allItems);
        setupEventListeners();
    } catch (e) {
        showLoading(false);
        itemsGrid.innerHTML = `<div style="color:red; text-align:center; padding: 20px;">حدث خطأ رئيسي: ${e.message}</div>`;
    }
}

async function fetchCategories() {
    try {
        const { data, error } = await supabaseClient.from('categories').select('*').order('name');
        if (error) throw error;
        allCategories = data || [];
    } catch (err) {
        console.error('Error fetching categories:', err.message);
        throw new Error('فشل جلب التصنيفات: ' + err.message);
    }
}

async function fetchItems() {
    try {
        const { data, error } = await supabaseClient
            .from('items')
            .select(`
                *,
                categories ( name )
            `)
            .order('name', { ascending: true });

        if (error) throw error;
        // Transform data slightly to include category name easily
        allItems = (data || []).map(item => ({
            ...item,
            category_name: item.categories ? item.categories.name : 'بدون تصنيف'
        }));
    } catch (err) {
        console.error('Error fetching items:', err.message);
        throw new Error('فشل جلب الأصناف: ' + err.message);
    }
}

// Render Functions
function renderCategories() {
    // Keep the "All" button, append the rest
    let html = `<button class="filter-btn active" data-id="all">الكل</button>`;

    allCategories.forEach(cat => {
        html += `<button class="filter-btn" data-id="${cat.id}">${cat.name}</button>`;
    });

    categoriesContainer.innerHTML = html;
}

function renderItems(itemsToRender) {
    if (itemsToRender.length === 0) {
        itemsGrid.innerHTML = '';
        noResults.classList.remove('hidden');
        return;
    }

    noResults.classList.add('hidden');
    let html = '';

    itemsToRender.forEach((item, index) => {
        const imgUrl = item.image_url ? item.image_url : FALLBACK_IMG;
        const stockStatus = `<span class="in-stock" style="color:#2ba968;"><i class="fa-solid fa-check-circle"></i> متوفر</span>`;

        // Animation delay for a cascading entrance effect
        const animDelay = (index % 10) * 0.1;

        html += `
            <div class="item-card slide-up" style="animation-delay: ${animDelay}s">
                <div class="card-img-container" onclick="openLightbox('${imgUrl}', '${item.name}')">
                    <img src="${imgUrl}" alt="${item.name}" class="card-img" onerror="this.src='${FALLBACK_IMG}'">
                </div>
                <div class="card-body">
                    <span class="card-category">${item.category_name}</span>
                    <h3 class="card-title">${item.name}</h3>
                    <div class="card-stock">
                        ${stockStatus}
                    </div>
                    <div class="card-footer">
                        <div class="price">
                            ${parseFloat(item.sale_price).toFixed(2)} <span>ج.م</span>
                        </div>
                        <button class="add-btn" title="أضف للسلة" onclick="addToCart('${item.id}', \`${item.name}\`, ${item.sale_price}, '${imgUrl}')">
                            <i class="fa-solid fa-cart-plus"></i>
                        </button>
                    </div>
                </div>
            </div>`;
    });

    itemsGrid.innerHTML = html;
}

// Logic & Interaction
function filterAndSearch() {
    const searchTerm = searchInput.value.toLowerCase().trim();

    let filtered = allItems;

    // Filter by Category
    if (currentCategoryId !== 'all') {
        filtered = filtered.filter(item => item.category_id == currentCategoryId);
    }

    // Search by text
    if (searchTerm !== '') {
        filtered = filtered.filter(item =>
            item.name.toLowerCase().includes(searchTerm) ||
            item.category_name.toLowerCase().includes(searchTerm)
        );
    }

    renderItems(filtered);
}

function setupEventListeners() {
    // Search input
    searchInput.addEventListener('input', filterAndSearch);
    searchBtn.addEventListener('click', filterAndSearch);

    // Enter key in search
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') filterAndSearch();
    });

    // Category clicking (Event Delegation)
    categoriesContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-btn')) {
            // Remove active class from all
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            // Add active to clicked
            e.target.classList.add('active');

            // Update state and filter
            currentCategoryId = e.target.getAttribute('data-id');
            filterAndSearch();
        }
    });
}

function showLoading(show) {
    if (show) {
        loadingSpinner.classList.remove('hidden');
        itemsGrid.innerHTML = '';
        noResults.classList.add('hidden');
    } else {
        loadingSpinner.classList.add('hidden');
    }
}

// ==== Image Lightbox Functionality ====
function openLightbox(imgSrc, caption) {
    if (imgSrc.includes('placeholder')) return; // Don't zoom fallback images
    modal.classList.add("show");
    modalImg.src = imgSrc;
    captionText.innerHTML = caption;
}

closeModal.onclick = function () {
    modal.classList.remove("show");
}

// ==== Auth Modal Functionality ====
const authModal = document.getElementById('authModal');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');

function toggleAuthModal(initialTab = 'login') {
    authModal.classList.remove('hidden');
    authModal.classList.add('show');
    switchAuthTab(initialTab);
}

function closeAuthModal() {
    authModal.classList.remove('show');
    setTimeout(() => authModal.classList.add('hidden'), 300);
}

function switchAuthTab(tabName) {
    if (tabName === 'login') {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
    } else {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        registerForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
    }
}

// Close Modals when clicking outside
window.onclick = function (event) {
    if (event.target == modal) {
        modal.classList.remove("show");
    }
    if (event.target == authModal) {
        closeAuthModal();
    }
}

// ==== Supabase Auth Logic ====
let currentUser = null;

async function checkUserSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    currentUser = session?.user || null;
    updateAuthUI();
}

supabaseClient.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;
    updateAuthUI();

    // Auto populate checkout if logged in
    if (currentUser) {
        const metadata = currentUser.user_metadata || {};
        if (metadata.full_name && !document.getElementById('custName').value) {
            document.getElementById('custName').value = metadata.full_name;
        }
        if (metadata.phone && !document.getElementById('custPhone').value) {
            document.getElementById('custPhone').value = metadata.phone;
        }
    }
});

function updateAuthUI() {
    const navAuthBtn = document.getElementById('navAuthBtn');
    if (currentUser) {
        const name = currentUser.user_metadata?.full_name?.split(' ')[0] || 'حسابي';
        navAuthBtn.innerHTML = `<i class="fa-solid fa-user-check"></i> ${name}`;
        navAuthBtn.classList.add('logged-in');
        navAuthBtn.onclick = async () => {
            if (confirm('هل تريد تسجيل الخروج؟')) {
                await supabaseClient.auth.signOut();
            }
        };
    } else {
        navAuthBtn.innerHTML = `<i class="fa-solid fa-user"></i> حسابي`;
        navAuthBtn.classList.remove('logged-in');
        navAuthBtn.onclick = () => toggleAuthModal('login');
    }
}

// Register
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const phone = document.getElementById('regPhone').value;
    const password = document.getElementById('regPassword').value;
    const msgEl = document.getElementById('regMsg');

    msgEl.className = 'auth-msg';
    msgEl.textContent = 'جاري التسجيل...';

    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                full_name: name,
                phone: phone
            }
        }
    });

    if (error) {
        msgEl.classList.add('error');
        msgEl.textContent = 'خطأ: ' + error.message;
    } else {
        msgEl.classList.add('success');
        msgEl.textContent = 'تم إنشاء الحساب بنجاح! يتم الآن تسجيل دخولك...';
        setTimeout(() => closeAuthModal(), 1500);
    }
});

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const msgEl = document.getElementById('loginMsg');

    msgEl.className = 'auth-msg';
    msgEl.textContent = 'جاري التحقق...';

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        msgEl.classList.add('error');
        msgEl.textContent = 'خطأ: ' + error.message;
    } else {
        msgEl.classList.add('success');
        msgEl.textContent = 'تم تسجيل الدخول بنجاح!';
        setTimeout(() => closeAuthModal(), 1500);
    }
});

// ==== Shopping Cart Functionality ====
function toggleCart() {
    cartSidebar.classList.remove('hidden'); // Ensure base visibility
    cartSidebar.classList.toggle("show-sidebar");

    // Optional: Hide completely when closed to prevent invisible blocking
    if (!cartSidebar.classList.contains("show-sidebar")) {
        setTimeout(() => cartSidebar.classList.add('hidden'), 400); // 400ms matches CSS transition
    }
}

function addToCart(id, name, price, imgUrl) {
    const existingItem = cart.find(i => i.id === id);
    if (existingItem) {
        existingItem.qty += 1;
    } else {
        cart.push({ id, name, price, imgUrl, qty: 1 });
    }
    updateCart();

    // Quick visual feedback
    const btn = document.getElementById('floatingCartBtn');
    btn.style.transform = 'scale(1.2)';
    setTimeout(() => btn.style.transform = '', 200);
}

function updateQuantity(id, delta) {
    const itemIndex = cart.findIndex(i => i.id === id);
    if (itemIndex > -1) {
        cart[itemIndex].qty += delta;
        if (cart[itemIndex].qty <= 0) {
            cart.splice(itemIndex, 1);
        }
        updateCart();
    }
}

function removeCartItem(id) {
    cart = cart.filter(i => String(i.id) !== String(id));
    updateCart();
}

function emptyCart() {
    const cfmModal = document.getElementById('confirmModal');
    if (cfmModal) {
        cfmModal.classList.remove('hidden');
        cfmModal.classList.add('show');
    }
}

function closeConfirmModal() {
    const cfmModal = document.getElementById('confirmModal');
    if (cfmModal) {
        cfmModal.classList.remove('show');
        setTimeout(() => cfmModal.classList.add('hidden'), 300);
    }
}

function executeEmptyCart() {
    closeConfirmModal();
    cart = [];
    updateCart();
}

function updateCart() {
    // Update Badge
    const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
    cartBadge.textContent = totalItems;

    // Render Items
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<div style="text-align:center; padding: 20px; color:#999;">السلة فارغة حالياً</div>';
        cartTotal.textContent = '0.00 ج.م';
        localStorage.setItem('kimiCart', JSON.stringify(cart));
        return;
    }

    let html = '';
    let total = 0;

    cart.forEach(item => {
        const itemTotal = item.price * item.qty;
        total += itemTotal;
        html += `
            <div class="cart-item">
                <img src="${item.imgUrl}" class="cart-item-img">
                <div class="cart-item-info">
                    <div class="cart-item-title">${item.name}</div>
                    <div class="cart-item-price">${parseFloat(item.price).toFixed(2)} ج.م</div>
                </div>
                <div class="cart-item-qty">
                    <button class="qty-btn" onclick="updateQuantity('${item.id}', 1)">+</button>
                    <span>${item.qty}</span>
                    <button class="qty-btn" onclick="updateQuantity('${item.id}', -1)">-</button>
                </div>
                <button class="remove-btn" onclick="removeCartItem('${item.id}')" title="حذف الصنف"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        `;
    });

    // Add Clear Cart Button
    html += `
        <div style="text-align:center; margin-top:15px;">
            <button class="clear-cart-btn" onclick="emptyCart()">
                <i class="fa-solid fa-broom"></i> تفريغ السلة
            </button>
        </div>
    `;

    cartItemsContainer.innerHTML = html;
    cartTotal.textContent = `${total.toFixed(2)} ج.م`;

    // Save Cart to LocalStorage
    localStorage.setItem('kimiCart', JSON.stringify(cart));
}

// ==== Checkout Logic ====
function proceedToCheckout() {
    if (cart.length === 0) {
        alert("السلة فارغة. يرجى إضافة منتجات أولاً.");
        return;
    }
    // Close Sidebar
    toggleCart();
    // Open Checkout Modal
    setTimeout(() => {
        checkoutModal.classList.remove('hidden');
        checkoutModal.classList.add('show');
    }, 300); // wait for sidebar to start closing
}

function closeCheckout() {
    checkoutModal.classList.remove('show');
    setTimeout(() => checkoutModal.classList.add('hidden'), 300);
}

// Close checkout modal when clicking outside
window.addEventListener('click', function (e) {
    if (e.target == checkoutModal) {
        closeCheckout();
    }
});

// Checkout Process Form Submit
checkoutForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (cart.length === 0) {
        alert("السلة فارغة. يرجى إضافة منتجات أولاً.");
        return;
    }

    const name = document.getElementById('custName').value;
    const phone = document.getElementById('custPhone').value;
    const address = document.getElementById('custAddress').value;
    const paymentMethod = document.getElementById('paymentMethod').value;

    let total = 0;
    let orderDetails = cart.map(item => {
        total += (item.price * item.qty);
        return `▫️ ${item.qty}x ${item.name} (${(item.price * item.qty).toFixed(2)} ج.م)`;
    }).join('\\n');

    const message = `
🌟 *طلب وتوصيل جديد* 🌟
-------------------------
👤 *الاسم:* ${name}
📞 *الهاتف:* ${phone}
📍 *العنوان:* ${address || 'لم يُحدد'}
💳 *طريقة الدفع:* ${paymentMethod}
-------------------------
📦 *المنتجات:*
${orderDetails}
-------------------------
💰 *الإجمالي المطلوب:* ${total.toFixed(2)} ج.م

نرجو التأكيد والتواصل في أسرع وقت. شكراً!
`.trim();

    const whatsappNumber = '201501882143';
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;

    // Empty Cart after successful order initiation
    cart = [];
    updateCart();

    // Close checkout
    closeCheckout();

    window.open(whatsappUrl, '_blank');
});

// ==== Customer Data Persistence ====
// Save input when changed
['custName', 'custPhone', 'custAddress'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('input', function (e) {
            localStorage.setItem(`kimi_${id}`, e.target.value);
        });
    }
});

// Load saved data on init
function loadCustomerData() {
    ['custName', 'custPhone', 'custAddress'].forEach(id => {
        const savedValue = localStorage.getItem(`kimi_${id}`);
        const el = document.getElementById(id);
        if (savedValue && el) {
            el.value = savedValue;
        }
    });
}

// Initialize empty cart view
updateCart();
loadCustomerData();

// Start Application
document.addEventListener('DOMContentLoaded', init);

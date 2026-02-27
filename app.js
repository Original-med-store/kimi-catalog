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
    let html = `<button class="filter-btn active" data-id="all">
                    <div class="icon-wrapper"><i class="fa-solid fa-layer-group"></i></div>
                    <span>الرئيسية (الكل)</span>
                </button>`;

    allCategories.forEach(cat => {
        const icon = getCategoryIcon(cat.name);
        html += `<button class="filter-btn" data-id="${cat.id}">
                    <div class="icon-wrapper">${icon}</div>
                    <span>${cat.name}</span>
                 </button>`;
    });

    const categoriesContainer = document.getElementById('categoriesContainer');
    if (categoriesContainer) {
        categoriesContainer.innerHTML = html;
    }
}

function getCategoryIcon(name) {
    if (name.includes('أجهزة') || name.includes('جهاز')) return '<i class="fa-solid fa-stethoscope"></i>';
    if (name.includes('عناية') || name.includes('بشرة') || name.includes('تجميل')) return '<i class="fa-solid fa-hands-bubbles"></i>';
    if (name.includes('مستهلكات') || name.includes('مستلزمات')) return '<i class="fa-solid fa-box-open"></i>';
    if (name.includes('أثاث') || name.includes('فرش') || name.includes('سرير')) return '<i class="fa-solid fa-bed-pulse"></i>';
    if (name.includes('تحاليل') || name.includes('مختبر') || name.includes('معمل')) return '<i class="fa-solid fa-flask-vial"></i>';
    if (name.includes('أسنان')) return '<i class="fa-solid fa-tooth"></i>';
    if (name.includes('عظام')) return '<i class="fa-solid fa-bone"></i>';
    if (name.includes('عيون')) return '<i class="fa-solid fa-eye"></i>';
    if (name.includes('تنفس') || name.includes('أكسجين')) return '<i class="fa-solid fa-lungs"></i>';
    if (name.includes('جراحة')) return '<i class="fa-solid fa-scalpel"></i>';
    if (name.includes('حقن') || name.includes('سرنجات')) return '<i class="fa-solid fa-syringe"></i>';
    if (name.includes('قياس') || name.includes('ضغط') || name.includes('سكر')) return '<i class="fa-solid fa-temperature-half"></i>';
    return '<i class="fa-solid fa-heart-pulse"></i>';
}

let currentRenderedItems = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 50; // Show 50 items initially

function renderItems(itemsToRender, append = false) {
    if (!append) {
        itemsGrid.innerHTML = '';
        currentPage = 1;
        currentRenderedItems = itemsToRender;
    }

    const loadMoreContainer = document.getElementById('loadMoreContainer');

    if (currentRenderedItems.length === 0) {
        noResults.classList.remove('hidden');
        if (loadMoreContainer) loadMoreContainer.style.display = 'none';
        return;
    }

    noResults.classList.add('hidden');
    let html = '';

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const itemsSlice = currentRenderedItems.slice(startIndex, endIndex);

    itemsSlice.forEach((item, index) => {
        const imgUrl = item.image_url ? item.image_url : FALLBACK_IMG;
        const stockStatus = `<span class="in-stock" style="color:#2ba968;"><i class="fa-solid fa-check-circle"></i> متوفر</span>`;

        // Animation delay for a cascading entrance effect
        const animDelay = (index % 10) * 0.1;

        html += `
            <div class="item-card slide-up" style="animation-delay: ${animDelay}s; cursor: pointer;" onclick="openProductModal('${item.id}')">
                <div class="card-img-container">
                    <img src="${imgUrl}" alt="${item.name}" class="card-img" onerror="this.src='${FALLBACK_IMG}'">
                </div>
                <div class="card-body">
                    <a href="#" class="card-category" onclick="event.stopPropagation(); filterByCategory(event, '${item.category_id}')" title="عرض كل السلع في ${item.category_name}">${item.category_name}</a>
                    <h3 class="card-title">${item.name}</h3>
                    <div class="card-stock">
                        ${stockStatus}
                    </div>
                    <div class="card-footer">
                        <div class="price">
                            ${parseFloat(item.sale_price).toFixed(2)} <span>ج.م</span>
                        </div>
                        <button class="add-btn" title="أضف للسلة" onclick="event.stopPropagation(); addToCart('${item.id}', \`${item.name}\`, ${item.sale_price}, '${imgUrl}')">
                            <i class="fa-solid fa-cart-plus"></i>
                        </button>
                    </div>
                </div>
            </div>`;
    });

    if (append) {
        itemsGrid.insertAdjacentHTML('beforeend', html);
    } else {
        itemsGrid.innerHTML = html;
        // Scroll reset not strictly needed but good to know we start fresh
    }

    if (loadMoreContainer) {
        if (endIndex < currentRenderedItems.length) {
            loadMoreContainer.style.display = 'block';
        } else {
            loadMoreContainer.style.display = 'none';
        }
    }
}

// Logic & Interaction
function filterAndSearch() {
    const searchTerm = searchInput.value.toLowerCase().trim();

    let filtered = allItems;

    // Search by text takes priority over category filter
    if (searchTerm !== '') {
        filtered = filtered.filter(item =>
            item.name.toLowerCase().includes(searchTerm) ||
            (item.category_name && item.category_name.toLowerCase().includes(searchTerm))
        );

        // Auto-scroll to catalog when specifically typing a search
        const catalogSec = document.getElementById('catalog');
        if (catalogSec) {
            // Offset scroll to account for fixed header
            const headerOffset = window.innerWidth <= 768 ? 100 : 80;
            const elementPosition = catalogSec.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

            window.scrollTo({
                top: offsetPosition,
                behavior: "smooth"
            });
        }
    } else {
        // If no search term, filter by Category
        if (currentCategoryId !== 'all') {
            filtered = filtered.filter(item => item.category_id == currentCategoryId);
        }
    }

    // Apply sorting
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        const sortValue = sortSelect.value;
        if (sortValue === 'price-asc') {
            filtered.sort((a, b) => parseFloat(a.sale_price) - parseFloat(b.sale_price));
        } else if (sortValue === 'price-desc') {
            filtered.sort((a, b) => parseFloat(b.sale_price) - parseFloat(a.sale_price));
        }
    }

    renderItems(filtered);
}

// Function to trigger category filter programmatically (e.g., from item cards)
function filterByCategory(event, categoryId) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    if (!categoryId || categoryId === 'undefined' || categoryId === 'null') return;

    // Update State
    currentCategoryId = categoryId;

    // Update UI Buttons and Button Text
    document.querySelectorAll('.filter-btn').forEach(btn => {
        if (btn.getAttribute('data-id') == categoryId) {
            btn.classList.add('active');
            const catNameSpan = btn.querySelector('span');
            if (catNameSpan && document.getElementById('currentCategoryText')) {
                if (categoryId === 'all') {
                    document.getElementById('currentCategoryText').textContent = 'الرئيسية (الكل)';
                } else {
                    document.getElementById('currentCategoryText').textContent = catNameSpan.textContent;
                }
            }
        } else {
            btn.classList.remove('active');
        }
    });

    closeCategoriesModal();

    // Clear search if any to see full category
    searchInput.value = '';

    // Filter & render
    filterAndSearch();

    // Auto-scroll to catalog
    const catalogSec = document.getElementById('catalog');
    if (catalogSec) {
        const headerOffset = window.innerWidth <= 768 ? 130 : 80;
        const offsetPosition = catalogSec.getBoundingClientRect().top + window.pageYOffset - headerOffset;
        window.scrollTo({
            top: offsetPosition,
            behavior: "smooth"
        });
    }
}

function setupEventListeners() {
    // Search input
    searchInput.addEventListener('input', handleLiveSearch);

    // Hide dropdown on clicking outside
    document.addEventListener('mousedown', (e) => {
        const d = document.getElementById('searchResultsDropdown');
        if (d && !e.target.closest('.search-container')) {
            d.classList.add('hidden');
        }
    });

    searchBtn.addEventListener('click', filterAndSearch);

    // Enter key in search
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') filterAndSearch();
    });

    // Sorting dropdown
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', filterAndSearch);
    }

    // Load More Button
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            currentPage++;
            renderItems(currentRenderedItems, true);
        });
    }

    // Category clicking (Event Delegation)
    categoriesContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-btn');
        if (btn) {
            // Remove active class from all
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            // Add active to clicked
            btn.classList.add('active');

            // Find category id
            const categoryId = btn.getAttribute('data-id');

            // Re-use logic to actually trigger filter and panel logic
            filterByCategory(null, categoryId);
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

// ==== Global Modal Flow Manager ====
function closeTopMostModal() {
    let closedAny = false;
    if (isLightboxOpen) {
        modal.classList.remove("show");
        isLightboxOpen = false;
        closedAny = true;
    } else if (document.getElementById('confirmModal') && document.getElementById('confirmModal').classList.contains('show')) {
        const cfmModal = document.getElementById('confirmModal');
        cfmModal.classList.remove('show');
        setTimeout(() => cfmModal.classList.add('hidden'), 300);
        closedAny = true;
    } else if (checkoutModal && checkoutModal.classList.contains('show')) {
        checkoutModal.classList.remove('show');
        setTimeout(() => modal.classList.add('hidden'), 300);
        isLightboxOpen = false;
        closedAny = true;
    } else if (document.getElementById('productDetailsModal') && document.getElementById('productDetailsModal').classList.contains('show')) {
        const pModal = document.getElementById('productDetailsModal');
        pModal.classList.remove('show');
        setTimeout(() => pModal.classList.add('hidden'), 300);
        closedAny = true;
    } else if (authModal && authModal.classList.contains('show')) {
        authModal.classList.remove('show');
        setTimeout(() => authModal.classList.add('hidden'), 300);
        closedAny = true;
    } else if (contactSheet && contactSheet.classList.contains('show')) {
        contactSheet.classList.remove('show');
        setTimeout(() => contactSheet.classList.add('hidden'), 300);
        closedAny = true;
    } else if (cartSidebar && cartSidebar.classList.contains('show-sidebar')) {
        cartSidebar.classList.remove('show-sidebar');
        setTimeout(() => cartSidebar.classList.add('hidden'), 400);
        closedAny = true;
    }
    return closedAny;
}

window.addEventListener('popstate', function () {
    closeTopMostModal();
});

window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        const isOpen = isLightboxOpen ||
            (document.getElementById('productDetailsModal') && document.getElementById('productDetailsModal').classList.contains('show')) ||
            (authModal && authModal.classList.contains('show')) ||
            (cartSidebar && cartSidebar.classList.contains('show-sidebar')) ||
            (checkoutModal && checkoutModal.classList.contains('show')) ||
            (contactSheet && contactSheet.classList.contains('show')) ||
            (document.getElementById('confirmModal') && document.getElementById('confirmModal').classList.contains('show'));
        if (isOpen) history.back();
    }
});

window.addEventListener('click', function (event) {
    const pModal = document.getElementById('productDetailsModal');
    if (event.target == modal && isLightboxOpen) history.back();
    else if (event.target == pModal && pModal.classList.contains('show')) history.back();
    else if (event.target == authModal && authModal.classList.contains('show')) history.back();
    else if (event.target == contactSheet && contactSheet.classList.contains('show')) history.back();
    else if (event.target == checkoutModal && checkoutModal.classList.contains('show')) history.back();
});

// ==== Categories Panel Functionality ====
function toggleCategoriesPanel() {
    const categoriesPanel = document.getElementById('categoriesPanel');
    const btn = document.getElementById('openCategoriesBtn');
    if (!categoriesPanel) return;

    if (categoriesPanel.classList.contains('show')) {
        categoriesPanel.classList.remove('show');
        if (btn) btn.classList.remove('active-btn');
    } else {
        categoriesPanel.classList.add('show');
        if (btn) btn.classList.add('active-btn');
    }
}

function closeCategoriesModal() {
    const categoriesPanel = document.getElementById('categoriesPanel');
    const btn = document.getElementById('openCategoriesBtn');
    if (categoriesPanel && categoriesPanel.classList.contains('show')) {
        categoriesPanel.classList.remove('show');
        if (btn) btn.classList.remove('active-btn');
    }
}

// ==== Image Lightbox Functionality ====
let isLightboxOpen = false;

function openLightbox(imgSrc, caption) {
    if (imgSrc.includes('placeholder')) return; // Don't zoom fallback images
    modal.classList.remove('hidden');
    modal.classList.add("show");
    modalImg.src = imgSrc;
    captionText.innerHTML = caption;
    isLightboxOpen = true;
    history.pushState({ modal: true }, "");
}

function closeLightbox() {
    if (isLightboxOpen) history.back();
}

closeModal.onclick = function () {
    if (isLightboxOpen) history.back();
}

// ==== Product Details Modal Functionality ====
function openProductModal(itemId) {
    const item = allItems.find(i => String(i.id) === String(itemId));
    if (!item) return;

    const modal = document.getElementById('productDetailsModal');
    if (!modal) return;

    // Populate Data
    const imgUrl = item.image_url ? item.image_url : FALLBACK_IMG;
    document.getElementById('modalProductImg').src = imgUrl;

    // Fallback on error
    document.getElementById('modalProductImg').onerror = function () {
        this.src = FALLBACK_IMG;
    };

    document.getElementById('modalProductCategory').textContent = item.category_name || 'بدون قسم';
    document.getElementById('modalProductName').textContent = item.name;
    document.getElementById('modalProductPrice').textContent = parseFloat(item.sale_price).toFixed(2);

    // Stock Badge
    const stockBadge = document.getElementById('modalProductStock');
    if (item.stock > 0 || item.stock === null || item.stock === undefined) {
        stockBadge.textContent = 'متوفر';
        stockBadge.style.background = '#2ecc71';
    } else {
        stockBadge.textContent = 'غير متوفر';
        stockBadge.style.background = '#e74c3c';
    }

    // Description
    const descEl = document.getElementById('modalProductDesc');
    if (item.description && item.description.trim() !== '') {
        descEl.textContent = item.description;
    } else {
        descEl.textContent = '(لمعرفة المواصفات الدقيقة والميزات التقنية لهذا الجهاز، يسعدنا تواصلكم المباشر معنا عبر واتساب للمساعدة)';
    }

    // Set buttons actions
    const addToCartBtn = document.getElementById('modalAddToCartBtn');
    // Clear old listeners by cloning
    const newAddToCartBtn = addToCartBtn.cloneNode(true);
    addToCartBtn.parentNode.replaceChild(newAddToCartBtn, addToCartBtn);

    newAddToCartBtn.onclick = function () {
        addToCart(item.id, item.name, item.sale_price, imgUrl);
    };

    const whatsappBtn = document.getElementById('modalWhatsappBtn');
    const newWhatsappBtn = whatsappBtn.cloneNode(true);
    whatsappBtn.parentNode.replaceChild(newWhatsappBtn, whatsappBtn);

    newWhatsappBtn.onclick = function () {
        const message = `مرحباً، أود الاستفسار عن المنتج:\n*${item.name}*\nالسعر: ${parseFloat(item.sale_price).toFixed(2)} ج.م\nالقسم: ${item.category_name}\nالكود: ${item.id}`;
        const whatsappNumber = '201501882143'; // Default contact number
        const encodedMessage = encodeURIComponent(message);
        window.open(`https://wa.me/${whatsappNumber}?text=${encodedMessage}`, '_blank');
    };

    // Show Related Products
    renderRelatedProducts(item);

    // Show Modal
    modal.classList.remove('hidden');
    modal.classList.add("show");

    // Push State for browser back button
    history.pushState({ modal: true, type: 'product' }, "");
}

function closeProductModal() {
    const pModal = document.getElementById('productDetailsModal');
    if (pModal && pModal.classList.contains('show')) {
        history.back();
    }
}

// ==== Auth Modal Functionality ====
const authModal = document.getElementById('authModal');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');

function toggleAuthModal(initialTab = 'login') {
    if (!authModal.classList.contains('show')) {
        authModal.classList.remove('hidden');
        authModal.classList.add('show');
        switchAuthTab(initialTab);
        history.pushState({ modal: true }, "");
    }
}

function closeAuthModal() {
    if (authModal.classList.contains('show')) history.back();
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

// ==== Contact Bottom Sheet Functionality ====
const contactSheet = document.getElementById('contactSheet');

function toggleContactSheet() {
    if (!contactSheet) return;
    if (contactSheet.classList.contains('show')) {
        history.back();
    } else {
        contactSheet.classList.remove('hidden');
        setTimeout(() => contactSheet.classList.add('show'), 10);
        history.pushState({ modal: true }, "");
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
        // Handle specific Supabase error messages
        let errorMsg = error.message;
        if (errorMsg === "User already registered") errorMsg = "هذا البريد الإلكتروني مسجل بالفعل!";
        if (errorMsg.includes("Password should be at least")) errorMsg = "كلمة المرور يجب أن تكون 6 أحرف على الأقل.";
        msgEl.textContent = 'خطأ: ' + errorMsg;
    } else {
        msgEl.classList.add('success');
        if (data?.session) {
            msgEl.textContent = 'تم إنشاء الحساب وتسجيل الدخول بنجاح!';
        } else {
            msgEl.textContent = 'تم إنشاء الحساب! (قد يرسل لك Supabase رسالة لتبني الإيميل للمصادقة)';
            // Fallback: If auto-login doesn't happen, force a sign in
            await supabaseClient.auth.signInWithPassword({ email, password });
        }
        setTimeout(() => closeAuthModal(), 2000);
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
    if (cartSidebar.classList.contains("show-sidebar")) {
        history.back();
    } else {
        cartSidebar.classList.remove('hidden');
        setTimeout(() => cartSidebar.classList.add("show-sidebar"), 10);
        history.pushState({ modal: true }, "");
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

    // Quick visual feedback on Desktop
    const btn = document.getElementById('floatingCartBtn');
    if (btn) {
        btn.style.transform = 'scale(1.2)';
        setTimeout(() => btn.style.transform = '', 200);
    }

    // Show Toast Notification for Mobile/Desktop
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = `تم إضافة "${name}" للسلة بنجاح`;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
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
    if (cfmModal && !cfmModal.classList.contains('show')) {
        cfmModal.classList.remove('hidden');
        cfmModal.classList.add('show');
        history.pushState({ modal: true }, "");
    }
}

function closeConfirmModal() {
    const cfmModal = document.getElementById('confirmModal');
    if (cfmModal && cfmModal.classList.contains('show')) {
        history.back();
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

    // Update mobile bottom nav badge
    const navBadge = document.getElementById('navCartBadge');
    if (navBadge) {
        navBadge.textContent = totalItems;
        if (totalItems > 0) {
            navBadge.style.display = 'flex';
        } else {
            navBadge.style.display = 'none';
        }
    }

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
    // Close Sidebar securely
    if (cartSidebar.classList.contains('show-sidebar')) {
        history.back();
    }
    // Open Checkout Modal
    setTimeout(() => {
        checkoutModal.classList.remove('hidden');
        checkoutModal.classList.add('show');
        history.pushState({ modal: true }, "");
    }, 150);
}

function closeCheckout() {
    if (checkoutModal.classList.contains('show')) {
        history.back();
    }
}


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
    }).join('\n');

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

// ==========================================
// Live Search Dropdown Logic
// ==========================================
function handleLiveSearch(e) {
    const query = e.target.value.toLowerCase().trim();
    const dropdown = document.getElementById('searchResultsDropdown');

    if (query.length < 2) {
        dropdown.classList.add('hidden');
        if (query.length === 0) filterAndSearch();
        return;
    }

    const results = allItems.filter(item =>
        (item.name && item.name.toLowerCase().includes(query)) ||
        (item.category_name && item.category_name.toLowerCase().includes(query))
    ).slice(0, 6);

    if (results.length === 0) {
        dropdown.innerHTML = '<div class="search-dropdown-item" style="justify-content:center; color:#999;">لا توجد نتائج مطابقة</div>';
    } else {
        dropdown.innerHTML = '';
        results.forEach(item => {
            const a = document.createElement('a');
            a.href = "javascript:void(0);";
            a.className = 'search-dropdown-item';
            a.style.display = 'flex'; // Ensure flex works on anchor
            a.style.textDecoration = 'none'; // No underline
            a.style.color = 'inherit';

            a.innerHTML = `
                <img src="${item.image_url || FALLBACK_IMG}" onerror="this.onerror=null;this.src='${FALLBACK_IMG}';" alt="${item.name}">
                <div class="search-dropdown-info">
                    <div class="search-dropdown-name">${item.name}</div>
                    <div class="search-dropdown-cat">${item.category_name || ''}</div>
                </div>
                <div class="search-dropdown-price">${parseFloat(item.sale_price).toFixed(2)} ج.م</div>
            `;

            // Explicitly handle all click interactions directly on the anchor
            const openAction = (e) => {
                e.preventDefault();
                document.getElementById('searchInput').value = '';
                dropdown.classList.add('hidden');
                openProductModal(item.id);
            };

            a.addEventListener('mousedown', openAction);
            a.addEventListener('click', openAction);
            dropdown.appendChild(a);
        });
    }

    dropdown.classList.remove('hidden');
}

// ==========================================
// Related Products Logic
// ==========================================
function renderRelatedProducts(currentItem) {
    const container = document.getElementById('relatedProductsContainer');
    const scrollArea = document.getElementById('relatedProductsScroll');

    if (!currentItem || !currentItem.category_id) {
        container.classList.add('hidden');
        return;
    }

    const related = allItems.filter(i =>
        i.category_id === currentItem.category_id && i.id !== currentItem.id
    ).slice(0, 6);

    if (related.length === 0) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');

    scrollArea.innerHTML = related.map(item => `
        <div class="related-product-card" onclick="openProductModal('${item.id}')">
            <img class="related-product-img" src="${item.image_url || FALLBACK_IMG}" onerror="this.onerror=null;this.src='${FALLBACK_IMG}';" alt="${item.name}">
            <div class="related-product-name" title="${item.name}">${item.name}</div>
            <div class="related-product-price">${parseFloat(item.sale_price).toFixed(2)} ج.م</div>
        </div>
    `).join('');
}

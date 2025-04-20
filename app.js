// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDGpAHia_wEmrhnmYjrPf1n1TrAzwEMiAI",
    authDomain: "messageemeapp.firebaseapp.com",
    databaseURL: "https://messageemeapp-default-rtdb.firebaseio.com",
    projectId: "messageemeapp",
    storageBucket: "messageemeapp.appspot.com",
    messagingSenderId: "255034474844",
    appId: "1:255034474844:web:5e3b7a6bc4b2fb94cc4199"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Global Variables
let currentUser = null;
let currentInvestor = null;
let transactions = [];
let settings = {
    interestRate: 17.5,
    currency: 'دينار'
};

// App Initialization
document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

function initApp() {
    setupEventListeners();
    checkAuthentication();
    setupThemeSelector();
}

function setupEventListeners() {
    // Switch between login and register forms
    document.getElementById('show-register').addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('register-form').style.display = 'block';
    });
    
    document.getElementById('show-login').addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('register-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'block';
    });
    
    // Login
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('login-email').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') document.getElementById('login-password').focus();
    });
    document.getElementById('login-password').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') handleLogin();
    });
    
    // Register
    document.getElementById('register-btn').addEventListener('click', handleRegister);
    
    // Investor Verification
    document.getElementById('verify-btn').addEventListener('click', handleInvestorVerification);
    document.getElementById('investor-id-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') document.getElementById('investor-phone-input').focus();
    });
    document.getElementById('investor-phone-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') handleInvestorVerification();
    });
    
    // Format phone number as user types
    document.getElementById('investor-phone-input').addEventListener('input', function(e) {
        // Remove non-digit characters
        let value = e.target.value.replace(/\D/g, '');
        
        // Format the phone number
        if (value.length > 0 && value[0] !== '0') {
            value = '0' + value;
        }
        
        // Limit to 11 digits (standard Iraqi phone number length)
        if (value.length > 11) {
            value = value.slice(0, 11);
        }
        
        e.target.value = value;
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('logout-auth-btn').addEventListener('click', handleLogout);

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            if (!currentInvestor) return;
            const pageId = this.dataset.page;
            showPage(pageId);
        });
    });

    // Quick Actions
    document.getElementById('show-transactions').addEventListener('click', function(e) {
        e.preventDefault();
        showPage('transactions');
    });

    document.getElementById('show-profits').addEventListener('click', function(e) {
        e.preventDefault();
        showPage('profits');
    });
    
    document.getElementById('view-all-transactions').addEventListener('click', function(e) {
        e.preventDefault();
        showPage('transactions');
    });

    // Refresh Button
    document.getElementById('refresh-icon').addEventListener('click', function() {
        refreshData();
        animateRefreshIcon();
    });
    
    // Theme selector
    document.getElementById('theme-selector').addEventListener('change', function() {
        const theme = this.value;
        applyTheme(theme);
        localStorage.setItem('theme', theme);
    });
}

function setupThemeSelector() {
    const savedTheme = localStorage.getItem('theme') || 'system';
    document.getElementById('theme-selector').value = savedTheme;
    applyTheme(savedTheme);
}

function applyTheme(theme) {
    if (theme === 'system') {
        document.documentElement.removeAttribute('data-theme');
    } else {
        document.documentElement.setAttribute('data-theme', theme);
    }
}

function animateRefreshIcon() {
    const refreshIcon = document.getElementById('refresh-icon');
    refreshIcon.classList.add('rotate-animation');
    setTimeout(() => {
        refreshIcon.classList.remove('rotate-animation');
    }, 1000);
}

async function checkAuthentication() {
    try {
        // التحقق من وجود مستخدم مسجل دخوله مسبقاً
        const authUser = firebase.auth().currentUser;
        const savedEmail = localStorage.getItem('userEmail');
        
        if (authUser || savedEmail) {
            // إذا كان المستخدم مسجل الدخول، نتحقق من وجود بيانات مستثمر محفوظة
            const savedInvestorData = localStorage.getItem('investorData');
            
            if (savedEmail && !authUser) {
                // انتظار تحميل Firebase Auth
                await new Promise(resolve => {
                    const checkAuth = setInterval(() => {
                        const user = firebase.auth().currentUser;
                        if (user) {
                            clearInterval(checkAuth);
                            resolve();
                        }
                    }, 100);
                    
                    // إنهاء الانتظار بعد 5 ثوانٍ على أي حال
                    setTimeout(() => {
                        clearInterval(checkAuth);
                        resolve();
                    }, 5000);
                });
            }
            
            // تحديث بيانات المستخدم الحالي
            const user = firebase.auth().currentUser;
            if (user) {
                const userDataSnapshot = await firebase.database().ref(`appUsers/${user.uid}`).once('value');
                const userData = userDataSnapshot.val() || {};
                
                currentUser = {
                    uid: user.uid,
                    email: user.email,
                    name: userData.name || user.displayName || 'مستخدم'
                };
                
                if (savedInvestorData) {
                    // إذا كانت هناك بيانات مستثمر محفوظة، نحاول تسجيل الدخول مباشرة
                    const investorData = JSON.parse(savedInvestorData);
                    try {
                        await InvestorDataManager.verifyInvestor(investorData.id, investorData.phone);
                        showApp();
                        updateUI();
                        initializeCharts();
                        showNotification(`مرحباً ${currentInvestor.name}`, 'success');
                    } catch (error) {
                        // إذا فشل تحقق المستثمر، نعرض شاشة التحقق
                        showInvestorVerifyScreen();
                    }
                } else {
                    // إذا لم تكن هناك بيانات مستثمر محفوظة، نعرض شاشة التحقق
                    showInvestorVerifyScreen();
                }
            } else {
                // إذا لم يكن هناك مستخدم مسجل الدخول، نعرض شاشة تسجيل الدخول
                showAuthScreen();
            }
        } else {
            // لا يوجد مستخدم مسجل دخوله، نعرض شاشة تسجيل الدخول
            showAuthScreen();
        }
    } catch (error) {
        console.error("Error checking authentication:", error);
        showAuthScreen();
    }
}

function showAuthScreen() {
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('investor-verify-screen').style.display = 'none';
    document.getElementById('app').style.display = 'none';
    document.querySelector('.header').style.display = 'none';
    document.querySelector('.bottom-nav').style.display = 'none';
    
    // إظهار نموذج تسجيل الدخول وإخفاء نموذج التسجيل
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('register-form').style.display = 'none';
}

function showInvestorVerifyScreen() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('investor-verify-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
    document.querySelector('.header').style.display = 'none';
    document.querySelector('.bottom-nav').style.display = 'none';
}

function showApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('investor-verify-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.querySelector('.header').style.display = 'flex';
    document.querySelector('.bottom-nav').style.display = 'flex';
}

async function handleLogin() {
    clearErrors();
    
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    // التحقق من الإدخالات
    let hasError = false;
    
    if (!email) {
        showFieldError('login-email', 'الرجاء إدخال البريد الإلكتروني');
        hasError = true;
    } else if (!isValidEmail(email)) {
        showFieldError('login-email', 'البريد الإلكتروني غير صالح');
        hasError = true;
    }
    
    if (!password) {
        showFieldError('login-password', 'الرجاء إدخال كلمة المرور');
        hasError = true;
    }
    
    if (hasError) return;
    
    try {
        // محاولة تسجيل الدخول
        await AuthManager.loginUser(email, password);
        
        // نجاح تسجيل الدخول، عرض شاشة التحقق من المستثمر
        showInvestorVerifyScreen();
        showNotification('تم تسجيل الدخول بنجاح، الرجاء إدخال بيانات المستثمر', 'success');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function handleRegister() {
    clearErrors();
    
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    
    // التحقق من الإدخالات
    let hasError = false;
    
    if (!name) {
        showFieldError('register-name', 'الرجاء إدخال الاسم');
        hasError = true;
    }
    
    if (!email) {
        showFieldError('register-email', 'الرجاء إدخال البريد الإلكتروني');
        hasError = true;
    } else if (!isValidEmail(email)) {
        showFieldError('register-email', 'البريد الإلكتروني غير صالح');
        hasError = true;
    }
    
    if (!password) {
        showFieldError('register-password', 'الرجاء إدخال كلمة المرور');
        hasError = true;
    } else if (password.length < 6) {
        showFieldError('register-password', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
        hasError = true;
    }
    
    if (!confirmPassword) {
        showFieldError('register-confirm-password', 'الرجاء تأكيد كلمة المرور');
        hasError = true;
    } else if (password !== confirmPassword) {
        showFieldError('register-confirm-password', 'كلمتا المرور غير متطابقتين');
        hasError = true;
    }
    
    if (hasError) return;
    
    try {
        // محاولة تسجيل المستخدم
        await AuthManager.registerUser(name, email, password);
        
        // نجاح التسجيل، عرض شاشة التحقق من المستثمر
        showInvestorVerifyScreen();
        showNotification('تم إنشاء الحساب بنجاح، الرجاء إدخال بيانات المستثمر', 'success');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function handleInvestorVerification() {
    clearErrors();
    
    const investorId = document.getElementById('investor-id-input').value.trim();
    const phoneNumber = document.getElementById('investor-phone-input').value.trim();
    
    // التحقق من الإدخالات
    let hasError = false;
    
    if (!investorId) {
        showFieldError('investor-id', 'الرجاء إدخال معرف المستثمر');
        hasError = true;
    }
    
    if (!phoneNumber) {
        showFieldError('investor-phone', 'الرجاء إدخال رقم الهاتف');
        hasError = true;
    } else if (!/^0\d{10}$/.test(phoneNumber)) {
        showFieldError('investor-phone', 'يرجى إدخال رقم هاتف صحيح (11 رقم يبدأ بـ 0)');
        hasError = true;
    }
    
    if (hasError) return;
    
    try {
        // محاولة التحقق من بيانات المستثمر
        await InvestorDataManager.verifyInvestor(investorId, phoneNumber);
        
        // نجاح التحقق، عرض واجهة التطبيق
        showApp();
        updateUI();
        initializeCharts();
        showNotification(`مرحباً ${currentInvestor.name}`, 'success');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function handleLogout() {
    try {
        // تنظيف مستمعي قاعدة البيانات
        InvestorDataManager.clearListeners();
        
        // تسجيل الخروج من Firebase
        await AuthManager.logout();
        
        // العودة إلى شاشة تسجيل الدخول
        showAuthScreen();
        showNotification('تم تسجيل الخروج بنجاح', 'info');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function updateUI() {
    if (!currentInvestor) return;

    // تحديث بطاقة الرصيد
    document.getElementById('total-balance').textContent = formatCurrency(currentInvestor.balance);
    document.getElementById('pending-profits').textContent = formatCurrency(currentInvestor.profits);
    document.getElementById('interest-rate').textContent = `${currentInvestor.interestRate}%`;
    document.getElementById('due-date').textContent = currentInvestor.dueDate;

    // حساب الربح الشهري
    const monthlyProfit = (currentInvestor.balance * (currentInvestor.interestRate / 100)) / 12;
    document.getElementById('monthly-profit').textContent = formatCurrency(monthlyProfit);

    // تحديث العمليات الأخيرة
    renderRecentTransactions();

    // تحديث صفحة الإعدادات
    document.getElementById('investor-name').value = currentInvestor.name;
    document.getElementById('investor-phone').value = currentInvestor.phone;
    document.getElementById('investor-email').value = currentInvestor.email || '';
    document.getElementById('investor-address').value = currentInvestor.address || '';
    document.getElementById('investor-card').value = currentInvestor.cardNumber || '';
    document.getElementById('investor-join-date').value = formatDate(currentInvestor.joinDate);
    
    // تحديث المجاميع في صفحة العمليات
    updateTransactionTotals();
    
    // تحديث الرسوم البيانية
    updateCharts();
}

function renderRecentTransactions() {
    const container = document.getElementById('recent-transactions');
    const recentTransactions = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
    
    if (recentTransactions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="fas fa-exchange-alt"></i>
                </div>
                <div class="empty-state-title">لا توجد عمليات</div>
                <div class="empty-state-message">لم يتم تسجيل أي عمليات في محفظتك الاستثمارية حتى الآن.</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = recentTransactions.map(transaction => `
        <div class="transaction-item">
            <div class="transaction-icon ${transaction.type}">
                <i class="fas ${getTransactionIcon(transaction.type)}"></i>
            </div>
            <div class="transaction-details">
                <div class="transaction-title">${transaction.typeAr}</div>
                <div class="transaction-date">${formatDate(transaction.date)}</div>
            </div>
            <div class="transaction-amount ${transaction.type === 'withdrawal' ? 'negative' : 'positive'}">
                ${transaction.type === 'withdrawal' ? '-' : '+'} ${formatCurrency(transaction.amount)}
            </div>
        </div>
    `).join('');
}

function renderAllTransactions() {
    const container = document.getElementById('all-transactions');
    const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (sortedTransactions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="fas fa-exchange-alt"></i>
                </div>
                <div class="empty-state-title">لا توجد عمليات</div>
                <div class="empty-state-message">لم يتم تسجيل أي عمليات في محفظتك الاستثمارية حتى الآن.</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = sortedTransactions.map(transaction => `
        <div class="transaction-item">
            <div class="transaction-icon ${transaction.type}">
                <i class="fas ${getTransactionIcon(transaction.type)}"></i>
            </div>
            <div class="transaction-details">
                <div class="transaction-title">${transaction.typeAr}</div>
                <div class="transaction-date">${formatDate(transaction.date)}</div>
                ${transaction.description ? `<div style="font-size: 0.8rem; color: var(--text-muted);">${transaction.description}</div>` : ''}
            </div>
            <div class="transaction-amount ${transaction.type === 'withdrawal' ? 'negative' : 'positive'}">
                ${transaction.type === 'withdrawal' ? '-' : '+'} ${formatCurrency(transaction.amount)}
            </div>
        </div>
    `).join('');
    
    // تحديث المجاميع بعد عرض العمليات
    updateTransactionTotals();
}

function updateTransactionTotals() {
    // حساب إجمالي الإيداعات
    const totalDeposits = transactions
        .filter(t => t.type === 'deposit')
        .reduce((total, t) => total + t.amount, 0);
        
    // حساب إجمالي السحوبات
    const totalWithdrawals = transactions
        .filter(t => t.type === 'withdrawal')
        .reduce((total, t) => total + t.amount, 0);
        
    // تحديث العناصر في واجهة المستخدم
    document.getElementById('total-deposits').textContent = formatCurrency(totalDeposits);
    document.getElementById('total-withdrawals').textContent = formatCurrency(totalWithdrawals);
}

function renderProfitsDetails() {
    const container = document.getElementById('profits-details');
    
    if (!currentInvestor) return;

    // حساب تفاصيل الأرباح بشكل منطقي وتفصيلي
    const yearlyProfit = currentInvestor.balance * (currentInvestor.interestRate / 100);
    const monthlyProfit = yearlyProfit / 12;
    const dailyProfit = yearlyProfit / 365;
    
    const daysInvested = Math.floor((new Date() - new Date(currentInvestor.joinDate)) / (1000 * 60 * 60 * 24));
    const totalProfitEarned = currentInvestor.profits;
    
    // ابحث عن معاملات الأرباح
    const profitTransactions = transactions.filter(t => t.type === 'profit');
    const totalPaidProfits = profitTransactions.reduce((sum, t) => sum + t.amount, 0);

    // تحديث المحتوى
    container.innerHTML = `
        <div class="profit-summary">
            <h3 style="margin-bottom: var(--spacing-3);">الأرباح المستحقة</h3>
            <div style="font-size: 1.8rem; font-weight: bold; color: var(--color-success);">
                ${formatCurrency(totalProfitEarned)}
            </div>
        </div>

        <div class="profit-details">
            <div class="profit-details-item">
                <span class="profit-details-label">المبلغ المستثمر</span>
                <span class="profit-details-value">${formatCurrency(currentInvestor.balance)}</span>
            </div>
            <div class="profit-details-item">
                <span class="profit-details-label">نسبة الربح السنوي</span>
                <span class="profit-details-value">${currentInvestor.interestRate}%</span>
            </div>
            <div class="profit-details-item">
                <span class="profit-details-label">الربح الشهري المتوقع</span>
                <span class="profit-details-value" style="color: var(--color-success);">${formatCurrency(monthlyProfit)}</span>
            </div>
            <div class="profit-details-item">
                <span class="profit-details-label">الربح اليومي المتوقع</span>
                <span class="profit-details-value">${formatCurrency(dailyProfit)}</span>
            </div>
            <div class="profit-details-item">
                <span class="profit-details-label">عدد أيام الاستثمار</span>
                <span class="profit-details-value">${daysInvested} يوم</span>
            </div>
            <div class="profit-details-item">
                <span class="profit-details-label">إجمالي الأرباح المدفوعة</span>
                <span class="profit-details-value">${formatCurrency(totalPaidProfits)}</span>
            </div>
            <div class="profit-details-item">
                <span class="profit-details-label">تاريخ الاستحقاق القادم</span>
                <span class="profit-details-value">${currentInvestor.dueDate}</span>
            </div>
        </div>

        <div class="profit-note">
            <i class="fas fa-info-circle"></i>
            <div>يتم احتساب الأرباح على أساس يومي وتستحق الدفع في نهاية كل شهر استثماري</div>
        </div>
    `;
    
    // عرض سجل الأرباح إذا وجد
    if (profitTransactions.length > 0) {
        const profitHistoryHTML = `
            <div style="margin-top: var(--spacing-6);">
                <h3 style="margin-bottom: var(--spacing-4);">سجل دفعات الأرباح</h3>
                <div class="transaction-list">
                    ${profitTransactions.map(transaction => `
                        <div class="transaction-item">
                            <div class="transaction-icon profit">
                                <i class="fas fa-hand-holding-usd"></i>
                            </div>
                            <div class="transaction-details">
                                <div class="transaction-title">دفع أرباح</div>
                                <div class="transaction-date">${formatDate(transaction.date)}</div>
                                ${transaction.description ? `<div style="font-size: 0.8rem; color: var(--text-muted);">${transaction.description}</div>` : ''}
                            </div>
                            <div class="transaction-amount positive">
                                + ${formatCurrency(transaction.amount)}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        container.innerHTML += profitHistoryHTML;
    }
}

function showPage(pageId) {
    // إخفاء جميع الصفحات
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    // إظهار الصفحة المطلوبة
    document.getElementById(`${pageId}-page`).classList.add('active');

    // تحديث التنقل السفلي
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === pageId) {
            item.classList.add('active');
        }
    });

    // تحديث المحتوى حسب الصفحة
    if (pageId === 'transactions') {
        renderAllTransactions();
    } else if (pageId === 'profits') {
        renderProfitsDetails();
    }
}

function getTransactionIcon(type) {
    switch (type) {
        case 'deposit':
            return 'fa-arrow-up';
        case 'withdrawal':
            return 'fa-arrow-down';
        case 'profit':
            return 'fa-hand-holding-usd';
        default:
            return 'fa-exchange-alt';
    }
}

function formatCurrency(amount) {
    return `${Number(parseFloat(amount).toFixed(2)).toLocaleString()} ${settings.currency || 'دينار'}`;
}

function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('ar-EG', options);
}

async function fetchDirectTransactions() {
    try {
        showSpinner();
        
        // استخدام المسار المحدد في الطلب
        const dbRef = firebase.database().ref('users/3wLa0V9FcwSYlz9TnH77Ktle7nC2/transactions/data');
        const snapshot = await dbRef.once('value');
        const transactionsData = snapshot.val() || [];
        
        if (Array.isArray(transactionsData)) {
            // تحديث معاملات المستثمر الحالي إذا وجدت
            if (currentInvestor) {
                const investorTransactions = transactionsData.filter(t => t.investorId === currentInvestor.id);
                
                if (investorTransactions.length > 0) {
                    window.transactions = investorTransactions.map(t => ({
                        id: t.id,
                        type: InvestorDataManager.getTransactionType(t.type),
                        typeAr: t.type,
                        amount: t.amount,
                        date: t.date,
                        description: t.notes || '',
                        balanceAfter: t.balanceAfter
                    }));
                    
                    // تحديث واجهة المستخدم
                    renderRecentTransactions();
                    if (document.getElementById('transactions-page').classList.contains('active')) {
                        renderAllTransactions();
                    }
                    if (document.getElementById('profits-page').classList.contains('active')) {
                        renderProfitsDetails();
                    }
                    
                    // تحديث الرسوم البيانية
                    updateCharts();
                    
                    showNotification('تم تحديث البيانات بنجاح', 'success');
                } else {
                    showNotification('لم يتم العثور على معاملات لهذا المستثمر', 'info');
                }
            } else {
                showNotification('يرجى تسجيل الدخول أولاً', 'warning');
            }
        } else {
            console.error("Unexpected data format:", transactionsData);
            showNotification('تنسيق البيانات غير متوقع', 'error');
        }
        
        hideSpinner();
    } catch (error) {
        console.error("Error fetching transactions:", error);
        hideSpinner();
        showNotification('فشل في تحديث البيانات', 'error');
    }
}

function refreshData() {
    if (currentInvestor) {
        fetchDirectTransactions();
    } else {
        showNotification('يرجى تسجيل الدخول أولاً', 'warning');
    }
}

function showSpinner() {
    document.getElementById('spinner').classList.add('active');
}

function hideSpinner() {
    document.getElementById('spinner').classList.remove('active');
}

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notification-text');
    const notificationIcon = notification.querySelector('.notification-icon i');
    
    // تحديث النص
    notificationText.textContent = message;
    
    // تحديث الأيقونة حسب نوع الإشعار
    switch (type) {
        case 'success':
            notificationIcon.className = 'fas fa-check-circle';
            break;
        case 'error':
            notificationIcon.className = 'fas fa-times-circle';
            break;
        case 'warning':
            notificationIcon.className = 'fas fa-exclamation-triangle';
            break;
        default:
            notificationIcon.className = 'fas fa-info-circle';
    }
    
    // تطبيق التنسيق المناسب
    notification.className = `notification ${type} show`;

    // إخفاء الإشعار بعد فترة
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Validation Functions
function isValidEmail(email) {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

function clearErrors() {
    // مسح رسائل الخطأ
    document.querySelectorAll('.form-error').forEach(element => {
        element.textContent = '';
    });
    
    // إزالة تنسيق الخطأ من الحقول
    document.querySelectorAll('.form-input').forEach(element => {
        element.classList.remove('error');
    });
}

function showFieldError(fieldId, message) {
    const errorElement = document.getElementById(`${fieldId}-error`);
    const inputElement = document.getElementById(fieldId);
    
    if (errorElement) {
        errorElement.textContent = message;
    }
    
    if (inputElement) {
        inputElement.classList.add('error');
    }
}

// PWA Support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registration successful');
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}

// Install Prompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    const installButton = document.createElement('button');
    installButton.textContent = 'تثبيت التطبيق';
    installButton.className = 'btn btn-primary';
    installButton.style.position = 'fixed';
    installButton.style.bottom = '100px';
    installButton.style.left = '50%';
    installButton.style.transform = 'translateX(-50%)';
    installButton.style.zIndex = '1000';
    installButton.style.width = 'auto';
    installButton.style.padding = '12px 20px';
    installButton.style.borderRadius = '30px';
    installButton.style.boxShadow = 'var(--shadow-lg)';
    
    installButton.addEventListener('click', () => {
        installButton.style.display = 'none';
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
            }
            deferredPrompt = null;
        });
    });
    
    document.body.appendChild(installButton);
});

// Handle Network Changes
window.addEventListener('online', () => {
    showNotification('تم استعادة الاتصال بالإنترنت', 'success');
    refreshData();
});

window.addEventListener('offline', () => {
    showNotification('تم فقد الاتصال بالإنترنت', 'error');
});
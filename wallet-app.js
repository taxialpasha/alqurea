/**
 * wallet-app.js
 * نظام الاستثمار المتكامل - تطبيق محفظتي للمستثمرين
 * 
 * المطور: تم إعادة كتابته وتحسينه في أبريل 2025
 */

// وضع التصحيح
const DEBUG_MODE = false;

// =================================================================================
// التهيئة الأولية للمتغيرات العامة
// =================================================================================

// متغيرات عامة للتطبيق
let currentUser = null;         // المستخدم الحالي
let investorData = null;        // بيانات المستثمر
let transactions = [];          // العمليات
let notifications = [];         // الإشعارات
let appSettings = {};           // إعدادات التطبيق

// متغيرات المخططات البيانية
let investmentChart = null;     // مخطط الاستثمار
let profitsChart = null;        // مخطط الأرباح
let profitHistoryChart = null;  // مخطط تاريخ الأرباح

// متغيرات الصفحات
let currentPage = "dashboard";  // الصفحة الحالية
let currentPageSize = 10;       // عدد العناصر في الصفحة
let currentPageNumber = 1;      // رقم الصفحة الحالية

// معلومات المزامنة
let syncStatus = {
    lastSync: null,
    isSyncing: false
};

// =================================================================================
// دوال المساعدة (Utility Functions)
// =================================================================================

/**
 * دالة تستخدم لتسجيل رسائل التصحيح
 */
function debugLog(...args) {
    if (DEBUG_MODE) {
        console.log('DEBUG:', ...args);
    }
}

/**
 * تنسيق الأرقام بإضافة فواصل للآلاف
 * @param {number} amount الرقم المراد تنسيقه
 * @returns {string} الرقم بعد التنسيق
 */
function formatCurrency(amount) {
    if (isNaN(amount) || amount === null || amount === undefined) return "0";
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * تنسيق التاريخ بالشكل المطلوب
 * @param {string | Date} dateString التاريخ المراد تنسيقه
 * @param {boolean} includeTime إضافة الوقت للتاريخ
 * @returns {string} التاريخ بعد التنسيق
 */
function formatDate(dateString, includeTime = false) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    
    // التحقق من صحة التاريخ
    if (isNaN(date.getTime())) return '';
    
    // التنسيق الأساسي: dd/mm/yyyy
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    let formattedDate = `${day}/${month}/${year}`;
    
    // إضافة الوقت إذا كان مطلوبًا
    if (includeTime) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        formattedDate += ` ${hours}:${minutes}`;
    }
    
    return formattedDate;
}

/**
 * الحصول على اسم الشهر بالعربية
 * @param {number} monthIndex رقم الشهر (0-11)
 * @returns {string} اسم الشهر بالعربية
 */
function getMonthName(monthIndex) {
    const months = [
        'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
        'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    
    return months[monthIndex];
}

/**
 * إنشاء معرف فريد
 * @returns {string} معرف فريد
 */
function generateUniqueId(prefix = '') {
    const timestamp = new Date().getTime();
    const random = Math.floor(Math.random() * 10000);
    return `${prefix}${timestamp}-${random}`;
}

/**
 * عرض شاشة التحميل
 * @param {string} message رسالة التحميل
 */
function showLoaderOverlay(message = 'جاري التحميل...') {
    // إنشاء عنصر التحميل إذا لم يكن موجودًا
    let loader = document.getElementById('app-loader');
    
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'app-loader';
        
        loader.innerHTML = `
            <div class="loader-content">
                <img src="assets/logo.png" alt="محفظتي">
                <div class="spinner"></div>
                <p id="loader-message">${message}</p>
            </div>
        `;
        
        document.body.appendChild(loader);
    } else {
        // تحديث الرسالة
        const loaderMessage = loader.querySelector('#loader-message');
        if (loaderMessage) {
            loaderMessage.textContent = message;
        }
        
        // عرض شاشة التحميل
        loader.style.display = 'flex';
        loader.style.opacity = '1';
    }
}

/**
 * إخفاء شاشة التحميل
 */
function hideLoaderOverlay() {
    const loader = document.getElementById('app-loader');
    
    if (loader) {
        loader.style.opacity = '0';
        
        setTimeout(() => {
            loader.style.display = 'none';
        }, 300);
    }
}

/**
 * عرض إشعار مؤقت
 * @param {string} title عنوان الإشعار
 * @param {string} message محتوى الإشعار
 * @param {string} type نوع الإشعار (info, success, error, warning)
 */
function showToast(title, message, type = 'info') {
    // إنشاء عنصر الإشعار
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // تحديد أيقونة الإشعار حسب النوع
    let icon = '';
    switch (type) {
        case 'success':
            icon = 'fa-check-circle';
            break;
        case 'error':
            icon = 'fa-exclamation-circle';
            break;
        case 'warning':
            icon = 'fa-exclamation-triangle';
            break;
        default:
            icon = 'fa-info-circle';
    }
    
    // إنشاء محتوى الإشعار
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas ${icon}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" aria-label="إغلاق">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // إضافة الإشعار إلى الحاوية
    const container = document.getElementById('toast-container');
    if (container) {
        container.appendChild(toast);
        
        // إضافة معالج الأحداث لزر الإغلاق
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.classList.add('hide');
            
            setTimeout(() => {
                toast.remove();
            }, 300);
        });
        
        // إخفاء الإشعار تلقائيًا بعد 5 ثوانٍ
        setTimeout(() => {
            if (toast.parentNode) {
                toast.classList.add('hide');
                
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.remove();
                    }
                }, 300);
            }
        }, 5000);
    }
}

/**
 * عرض نافذة منبثقة
 * @param {string} title عنوان النافذة
 * @param {string} content محتوى النافذة
 * @param {string} modalId معرف النافذة (اختياري)
 */
function showModal(title, content, modalId = 'transaction-details-modal') {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    const modalTitle = modal.querySelector('.modal-header h3');
    const modalContent = modal.querySelector('.modal-body');
    
    // تعيين العنوان والمحتوى
    if (modalTitle) modalTitle.textContent = title;
    if (modalContent) modalContent.innerHTML = content;
    
    // عرض النافذة
    modal.classList.add('active');
    
    // إضافة معالج الأحداث لزر الإغلاق
    modal.querySelectorAll('.modal-close, .modal-close-btn').forEach(button => {
        button.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    });
}

// =================================================================================
// دوال واجهة المستخدم (UI Functions)
// =================================================================================

/**
 * تهيئة تفاعلات واجهة المستخدم
 */
function setupUIInteractions() {
    debugLog('تهيئة تفاعلات واجهة المستخدم');
    
    // التبديل بين علامات التبويب في شاشة تسجيل الدخول
    const authTabs = document.querySelectorAll('.auth-tab');
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // إزالة الفئة "active" من جميع علامات التبويب
            authTabs.forEach(t => t.classList.remove('active'));
            // إضافة الفئة "active" لعلامة التبويب المحددة
            tab.classList.add('active');
            
            // إخفاء جميع محتويات علامات التبويب
            document.querySelectorAll('.auth-tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // إظهار محتوى علامة التبويب المحددة
            const tabId = tab.getAttribute('data-tab');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });

    // التنقل بين صفحات التطبيق
    document.querySelectorAll('[data-page]').forEach(element => {
        element.addEventListener('click', (e) => {
            if (element.tagName.toLowerCase() === 'a') {
                e.preventDefault();
            }
            
            const pageId = element.getAttribute('data-page');
            if (pageId) {
                navigateToPage(pageId);
            }
        });
    });

    // فتح/إغلاق الشريط الجانبي
    const menuToggle = document.getElementById('menu-toggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', toggleSidebar);
    }

    // قفل الشريط الجانبي عند النقر خارجه على الشاشات الصغيرة
    document.addEventListener('click', (e) => {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && sidebar.classList.contains('active') && window.innerWidth < 1024) {
            const isClickInsideSidebar = sidebar.contains(e.target);
            const isMenuToggle = e.target === menuToggle || menuToggle.contains(e.target);
            
            if (!isClickInsideSidebar && !isMenuToggle) {
                toggleSidebar();
            }
        }
    });

    // أزرار الإشعارات
    const notificationsBtn = document.getElementById('notifications-btn');
    const closeNotifications = document.getElementById('close-notifications');
    const markAllRead = document.getElementById('mark-all-read');
    
    if (notificationsBtn) notificationsBtn.addEventListener('click', toggleNotificationsPanel);
    if (closeNotifications) closeNotifications.addEventListener('click', toggleNotificationsPanel);
    if (markAllRead) markAllRead.addEventListener('click', markAllNotificationsAsRead);

    // علامات تبويب الإشعارات
    document.querySelectorAll('.notification-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            // إزالة الفئة "active" من جميع علامات التبويب
            document.querySelectorAll('.notification-tab').forEach(t => t.classList.remove('active'));
            // إضافة الفئة "active" لعلامة التبويب المحددة
            tab.classList.add('active');
            
            // تصفية الإشعارات حسب النوع
            filterNotifications(tab.getAttribute('data-tab'));
        });
    });

    // زر تسجيل الخروج
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            confirmLogout();
        });
    }

    // تصفية المعاملات
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // تصفية المعاملات حسب النوع
            filterTransactions(btn.getAttribute('data-filter'));
        });
    });

    // البحث في المعاملات
    const transactionSearch = document.getElementById('transaction-search');
    if (transactionSearch) {
        transactionSearch.addEventListener('input', () => {
            filterTransactions(document.querySelector('.filter-btn.active').getAttribute('data-filter'));
        });
    }

    // فترات الرسوم البيانية
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            // إزالة الفئة النشطة من جميع الأزرار في نفس المجموعة
            this.parentElement.querySelectorAll('.period-btn').forEach(b => {
                b.classList.remove('active');
            });
            
            // إضافة الفئة النشطة إلى الزر المحدد
            this.classList.add('active');
            
            // تحديث الرسم البياني وفقًا للفترة المحددة
            const period = this.getAttribute('data-period');
            const chartContainer = this.closest('.chart-container');
            
            if (chartContainer.querySelector('#investment-chart')) {
                updateInvestmentChart(period);
            } else if (chartContainer.querySelector('#profits-chart')) {
                updateProfitsChart(period);
            } else if (chartContainer.querySelector('#profit-history-chart')) {
                updateProfitHistoryChart(period);
            }
        });
    });

    // نموذج طلب السحب
    setupWithdrawalForm();

    // علامات تبويب الملف الشخصي
    document.querySelectorAll('.profile-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            // إزالة الفئة "active" من جميع علامات التبويب
            document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
            // إضافة الفئة "active" لعلامة التبويب المحددة
            tab.classList.add('active');
            
            // إخفاء جميع محتويات علامات التبويب
            document.querySelectorAll('.profile-tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // إظهار محتوى علامة التبويب المحددة
            const tabId = tab.getAttribute('data-tab');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });

    // إظهار/إخفاء كلمة المرور
    document.querySelectorAll('.toggle-password').forEach(toggle => {
        toggle.addEventListener('click', function() {
            const passwordField = this.previousElementSibling;
            const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordField.setAttribute('type', type);
            
            // تغيير الأيقونة
            this.querySelector('i').classList.toggle('fa-eye');
            this.querySelector('i').classList.toggle('fa-eye-slash');
        });
    });

    // نموذج المعلومات الشخصية
    const personalInfoForm = document.getElementById('personal-info-form');
    if (personalInfoForm) {
        personalInfoForm.addEventListener('submit', (e) => {
            e.preventDefault();
            savePersonalInfo();
        });
    }

    // نموذج الأمان
    const securityForm = document.getElementById('security-form');
    if (securityForm) {
        securityForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveSecuritySettings();
        });
    }

    // إعدادات الإشعارات
    const saveNotifications = document.getElementById('save-notifications');
    if (saveNotifications) {
        saveNotifications.addEventListener('click', saveNotificationSettings);
    }

    // إعدادات التطبيق
    const saveSettings = document.getElementById('save-settings');
    const resetSettings = document.getElementById('reset-settings');
    
    if (saveSettings) saveSettings.addEventListener('click', saveAppSettings);
    if (resetSettings) resetSettings.addEventListener('click', resetAppSettings);

    // تبديل الوضع المظلم
    const darkMode = document.getElementById('dark-mode');
    if (darkMode) {
        darkMode.addEventListener('change', toggleDarkMode);
    }

    // نسيت كلمة المرور
    const forgotPassword = document.getElementById('forgot-password');
    if (forgotPassword) {
        forgotPassword.addEventListener('click', (e) => {
            e.preventDefault();
            showModal('استعادة كلمة المرور', document.getElementById('forget-password-modal').querySelector('.modal-body').innerHTML, 'forget-password-modal');
        });
    }

    // عرض جلسات الدخول
    const viewSessions = document.getElementById('view-sessions');
    if (viewSessions) {
        viewSessions.addEventListener('click', () => {
            showModal('جلسات الدخول النشطة', document.getElementById('session-details-modal').querySelector('.modal-body').innerHTML, 'session-details-modal');
        });
    }

    // تصدير الأرباح
    const exportProfits = document.getElementById('export-profits');
    if (exportProfits) {
        exportProfits.addEventListener('click', exportProfitData);
    }
    
    debugLog('تم تهيئة تفاعلات واجهة المستخدم بنجاح');
}

/**
 * إعداد نموذج السحب
 */
function setupWithdrawalForm() {
    const withdrawForm = document.getElementById('withdraw-form');
    if (!withdrawForm) return;
    
    withdrawForm.addEventListener('submit', (e) => {
        e.preventDefault();
        submitWithdrawalRequest();
    });

    // تغيير طريقة السحب
    const withdrawalMethod = document.getElementById('withdrawal-method');
    if (withdrawalMethod) {
        withdrawalMethod.addEventListener('change', () => {
            const method = withdrawalMethod.value;
            
            // إخفاء كل حقول الطرق
            const bankDetails = document.getElementById('bank-details');
            const walletDetails = document.getElementById('wallet-details');
            
            if (bankDetails) bankDetails.classList.add('hidden');
            if (walletDetails) walletDetails.classList.add('hidden');
            
            // إظهار حقول الطريقة المحددة
            if (method === 'bank' && bankDetails) {
                bankDetails.classList.remove('hidden');
            } else if (method === 'wallet' && walletDetails) {
                walletDetails.classList.remove('hidden');
            }
        });
    }

    // إلغاء السحب
    const cancelWithdraw = document.getElementById('cancel-withdraw');
    if (cancelWithdraw) {
        cancelWithdraw.addEventListener('click', () => {
            withdrawForm.reset();
            navigateToPage('dashboard');
        });
    }
}

/**
 * إعداد نظام المصادقة
 */
function setupAuthentication() {
    debugLog('تهيئة نظام المصادقة');
    
    // نماذج المصادقة
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const forgotPasswordForm = document.getElementById('forget-password-form');
    
    // معالجة تسجيل الدخول
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            
            // التحقق من البيانات
            if (!email || !password) {
                showToast('خطأ', 'يرجى إدخال البريد الإلكتروني وكلمة المرور', 'error');
                return;
            }
            
            // تسجيل الدخول
            loginWithEmailPassword(email, password);
        });
    }
    
    // معالجة إنشاء حساب
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const investorId = document.getElementById('register-investor-id').value;
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            const confirmPassword = document.getElementById('register-confirm-password').value;
            
            // التحقق من البيانات
            if (!investorId || !email || !password || !confirmPassword) {
                showToast('خطأ', 'يرجى إدخال جميع البيانات المطلوبة', 'error');
                return;
            }
            
            if (password !== confirmPassword) {
                showToast('خطأ', 'كلمة المرور وتأكيدها غير متطابقين', 'error');
                return;
            }
            
            // التحقق من قوة كلمة المرور
            if (password.length < 8) {
                showToast('خطأ', 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل', 'error');
                return;
            }
            // إنشاء حساب جديد
            registerWithEmailPassword(email, password, investorId);
        });
    }
    
    // معالجة استعادة كلمة المرور
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const email = document.getElementById('reset-email').value;
            
            if (!email) {
                showToast('خطأ', 'يرجى إدخال البريد الإلكتروني', 'error');
                return;
            }
            
            // إرسال طلب استعادة كلمة المرور
            resetPassword(email);
        });
    }
    
    debugLog('تم تهيئة نظام المصادقة بنجاح');
}

/**
 * تسجيل الدخول باستخدام البريد الإلكتروني وكلمة المرور
 * @param {string} email البريد الإلكتروني
 * @param {string} password كلمة المرور
 */
function loginWithEmailPassword(email, password) {
    // عرض حالة التحميل
    showLoaderOverlay('جاري تسجيل الدخول...');
    
    firebase.auth().signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // تسجيل الدخول بنجاح
            currentUser = userCredential.user;
            debugLog('تم تسجيل الدخول:', currentUser.email);
            
            // جلب بيانات المستثمر
            return fetchInvestorData();
        })
        .then(() => {
            hideLoaderOverlay();
            
            // عرض واجهة التطبيق
            showMainAppUI();
            
            // عرض إشعار النجاح
            showToast('تم تسجيل الدخول', 'مرحبًا بك في محفظتي', 'success');
        })
        .catch((error) => {
            debugLog('خطأ في تسجيل الدخول:', error);
            
            // عرض رسالة الخطأ
            let errorMessage = 'فشل تسجيل الدخول';
            
            switch (error.code) {
                case 'auth/user-not-found':
                    errorMessage = 'البريد الإلكتروني غير مسجل';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'كلمة المرور غير صحيحة';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'البريد الإلكتروني غير صالح';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'عدد محاولات كثيرة، يرجى المحاولة لاحقًا';
                    break;
            }
            
            hideLoaderOverlay();
            showToast('خطأ', errorMessage, 'error');
        });
}

/**
 * إنشاء حساب جديد
 * @param {string} email البريد الإلكتروني
 * @param {string} password كلمة المرور
 * @param {string} investorId معرف المستثمر
 */
function registerWithEmailPassword(email, password, investorId) {
    // عرض حالة التحميل
    showLoaderOverlay('جاري إنشاء الحساب...');
    
    // التحقق من وجود معرف المستثمر في النظام الرئيسي
    verifyInvestorId(investorId)
        .then((valid) => {
            if (!valid) {
                throw new Error('معرف المستثمر غير صالح أو غير موجود');
            }
            
            // إنشاء حساب المستخدم
            return firebase.auth().createUserWithEmailAndPassword(email, password);
        })
        .then((userCredential) => {
            // إنشاء الحساب بنجاح
            currentUser = userCredential.user;
            
            // ربط معرف المستثمر بحساب المستخدم
            return linkInvestorToUser(currentUser.uid, investorId);
        })
        .then(() => {
            hideLoaderOverlay();
            
            // عرض واجهة التطبيق
            return fetchInvestorData();
        })
        .then(() => {
            // عرض واجهة التطبيق
            showMainAppUI();
            
            // عرض إشعار النجاح
            showToast('تم إنشاء الحساب', 'تم إنشاء الحساب وربطه بحسابك الاستثماري بنجاح', 'success');
        })
        .catch((error) => {
            debugLog('خطأ في إنشاء الحساب:', error);
            
            // عرض رسالة الخطأ
            let errorMessage = 'فشل إنشاء الحساب';
            
            if (error.message) {
                errorMessage = error.message;
            } else {
                switch (error.code) {
                    case 'auth/email-already-in-use':
                        errorMessage = 'البريد الإلكتروني مستخدم بالفعل';
                        break;
                    case 'auth/invalid-email':
                        errorMessage = 'البريد الإلكتروني غير صالح';
                        break;
                    case 'auth/weak-password':
                        errorMessage = 'كلمة المرور ضعيفة';
                        break;
                }
            }
            
            hideLoaderOverlay();
            showToast('خطأ', errorMessage, 'error');
        });
}

/**
 * تأكيد تسجيل الخروج
 */
function confirmLogout() {
    const content = `
        <div class="confirm-message">
            <p>هل أنت متأكد من تسجيل الخروج؟</p>
        </div>
    `;
    
    showModal('تسجيل الخروج', content);
    
    // إضافة أزرار التأكيد
    const modalFooter = document.querySelector('#transaction-details-modal .modal-footer');
    if (modalFooter) {
        modalFooter.innerHTML = `
            <button class="btn-outline modal-close-btn">إلغاء</button>
            <button class="btn-primary" id="confirm-logout">تأكيد</button>
        `;
        
        // إضافة معالج الأحداث لزر التأكيد
        document.getElementById('confirm-logout').addEventListener('click', () => {
            document.getElementById('transaction-details-modal').classList.remove('active');
            logout();
        });
    }
}

/**
 * تسجيل الخروج
 */
function logout() {
    // عرض حالة التحميل
    showLoaderOverlay('جاري تسجيل الخروج...');
    
    firebase.auth().signOut()
        .then(() => {
            // تسجيل الخروج بنجاح
            currentUser = null;
            investorData = null;
            transactions = [];
            
            // إعادة تعيين المخططات البيانية
            if (investmentChart) investmentChart.destroy();
            if (profitsChart) profitsChart.destroy();
            if (profitHistoryChart) profitHistoryChart.destroy();
            
            investmentChart = null;
            profitsChart = null;
            profitHistoryChart = null;
            
            // عرض شاشة تسجيل الدخول
            hideLoaderOverlay();
            showLoginScreen();
            
            showToast('تم تسجيل الخروج', 'تم تسجيل الخروج بنجاح', 'info');
        })
        .catch((error) => {
            debugLog('خطأ في تسجيل الخروج:', error);
            hideLoaderOverlay();
            showToast('خطأ', 'فشل تسجيل الخروج', 'error');
        });
}

/**
 * استعادة كلمة المرور
 * @param {string} email البريد الإلكتروني
 */
function resetPassword(email) {
    // عرض حالة التحميل
    showLoaderOverlay('جاري إرسال رابط استعادة كلمة المرور...');
    
    firebase.auth().sendPasswordResetEmail(email)
        .then(() => {
            hideLoaderOverlay();
            
            // إخفاء النموذج وإظهار رسالة النجاح
            const form = document.getElementById('forget-password-form');
            const success = document.getElementById('reset-success');
            
            if (form) form.classList.add('hidden');
            if (success) success.classList.remove('hidden');
            
            showToast('تم الإرسال', 'تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني', 'success');
        })
        .catch((error) => {
            debugLog('خطأ في استعادة كلمة المرور:', error);
            
            // عرض رسالة الخطأ
            let errorMessage = 'فشل إرسال رابط استعادة كلمة المرور';
            
            switch (error.code) {
                case 'auth/user-not-found':
                    errorMessage = 'البريد الإلكتروني غير مسجل';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'البريد الإلكتروني غير صالح';
                    break;
            }
            
            hideLoaderOverlay();
            showToast('خطأ', errorMessage, 'error');
        });
}

/**
 * التحقق من معرف المستثمر
 * @param {string} investorId معرف المستثمر
 * @returns {Promise<boolean>} مؤشر على وجود المستثمر
 */
function verifyInvestorId(investorId) {
    return new Promise((resolve, reject) => {
        debugLog('جاري التحقق من معرف المستثمر:', investorId);
        
        // محاكاة البحث عن المستثمر في قاعدة البيانات
        setTimeout(() => {
            // في التطبيق الحقيقي: سيتم البحث في قاعدة البيانات
            // هنا نفترض أن المعرف صالح إذا كان يبدأ بـ INV- وطوله 10 أحرف
            const isValid = investorId.startsWith('INV-') && investorId.length === 10;
            
            debugLog('نتيجة التحقق:', isValid);
            resolve(isValid);
        }, 1500);
    });
}

/**
 * ربط معرف المستثمر بحساب المستخدم
 * @param {string} userId معرف المستخدم
 * @param {string} investorId معرف المستثمر
 * @returns {Promise<void>}
 */
function linkInvestorToUser(userId, investorId) {
    return new Promise((resolve, reject) => {
        debugLog('جاري ربط المستثمر بالمستخدم:', userId, investorId);
        
        // محاكاة ربط المستثمر بالمستخدم
        setTimeout(() => {
            // في التطبيق الحقيقي: سيتم ربط المستثمر بالمستخدم في قاعدة البيانات
            // هنا نفترض أن العملية نجحت
            
            debugLog('تم ربط المستثمر بالمستخدم بنجاح');
            resolve();
        }, 1500);
    });
}

/**
 * جلب بيانات المستثمر
 * @returns {Promise<Object>} بيانات المستثمر
 */
// التحديث المطلوب لربط التطبيق بقاعدة بيانات Firebase الحقيقية لجلب بيانات المستثمر الفعلية

/**
 * الخطوة 1: تعديل دالة fetchInvestorData
 * - استبدال البيانات الوهمية بجلب البيانات من Realtime Database بناءً على uid المستخدم.
 */
function fetchInvestorData() {
    return new Promise((resolve, reject) => {
        if (!currentUser) {
            console.error('لا يوجد مستخدم حالي');
            reject(new Error('المستخدم غير مسجل الدخول'));
            return;
        }

        // عرض التحميل
        showLoaderOverlay('جاري تحميل بيانات المستثمر...');

        const userId = currentUser.uid;
        const dbRef = firebase.database().ref(`users/${userId}/investorData`);

        dbRef.once('value')
            .then(snapshot => {
                const data = snapshot.val();
                if (!data) {
                    throw new Error('لم يتم العثور على بيانات المستثمر');
                }

                investorData = data;

                // تحميل صورة المستخدم إن وجدت
                if (investorData.photoURL) {
                    document.getElementById('user-avatar').src = investorData.photoURL;
                    document.getElementById('sidebar-avatar').src = investorData.photoURL;
                }

                // عرض اسم وبريد المستخدم
                document.getElementById('user-name').textContent = investorData.name || 'اسم غير معروف';
                document.getElementById('user-email').textContent = investorData.email || currentUser.email;
                document.getElementById('investor-name').textContent = investorData.name || 'اسم المستثمر';

                hideLoaderOverlay();
                resolve(investorData);
            })
            .catch(error => {
                console.error('فشل في تحميل بيانات المستثمر:', error);
                hideLoaderOverlay();
                showToast('خطأ', 'فشل في تحميل بيانات المستثمر', 'error');
                reject(error);
            });
    });
}

/**
 * الخطوة 2: عند إنشاء حساب، خزّن بيانات المستثمر تحت users/{uid}/investorData
 */
function linkInvestorToUser(userId, investorId) {
    return new Promise((resolve, reject) => {
        const ref = firebase.database().ref(`users/${userId}/investorData`);
        const email = currentUser.email;

        const investor = {
            id: investorId,
            name: 'مستثمر جديد',
            email: email,
            phone: '',
            address: '',
            cardNumber: '',
            amount: 0,
            interestRate: 17.5,
            joinDate: new Date().toISOString(),
            status: 'active',
            photoURL: ''
        };

        ref.set(investor)
            .then(() => resolve())
            .catch(reject);
    });
}

/**
 * إنشاء بيانات مستثمر وهمية للاختبار
 * @returns {Object} بيانات المستثمر الوهمية
 */
function generateMockInvestorData() {
    return {
        id: 'INV-' + Math.floor(100000 + Math.random() * 900000),
        name: 'محمد أحمد العبدالله',
        email: currentUser ? currentUser.email : 'example@mail.com',
        phone: '0501234567',
        address: 'الرياض، حي النخيل',
        cardNumber: 'ID' + Math.floor(10000000 + Math.random() * 90000000),
        amount: 100000000, // المبلغ المستثمر
        interestRate: 17.5, // نسبة الربح
        joinDate: new Date(2023, 5, 15).toISOString(), // تاريخ الانضمام
        status: 'active', // حالة الحساب
        photoURL: null // رابط الصورة الشخصية
    };
}

/**
 * إنشاء معاملات وهمية للاختبار
 * @param {Object} investorData بيانات المستثمر
 * @returns {Array} المعاملات الوهمية
 */
function generateMockTransactions(investorData) {
    const mockTransactions = [];
    const types = ['إيداع', 'سحب', 'دفع أرباح'];
    const statuses = ['completed', 'pending', 'canceled'];
    
    // إنشاء 10 معاملات عشوائية
    for (let i = 0; i < 10; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        const isWithdraw = type === 'سحب';
        const isProfit = type === 'دفع أرباح';
        
        // تحديد مبلغ المعاملة
        let amount;
        if (isProfit) {
            // مبلغ الربح: 1-2% من المبلغ المستثمر
            amount = Math.round(investorData.amount * (Math.random() * 0.01 + 0.01));
        } else {
            // مبلغ الإيداع أو السحب: 1-10% من المبلغ المستثمر
            amount = Math.round(investorData.amount * (Math.random() * 0.09 + 0.01));
        }
        
        // تحديد تاريخ المعاملة (خلال الـ 6 أشهر الماضية)
        const date = new Date();
        date.setMonth(date.getMonth() - Math.floor(Math.random() * 6));
        date.setDate(Math.floor(Math.random() * 28) + 1);
        
        // تحديد حالة المعاملة
        let status = statuses[Math.floor(Math.random() * statuses.length)];
        
        // إذا كانت المعاملة أقدم من شهر، فهي مكتملة
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        if (date < oneMonthAgo) {
            status = 'completed';
        }
        
        // إنشاء معاملة جديدة
        const transaction = {
            id: 'TRX-' + Math.floor(100000 + Math.random() * 900000),
            date: date.toISOString(),
            type: type,
            amount: amount,
            status: status,
            balanceAfter: status === 'completed' ? (investorData.amount + (isWithdraw ? -amount : amount)) : null,
            method: isWithdraw ? (Math.random() > 0.5 ? 'bank' : 'wallet') : null,
            notes: isWithdraw ? 'طلب سحب بتاريخ ' + formatDate(date) : null
        };
        
        mockTransactions.push(transaction);
    }
    
    // ترتيب المعاملات من الأحدث إلى الأقدم
    mockTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return mockTransactions;
}

/**
 * إنشاء إشعارات وهمية للاختبار
 * @returns {Array} الإشعارات الوهمية
 */
function generateMockNotifications() {
    const mockNotifications = [];
    const types = ['profit', 'transaction', 'system'];
    const titles = {
        profit: ['إيداع أرباح', 'أرباح جديدة', 'تم صرف الأرباح'],
        transaction: ['طلب سحب', 'تم تحديث حالة طلب السحب', 'تم الإيداع بنجاح'],
        system: ['تذكير بالاستحقاق', 'تحديث النظام', 'عرض خاص']
    };
    const messages = {
        profit: ['تم إيداع أرباح بقيمة {amount} دينار في حسابك', 'حصلت على أرباح جديدة بقيمة {amount} دينار', 'تم صرف أرباح هذا الشهر بقيمة {amount} دينار'],
        transaction: ['تم استلام طلب السحب رقم #{id}', 'تم تحديث حالة طلب السحب رقم #{id} إلى {status}', 'تم إيداع مبلغ {amount} دينار في حسابك'],
        system: ['أرباحك مستحقة خلال {days} أيام', 'تم تحديث النظام بميزات جديدة', 'استفد من عرضنا الخاص على الاستثمارات الجديدة']
    };
    
    // إنشاء 10 إشعارات عشوائية
    for (let i = 0; i < 5; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        
        // تحديد عنوان ورسالة الإشعار
        const titleIndex = Math.floor(Math.random() * titles[type].length);
        let title = titles[type][titleIndex];
        let message = messages[type][titleIndex];
        
        // استبدال المتغيرات
        if (type === 'profit' || (type === 'transaction' && message.includes('{amount}'))) {
            const amount = formatCurrency(Math.floor(100000 + Math.random() * 900000));
            message = message.replace('{amount}', amount);
        } else if (type === 'transaction' && message.includes('{id}')) {
            const id = Math.floor(10000 + Math.random() * 90000);
            message = message.replace('{id}', id);
            message = message.replace('{status}', Math.random() > 0.5 ? 'مكتملة' : 'قيد المعالجة');
        } else if (type === 'system' && message.includes('{days}')) {
            const days = Math.floor(1 + Math.random() * 7);
            message = message.replace('{days}', days);
        }
        
        // تحديد تاريخ الإشعار (خلال الأسبوع الماضي)
        const date = new Date();
        date.setDate(date.getDate() - Math.floor(Math.random() * 7));
        date.setHours(Math.floor(Math.random() * 24));
        date.setMinutes(Math.floor(Math.random() * 60));
        
        // تحديد حالة الإشعار
        const isRead = Math.random() > 0.3;
        
        // إنشاء إشعار جديد
        const notification = {
            id: 'NOTIF-' + Math.floor(100000 + Math.random() * 900000),
            date: date.toISOString(),
            type: type,
            title: title,
            message: message,
            isRead: isRead,
            iconClass: type === 'profit' ? 'green' : (type === 'transaction' ? 'blue' : 'orange'),
            iconName: type === 'profit' ? 'fa-coins' : (type === 'transaction' ? 'fa-money-bill-wave' : 'fa-bell')
        };
        
        mockNotifications.push(notification);
    }
    
    // ترتيب الإشعارات من الأحدث إلى الأقدم
    mockNotifications.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return mockNotifications;
}

/**
 * عرض شاشة تسجيل الدخول
 */
function showLoginScreen() {
    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.getElementById('app-container');
    
    if (loginScreen) loginScreen.classList.remove('hidden');
    if (appContainer) appContainer.classList.add('hidden');
}

/**
 * عرض واجهة التطبيق الرئيسية
 */
function showMainAppUI() {
    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.getElementById('app-container');
    
    if (loginScreen) loginScreen.classList.add('hidden');
    if (appContainer) appContainer.classList.remove('hidden');
    
    // تهيئة الرسوم البيانية
    initCharts();
    
    // تحديث الواجهة
    updateDashboard();
    updateUserProfile();
    updateNotificationsCount();
}

/**
 * التنقل إلى صفحة معينة
 * @param {string} pageId معرف الصفحة
 */
function navigateToPage(pageId) {
    // تحديث الصفحة النشطة
    currentPage = pageId;
    
    // إزالة الفئة النشطة من جميع عناصر الصفحة
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // إزالة الفئة النشطة من جميع روابط التنقل
    document.querySelectorAll('.sidebar-nav li').forEach(item => {
        item.classList.remove('active');
    });
    
    // إضافة الفئة النشطة للصفحة المحددة
    const pageElement = document.getElementById(`${pageId}-page`);
    if (pageElement) {
        pageElement.classList.add('active');
    }
    
    // إضافة الفئة النشطة لرابط التنقل المحدد
    const navLink = document.querySelector(`.sidebar-nav li a[data-page="${pageId}"]`);
    if (navLink) {
        navLink.parentElement.classList.add('active');
    }
    
    // إغلاق الشريط الجانبي في الشاشات الصغيرة
    if (window.innerWidth < 1024) {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && sidebar.classList.contains('active')) {
            toggleSidebar();
        }
    }
    
    // تحديث محتوى الصفحة حسب النوع
    switch (pageId) {
        case 'dashboard':
            updateDashboard();
            break;
        case 'transactions':
            loadTransactions();
            break;
        case 'profits':
            loadProfits();
            break;
        case 'withdraw':
            loadWithdrawInfo();
            break;
        case 'profile':
            loadProfileData();
            break;
        case 'settings':
            loadSettingsData();
            break;
    }
    
    // التمرير إلى أعلى الصفحة
    window.scrollTo(0, 0);
}

/**
 * تبديل حالة الشريط الجانبي
 */
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.classList.toggle('active');
    }
}

/**
 * تبديل لوحة الإشعارات
 */
function toggleNotificationsPanel() {
    const panel = document.getElementById('notifications-panel');
    if (panel) {
        panel.classList.toggle('active');
        
        // تحديث الإشعارات عند فتح اللوحة
        if (panel.classList.contains('active')) {
            updateNotificationsList();
        }
    }
}

/**
 * تصفية الإشعارات
 * @param {string} type نوع الإشعارات
 */
function filterNotifications(type) {
    const notificationsList = document.getElementById('notifications-list');
    if (!notificationsList || !notifications.length) return;
    
    const emptyState = document.getElementById('empty-notifications');
    
    // تصفية الإشعارات
    let filteredNotifications = [...notifications];
    
    if (type !== 'all') {
        filteredNotifications = notifications.filter(notification => notification.type === type);
    }
    
    // عرض حالة الفراغ إذا لم تكن هناك إشعارات
    if (filteredNotifications.length === 0) {
        notificationsList.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }
    
    // إخفاء حالة الفراغ
    if (emptyState) emptyState.classList.add('hidden');
    
    // عرض الإشعارات
    notificationsList.innerHTML = filteredNotifications.map(notification => `
        <div class="notification-item ${!notification.isRead ? 'unread' : ''}" data-id="${notification.id}">
            <div class="notification-icon ${notification.iconClass}">
                <i class="fas ${notification.iconName}"></i>
            </div>
            <div class="notification-content">
                <h4>${notification.title}</h4>
                <p>${notification.message}</p>
                <span class="notification-time">${formatNotificationTime(notification.date)}</span>
            </div>
            <button class="notification-action" data-id="${notification.id}">
                <i class="fas fa-ellipsis-v"></i>
            </button>
        </div>
    `).join('');
    
    // إضافة معالجات الأحداث للإشعارات
    notificationsList.querySelectorAll('.notification-item').forEach(item => {
        item.addEventListener('click', () => {
            // تعيين الإشعار كمقروء
            markNotificationAsRead(item.getAttribute('data-id'));
            
            // إزالة فئة "unread"
            item.classList.remove('unread');
        });
    });
}

/**
 * تنسيق وقت الإشعار
 * @param {string} dateString تاريخ الإشعار
 * @returns {string} الوقت المنسق
 */
function formatNotificationTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    
    // أقل من دقيقة
    if (diffMs < 60 * 1000) {
        return 'الآن';
    }
    
    // أقل من ساعة
    if (diffMs < 60 * 60 * 1000) {
        const minutes = Math.floor(diffMs / (60 * 1000));
        return `منذ ${minutes} دقيقة${minutes > 10 ? '' : (minutes > 2 ? 'ـة' : 'تين')}`;
    }
    
    // أقل من يوم
    if (diffMs < 24 * 60 * 60 * 1000) {
        const hours = Math.floor(diffMs / (60 * 60 * 1000));
        return `منذ ${hours} ساع${hours > 10 ? 'ة' : (hours > 2 ? 'ات' : 'تين')}`;
    }
    
    // أقل من أسبوع
    if (diffMs < 7 * 24 * 60 * 60 * 1000) {
        const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
        return `منذ ${days} ${days === 1 ? 'يوم' : 'أيام'}`;
    }
    
    // أقل من شهر
    if (diffMs < 30 * 24 * 60 * 60 * 1000) {
        const weeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
        return `منذ ${weeks} ${weeks === 1 ? 'أسبوع' : 'أسابيع'}`;
    }
    
    // أكثر من شهر
    return formatDate(date);
}

/**
 * تعيين إشعار كمقروء
 * @param {string} notificationId معرف الإشعار
 */
function markNotificationAsRead(notificationId) {
    // البحث عن الإشعار
    const notification = notifications.find(n => n.id === notificationId);
    if (!notification || notification.isRead) return;
    
    // تعيين الإشعار كمقروء
    notification.isRead = true;
    
    // تحديث عدد الإشعارات غير المقروءة
    updateNotificationsCount();
}

/**
 * تعيين جميع الإشعارات كمقروءة
 */
function markAllNotificationsAsRead() {
    // تعيين جميع الإشعارات كمقروءة
    notifications.forEach(notification => {
        notification.isRead = true;
    });
    
    // تحديث قائمة الإشعارات
    updateNotificationsList();
    
    // تحديث عدد الإشعارات غير المقروءة
    updateNotificationsCount();
    
    // عرض إشعار النجاح
    showToast('تم', 'تم تعيين جميع الإشعارات كمقروءة', 'success');
}

/**
 * تحديث قائمة الإشعارات
 */
function updateNotificationsList() {
    // عرض الإشعارات في اللوحة
    filterNotifications(document.querySelector('.notification-tab.active').getAttribute('data-tab'));
}

/**
 * تحديث عدد الإشعارات غير المقروءة
 */
function updateNotificationsCount() {
    const unreadCount = notifications.filter(notification => !notification.isRead).length;
    
    // تحديث عداد الإشعارات
    const badge = document.getElementById('notifications-count');
    if (badge) {
        badge.textContent = unreadCount;
        
        // إخفاء العداد إذا لم تكن هناك إشعارات غير مقروءة
        if (unreadCount === 0) {
            badge.style.display = 'none';
        } else {
            badge.style.display = 'flex';
        }
    }
}

/**
 * تصفية المعاملات
 * @param {string} filterType نوع التصفية
 */
function filterTransactions(filterType) {
    if (!transactions.length) return;
    
    let filteredTransactions = [...transactions];
    
    // تصفية حسب النوع
    if (filterType !== 'all') {
        filteredTransactions = transactions.filter(transaction => {
            if (filterType === 'deposit') return transaction.type === 'إيداع';
            if (filterType === 'withdraw') return transaction.type === 'سحب';
            if (filterType === 'profit') return transaction.type === 'دفع أرباح';
            return true;
        });
    }
    
    // تصفية حسب البحث
    const searchInput = document.getElementById('transaction-search');
    if (searchInput && searchInput.value.trim() !== '') {
        const searchTerm = searchInput.value.trim().toLowerCase();
        filteredTransactions = filteredTransactions.filter(transaction => {
            return (
                transaction.id.toLowerCase().includes(searchTerm) ||
                transaction.type.toLowerCase().includes(searchTerm) ||
                formatDate(transaction.date).includes(searchTerm) ||
                formatCurrency(transaction.amount).includes(searchTerm)
            );
        });
    }
    
    // عرض المعاملات المصفاة
    renderTransactionsTable(filteredTransactions);
}

/**
 * تحديث لوحة التحكم
 */
function updateDashboard() {
    if (!investorData) return;
    
    // تحديث بيانات البطاقة
    document.getElementById('total-balance').textContent = formatCurrency(investorData.amount || 0);
    document.getElementById('daily-profit').textContent = formatCurrency(calculateDailyProfit());
    document.getElementById('monthly-profit').textContent = formatCurrency(calculateMonthlyProfit());
    document.getElementById('investor-name').textContent = investorData.name;
    
    // تاريخ صلاحية البطاقة (افتراضي)
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 5);
    document.getElementById('card-validity').textContent = `صالحة لغاية: ${(expiry.getMonth() + 1).toString().padStart(2, '0')}/${expiry.getFullYear().toString().slice(2)}`;
    
    // تحديث ملخص البيانات
    document.getElementById('total-investment').textContent = `${formatCurrency(investorData.amount || 0)} دينار`;
    document.getElementById('interest-rate').textContent = `${investorData.interestRate || 17.5}%`;
    
    // حساب مدة الاستثمار
    const joinDate = new Date(investorData.joinDate || investorData.createdAt || new Date());
    const today = new Date();
    const durationDays = Math.floor((today - joinDate) / (1000 * 60 * 60 * 24));
    document.getElementById('investment-duration').textContent = `${durationDays} يوم`;
    
    // حساب تاريخ الاستحقاق القادم
    const nextPaymentDate = calculateNextProfitDate();
    document.getElementById('next-profit-date').textContent = formatDate(nextPaymentDate);
    
    // تحديث آخر المعاملات
    updateRecentTransactions();
}

/**
 * تحديث معلومات المستخدم في الواجهة
 */
function updateUserProfile() {
    if (!investorData) return;
    
    // تحديث اسم المستخدم وبريده
    const userNameElements = document.querySelectorAll('#user-name, #profile-name');
    const userEmailElements = document.querySelectorAll('#user-email');
    
    userNameElements.forEach(element => {
        element.textContent = investorData.name;
    });
    
    userEmailElements.forEach(element => {
        element.textContent = investorData.email || currentUser.email;
    });
    
    // تحديث معرف المستثمر
    const profileId = document.getElementById('profile-id');
    if (profileId) {
        profileId.textContent = `معرف المستثمر: #${investorData.id}`;
    }
    
    // تحديث الصور في حالة وجودها
    const avatarElements = document.querySelectorAll('#user-avatar, #sidebar-avatar, #profile-image');
    if (investorData.photoURL) {
        avatarElements.forEach(element => {
            element.src = investorData.photoURL;
        });
    }
}

/**
 * حساب الربح اليومي
 * @returns {number} الربح اليومي
 */
function calculateDailyProfit() {
    if (!investorData) return 0;
    
    const amount = investorData.amount || 0;
    const rate = investorData.interestRate || 17.5;
    
    // الربح اليومي (الربح السنوي / 365)
    return (amount * (rate / 100)) / 30;
}

/**
 * حساب الربح الشهري
 * @returns {number} الربح الشهري
 */
function calculateMonthlyProfit() {
    if (!investorData) return 0;
    
    const amount = investorData.amount || 0;
    const rate = investorData.interestRate || 17.5;
    
    // الربح الشهري
    return amount * (rate / 100) / 12;
}

/**
 * حساب تاريخ استحقاق الربح القادم
 * @returns {Date} تاريخ الاستحقاق
 */
function calculateNextProfitDate() {
    if (!investorData) return new Date();
    
    // تاريخ الانضمام
    const joinDate = new Date(investorData.joinDate || investorData.createdAt || new Date());
    const today = new Date();
    
    // الشهر القادم من تاريخ الانضمام
    const nextDate = new Date(joinDate);
    
    // حساب عدد الأشهر منذ الانضمام
    const monthsSinceJoin = (today.getFullYear() - joinDate.getFullYear()) * 12 + (today.getMonth() - joinDate.getMonth());
    
    // تاريخ الاستحقاق القادم
    nextDate.setMonth(joinDate.getMonth() + monthsSinceJoin + 1);
    
    return nextDate;
}

/**
 * تحديث آخر المعاملات
 */
function updateRecentTransactions() {
    const recentTransactionsList = document.getElementById('recent-transactions-list');
    if (!recentTransactionsList) return;
    
    // التحقق من وجود معاملات
    if (!transactions || transactions.length === 0) {
        recentTransactionsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exchange-alt"></i>
                <p>لا توجد معاملات حديثة</p>
            </div>
        `;
        return;
    }
    
    // الحصول على آخر 5 معاملات
    const recentTransactions = transactions.slice(0, 5);
    
    // عرض المعاملات
    recentTransactionsList.innerHTML = recentTransactions.map(transaction => {
        let iconClass = '';
        let amountClass = '';
        
        switch (transaction.type) {
            case 'إيداع':
                iconClass = 'deposit';
                amountClass = 'positive';
                break;
            case 'سحب':
                iconClass = 'withdraw';
                amountClass = 'negative';
                break;
            case 'دفع أرباح':
                iconClass = 'profit';
                amountClass = 'positive';
                break;
        }
        
        return `
            <div class="transaction-item">
                <div class="transaction-icon ${iconClass}">
                    <i class="fas ${iconClass === 'deposit' ? 'fa-arrow-up' : iconClass === 'withdraw' ? 'fa-arrow-down' : 'fa-coins'}"></i>
                </div>
                <div class="transaction-details">
                    <div class="transaction-title">${transaction.type}</div>
                    <div class="transaction-date">${formatDate(transaction.date)}</div>
                </div>
                <div class="transaction-amount ${amountClass}">
                    ${transaction.type === 'سحب' ? '-' : '+'} ${formatCurrency(transaction.amount)} دينار
                </div>
            </div>
        `;
    }).join('');
}

/**
 * تهيئة الرسوم البيانية
 */
function initCharts() {
    // إذا كانت الصفحة الحالية هي لوحة التحكم
    if (currentPage === 'dashboard') {
        // مخطط تطور الاستثمار
        initInvestmentChart();
        
        // مخطط الأرباح التراكمية
        initProfitsChart();
    }
    // إذا كانت الصفحة الحالية هي الأرباح
    else if (currentPage === 'profits') {
        // مخطط تاريخ الأرباح
        initProfitHistoryChart();
    }
}

/**
 * تهيئة مخطط الاستثمار
 */
function initInvestmentChart() {
    const ctx = document.getElementById('investment-chart');
    if (!ctx) return;
    
    // تدمير المخطط الموجود إذا كان موجودًا
    if (investmentChart) {
        investmentChart.destroy();
    }
    
    const chartData = generateInvestmentChartData('month');
    
    investmentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'إجمالي الاستثمار',
                data: chartData.values,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return formatCurrency(context.raw) + ' دينار';
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value) + ' د';
                        }
                    }
                }
            }
        }
    });
}

/**
 * تهيئة مخطط الأرباح
 */
function initProfitsChart() {
    const ctx = document.getElementById('profits-chart');
    if (!ctx) return;
    
    // تدمير المخطط الموجود إذا كان موجودًا
    if (profitsChart) {
        profitsChart.destroy();
    }
    
    const chartData = generateProfitsChartData('month');
    
    profitsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'الأرباح التراكمية',
                data: chartData.values,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return formatCurrency(context.raw) + ' دينار';
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value) + ' د';
                        }
                    }
                }
            }
        }
    });
}

/**
 * تهيئة مخطط تاريخ الأرباح
 */
function initProfitHistoryChart() {
    const ctx = document.getElementById('profit-history-chart');
    if (!ctx) return;
    
    // تدمير المخطط الموجود إذا كان موجودًا
    if (profitHistoryChart) {
        profitHistoryChart.destroy();
    }
    
    const chartData = generateProfitHistoryData('month');
    
    profitHistoryChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'الأرباح المدفوعة',
                data: chartData.values,
                backgroundColor: '#8b5cf6',
                barThickness: 15,
                maxBarThickness: 20,
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return formatCurrency(context.raw) + ' دينار';
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value) + ' د';
                        }
                    }
                }
            }
        }
    });
}

/**
 * توليد بيانات مخطط الاستثمار
 * @param {string} period الفترة (month, quarter, year)
 * @returns {Object} البيانات المولدة
 */
function generateInvestmentChartData(period) {
    // افتراضيًا: سيتم استبدال هذا بالبيانات الحقيقية من النظام
    const labels = [];
    const values = [];
    
    const now = new Date();
    let intervals = 12; // الافتراضي: شهر (12 نقطة)
    
    if (period === 'quarter') {
        intervals = 6; // ربع سنة (6 نقاط)
    } else if (period === 'year') {
        intervals = 12; // سنة (12 نقطة، كل شهر)
    } else {
        intervals = 30; // شهر (30 نقطة، كل يوم)
    }
    
    // إنشاء البيانات
    for (let i = 0; i < intervals; i++) {
        const date = new Date();
        
        if (period === 'month') {
            // يوميًا للشهر
            date.setDate(date.getDate() - (intervals - i - 1));
            labels.push(date.getDate() + '/' + (date.getMonth() + 1));
        } else {
            // شهريًا
            date.setMonth(date.getMonth() - (intervals - i - 1));
            labels.push(getMonthName(date.getMonth()));
        }
        
        // قيمة عشوائية، سيتم استبدالها بالبيانات الحقيقية
        const baseValue = investorData ? investorData.amount : 100000000;
        const growth = 1 + (Math.random() * 0.05); // نمو عشوائي حتى 5%
        values.push(baseValue * growth);
    }
    
    return { labels, values };
}

/**
 * توليد بيانات مخطط الأرباح
 * @param {string} period الفترة (month, quarter, year)
 * @returns {Object} البيانات المولدة
 */
function generateProfitsChartData(period) {
    // افتراضيًا: سيتم استبدال هذا بالبيانات الحقيقية من النظام
    const labels = [];
    const values = [];
    
    const now = new Date();
    let intervals = 12; // الافتراضي: شهر (12 نقطة)
    
    if (period === 'quarter') {
        intervals = 6; // ربع سنة (6 نقاط)
    } else if (period === 'year') {
        intervals = 12; // سنة (12 نقطة، كل شهر)
    } else {
        intervals = 30; // شهر (30 نقطة، كل يوم)
    }
    
    // إنشاء البيانات
    for (let i = 0; i < intervals; i++) {
        const date = new Date();
        
        if (period === 'month') {
            // يوميًا للشهر
            date.setDate(date.getDate() - (intervals - i - 1));
            labels.push(date.getDate() + '/' + (date.getMonth() + 1));
        } else {
            // شهريًا
            date.setMonth(date.getMonth() - (intervals - i - 1));
            labels.push(getMonthName(date.getMonth()));
        }
        
        // قيمة عشوائية، سيتم استبدالها بالبيانات الحقيقية
        const baseValue = investorData ? (investorData.amount * 0.175 / 12) : 1000000;
        const cumulativeGrowth = i / intervals * 2; // نمو تراكمي
        values.push(baseValue * (1 + cumulativeGrowth));
    }
    
    return { labels, values };
}

/**
 * توليد بيانات مخطط تاريخ الأرباح
 * @param {string} period الفترة (month, quarter, year)
 * @returns {Object} البيانات المولدة
 */
function generateProfitHistoryData(period) {
    // تصفية المعاملات للحصول على دفعات الأرباح فقط
    const profitPayments = transactions.filter(transaction => transaction.type === 'دفع أرباح' && transaction.status === 'completed');
    
    const labels = [];
    const values = [];
    
    const now = new Date();
    let intervals = 12; // الافتراضي: 12 شهر
    
    if (period === 'quarter') {
        intervals = 6; // ربع سنة (6 أشهر)
    } else if (period === 'year') {
        intervals = 12; // سنة (12 شهر)
    } else {
        intervals = 12; // شهر (12 أسبوع)
    }
    
    // إنشاء البيانات
    for (let i = 0; i < intervals; i++) {
        const date = new Date();
        
        if (period === 'month') {
            // كل أسبوع للشهر
            date.setDate(date.getDate() - (intervals - i) * 7);
            labels.push('الأسبوع ' + (i + 1));
        } else {
            // شهريًا
            date.setMonth(date.getMonth() - (intervals - i - 1));
            labels.push(getMonthName(date.getMonth()));
        }
        
        // البحث عن دفعات الأرباح في الفترة المحددة
        let periodValue = 0;
        
        if (profitPayments.length > 0) {
            // استخدام البيانات الفعلية إذا كانت متوفرة
            profitPayments.forEach(payment => {
                const paymentDate = new Date(payment.date);
                
                if (period === 'month') {
                    // التحقق مما إذا كانت الدفعة في الأسبوع المحدد
                    const weekStart = new Date(date);
                    const weekEnd = new Date(date);
                    weekEnd.setDate(weekEnd.getDate() + 7);
                    
                    if (paymentDate >= weekStart && paymentDate < weekEnd) {
                        periodValue += payment.amount;
                    }
                } else {
                    // التحقق مما إذا كانت الدفعة في الشهر المحدد
                    if (paymentDate.getMonth() === date.getMonth() && paymentDate.getFullYear() === date.getFullYear()) {
                        periodValue += payment.amount;
                    }
                }
            });
        } else {
            // إنشاء بيانات عشوائية إذا لم تكن هناك بيانات فعلية
            periodValue = Math.random() * (calculateMonthlyProfit() * 0.8) + calculateMonthlyProfit() * 0.2;
        }
        
        values.push(periodValue);
    }
    
    return { labels, values };
}

/**
 * تحديث مخطط الاستثمار
 * @param {string} period الفترة (month, quarter, year)
 */
function updateInvestmentChart(period) {
    if (!investmentChart) {
        initInvestmentChart();
        return;
    }
    
    const chartData = generateInvestmentChartData(period);
    
    investmentChart.data.labels = chartData.labels;
    investmentChart.data.datasets[0].data = chartData.values;
    investmentChart.update();
}

/**
 * تحديث مخطط الأرباح
 * @param {string} period الفترة (month, quarter, year)
 */
function updateProfitsChart(period) {
    if (!profitsChart) {
        initProfitsChart();
        return;
    }
    
    const chartData = generateProfitsChartData(period);
    
    profitsChart.data.labels = chartData.labels;
    profitsChart.data.datasets[0].data = chartData.values;
    profitsChart.update();
}

/**
 * تحديث مخطط تاريخ الأرباح
 * @param {string} period الفترة (month, quarter, year)
 */
function updateProfitHistoryChart(period) {
    if (!profitHistoryChart) {
        initProfitHistoryChart();
        return;
    }
    
    const chartData = generateProfitHistoryData(period);
    
    profitHistoryChart.data.labels = chartData.labels;
    profitHistoryChart.data.datasets[0].data = chartData.values;
    profitHistoryChart.update();
}

/**
 * تحميل بيانات المعاملات
 */
function loadTransactions() {
    // عرض المعاملات
    renderTransactionsTable(transactions);
}

/**
 * عرض المعاملات في الجدول
 * @param {Array} transactionsData بيانات المعاملات
 */
function renderTransactionsTable(transactionsData) {
    const tableBody = document.getElementById('transactions-table-body');
    const emptyTransactions = document.getElementById('empty-transactions');
    
    if (!tableBody) return;
    
    // التحقق من وجود معاملات
    if (!transactionsData || transactionsData.length === 0) {
        // عرض حالة الفراغ
        tableBody.innerHTML = '';
        if (emptyTransactions) emptyTransactions.classList.remove('hidden');
        return;
    }
    
    // إخفاء حالة الفراغ
    if (emptyTransactions) emptyTransactions.classList.add('hidden');
    
    // تفريغ الجدول
    tableBody.innerHTML = '';
    
    // عرض المعاملات
    transactionsData.forEach(transaction => {
        const row = document.createElement('tr');
        
        // تحديد حالة المعاملة
        let statusClass = 'completed';
        let statusText = 'مكتملة';
        
        if (transaction.status) {
            statusClass = transaction.status === 'pending' ? 'pending' : transaction.status === 'canceled' ? 'canceled' : 'completed';
            statusText = transaction.status === 'pending' ? 'قيد المعالجة' : transaction.status === 'canceled' ? 'ملغية' : 'مكتملة';
        }
        
        row.innerHTML = `
            <td>${transaction.id}</td>
            <td>${formatDate(transaction.date)}</td>
            <td>${transaction.type}</td>
            <td>${formatCurrency(transaction.amount)} دينار</td>
            <td>${transaction.balanceAfter ? formatCurrency(transaction.balanceAfter) + ' دينار' : '-'}</td>
            <td><span class="status ${statusClass}">${statusText}</span></td>
            <td>
                <button class="detail-btn" data-id="${transaction.id}" aria-label="عرض التفاصيل">
                    <i class="fas fa-info-circle"></i>
                </button>
            </td>
        `;
        
        tableBody.appendChild(row);
        
        // إضافة معالج الأحداث لزر التفاصيل
        row.querySelector('.detail-btn').addEventListener('click', () => {
            showTransactionDetails(transaction.id);
        });
    });
    
    // تحديث أرقام الصفحات
    updatePagination(transactionsData.length);
}

/**
 * عرض تفاصيل المعاملة
 * @param {string} transactionId معرف المعاملة
 */
function showTransactionDetails(transactionId) {
    // البحث عن المعاملة
    const transaction = transactions.find(t => t.id === transactionId);
    if (!transaction) return;
    
    // إنشاء محتوى التفاصيل
    let transactionDetails = `
        <div class="transaction-details-card">
            <div class="transaction-header">
                <div class="transaction-type ${transaction.type === 'إيداع' ? 'deposit' : transaction.type === 'سحب' ? 'withdraw' : 'profit'}">
                    <i class="fas ${transaction.type === 'إيداع' ? 'fa-arrow-up' : transaction.type === 'سحب' ? 'fa-arrow-down' : 'fa-coins'}"></i>
                </div>
                <div class="transaction-title">
                    <h4>${transaction.type}</h4>
                    <p>${formatDate(transaction.date, true)}</p>
                </div>
            </div>
            <div class="transaction-amount-large">
                <span>${formatCurrency(transaction.amount)}</span>
                <span class="currency">دينار</span>
            </div>
            <div class="transaction-details-list">
                <div class="detail-item">
                    <span class="detail-label">رقم المعاملة:</span>
                    <span class="detail-value">${transaction.id}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">تاريخ المعاملة:</span>
                    <span class="detail-value">${formatDate(transaction.date, true)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">نوع المعاملة:</span>
                    <span class="detail-value">${transaction.type}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">المبلغ:</span>
                    <span class="detail-value">${formatCurrency(transaction.amount)} دينار</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">الرصيد بعد المعاملة:</span>
                    <span class="detail-value">${transaction.balanceAfter ? formatCurrency(transaction.balanceAfter) + ' دينار' : '-'}</span>
                </div>
                ${transaction.method ? `
                <div class="detail-item">
                    <span class="detail-label">طريقة ${transaction.type === 'سحب' ? 'السحب' : 'الإيداع'}:</span>
                    <span class="detail-value">${transaction.method === 'bank' ? 'تحويل بنكي' : transaction.method === 'wallet' ? 'محفظة إلكترونية' : transaction.method}</span>
                </div>
                ` : ''}
                ${transaction.notes ? `
                <div class="detail-item">
                    <span class="detail-label">ملاحظات:</span>
                    <span class="detail-value">${transaction.notes}</span>
                </div>
                ` : ''}
                <div class="detail-item">
                    <span class="detail-label">الحالة:</span>
                    <span class="status ${transaction.status === 'pending' ? 'pending' : transaction.status === 'canceled' ? 'canceled' : 'completed'}">
                        ${transaction.status === 'pending' ? 'قيد المعالجة' : transaction.status === 'canceled' ? 'ملغية' : 'مكتملة'}
                    </span>
                </div>
            </div>
        </div>
    `;
    
    // عرض النافذة المنبثقة
    showModal('تفاصيل المعاملة', transactionDetails);
}

/**
 * تحديث الترقيم
 * @param {number} totalItems عدد العناصر الكلي
 */
function updatePagination(totalItems) {
    const paginationNumbers = document.getElementById('pagination-numbers');
    if (!paginationNumbers) return;
    
    // تغيير أرقام الصفحات حسب عدد العناصر
    const pageSize = currentPageSize; // عدد العناصر في الصفحة
    const totalPages = Math.ceil(totalItems / pageSize);
    
    let paginationHTML = '';
    
    // عرض 5 صفحات كحد أقصى
    const maxVisiblePages = 5;
    const halfVisiblePages = Math.floor(maxVisiblePages / 2);
    
    let startPage = Math.max(1, currentPageNumber - halfVisiblePages);
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `<span class="page-number ${i === currentPageNumber ? 'active' : ''}">${i}</span>`;
    }
    
    paginationNumbers.innerHTML = paginationHTML;
    
    // إضافة معالجات الأحداث لأرقام الصفحات
    paginationNumbers.querySelectorAll('.page-number').forEach(pageNumber => {
        pageNumber.addEventListener('click', () => {
            // تحديث رقم الصفحة الحالية
            currentPageNumber = parseInt(pageNumber.textContent);
            
            // تحديث المعاملات المعروضة
            filterTransactions(document.querySelector('.filter-btn.active').getAttribute('data-filter'));
            
            // تحديث الترقيم
            updatePagination(totalItems);
        });
    });
    
    // تحديث أزرار التنقل
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    
    if (prevPageBtn) {
        prevPageBtn.disabled = currentPageNumber <= 1;
        prevPageBtn.addEventListener('click', () => {
            if (currentPageNumber > 1) {
                currentPageNumber--;
                filterTransactions(document.querySelector('.filter-btn.active').getAttribute('data-filter'));
                updatePagination(totalItems);
            }
        });
    }
    
    if (nextPageBtn) {
        nextPageBtn.disabled = currentPageNumber >= totalPages;
        nextPageBtn.addEventListener('click', () => {
            if (currentPageNumber < totalPages) {
                currentPageNumber++;
                filterTransactions(document.querySelector('.filter-btn.active').getAttribute('data-filter'));
                updatePagination(totalItems);
            }
        });
    }
}

/**
 * تحميل بيانات الأرباح
 */
function loadProfits() {
    if (!investorData) return;
    
    // تحديث بطاقات ملخص الأرباح
    document.getElementById('daily-profit-details').textContent = formatCurrency(calculateDailyProfit()) + ' دينار';
    document.getElementById('weekly-profit-details').textContent = formatCurrency(calculateDailyProfit() * 7) + ' دينار';
    document.getElementById('monthly-profit-details').textContent = formatCurrency(calculateMonthlyProfit()) + ' دينار';
    document.getElementById('yearly-profit-projection').textContent = formatCurrency(calculateMonthlyProfit() * 12) + ' دينار';
    
    // تهيئة مخطط تاريخ الأرباح
    initProfitHistoryChart();
    
    // عرض سجل دفعات الأرباح
    loadProfitPayments();
}

/**
 * تحميل سجل دفعات الأرباح
 */
function loadProfitPayments() {
    // تصفية المعاملات للحصول على دفعات الأرباح فقط
    const profitPayments = transactions.filter(transaction => transaction.type === 'دفع أرباح');
    
    const tbody = document.getElementById('profit-payments-body');
    const emptyProfits = document.getElementById('empty-profits');
    
    if (!tbody) return;
    
    // التحقق من وجود دفعات أرباح
    if (!profitPayments || profitPayments.length === 0) {
        // عرض حالة الفراغ
        tbody.innerHTML = '';
        if (emptyProfits) emptyProfits.classList.remove('hidden');
        return;
    }
    
    // إخفاء حالة الفراغ
    if (emptyProfits) emptyProfits.classList.add('hidden');
    
    // تفريغ الجدول
    tbody.innerHTML = '';
    
    // عرض دفعات الأرباح
    profitPayments.forEach(payment => {
        const row = document.createElement('tr');
        
        // حساب الفترة (شهر، ربع سنة، إلخ)
        const period = 'شهر ' + getMonthName(new Date(payment.date).getMonth());
        
        row.innerHTML = `
            <td>${formatDate(payment.date)}</td>
            <td>${period}</td>
            <td>${formatCurrency(payment.amount)} دينار</td>
            <td><span class="status ${payment.status === 'pending' ? 'pending' : payment.status === 'canceled' ? 'canceled' : 'completed'}">
                ${payment.status === 'pending' ? 'قيد المعالجة' : payment.status === 'canceled' ? 'ملغية' : 'مدفوعة'}
            </span></td>
        `;
        
        tbody.appendChild(row);
    });
}

/**
 * تصدير بيانات الأرباح
 */
function exportProfitData() {
    // تصفية المعاملات للحصول على دفعات الأرباح فقط
    const profitPayments = transactions.filter(transaction => transaction.type === 'دفع أرباح');
    
    if (!profitPayments || profitPayments.length === 0) {
        showToast('تنبيه', 'لا توجد دفعات أرباح لتصديرها', 'warning');
        return;
    }
    
    // إنشاء بيانات CSV
    let csvContent = 'رقم المعاملة,التاريخ,المبلغ,الفترة,الحالة\n';
    
    profitPayments.forEach(payment => {
        const period = 'شهر ' + getMonthName(new Date(payment.date).getMonth());
        const status = payment.status === 'pending' ? 'قيد المعالجة' : payment.status === 'canceled' ? 'ملغية' : 'مدفوعة';
        
        csvContent += `${payment.id},${formatDate(payment.date)},${payment.amount},${period},${status}\n`;
    });
    
    // إنشاء رابط التنزيل
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // تعيين اسم الملف
    const fileName = `أرباح_${formatDate(new Date())}.csv`;
    
    // تعيين خصائص الرابط
    link.href = url;
    link.setAttribute('download', fileName);
    link.style.display = 'none';
    
    // إضافة الرابط إلى المستند
    document.body.appendChild(link);
    
    // نقر الرابط لبدء التنزيل
    link.click();
    
    // تنظيف الموارد
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
    
    // عرض إشعار النجاح
    showToast('تم التصدير', 'تم تصدير بيانات الأرباح بنجاح', 'success');
}

/**
 * تحميل معلومات السحب
 */
function loadWithdrawInfo() {
    if (!investorData) return;
    
    // تحديث الرصيد المتاح للسحب
    document.getElementById('available-balance').textContent = formatCurrency(investorData.amount || 0);
    
    // تحميل تاريخ طلبات السحب
    loadWithdrawHistory();
}

/**
 * تحميل تاريخ طلبات السحب
 */
function loadWithdrawHistory() {
    // تصفية المعاملات للحصول على عمليات السحب فقط
    const withdrawals = transactions.filter(transaction => transaction.type === 'سحب');
    
    const tbody = document.getElementById('withdrawals-history-body');
    const emptyWithdrawals = document.getElementById('empty-withdrawals');
    
    if (!tbody) return;
    
    // التحقق من وجود طلبات سحب
    if (!withdrawals || withdrawals.length === 0) {
        // عرض حالة الفراغ
        tbody.innerHTML = '';
        if (emptyWithdrawals) emptyWithdrawals.classList.remove('hidden');
        return;
    }
    
    // إخفاء حالة الفراغ
    if (emptyWithdrawals) emptyWithdrawals.classList.add('hidden');
    
    // تفريغ الجدول
    tbody.innerHTML = '';
    
    // عرض طلبات السحب
    withdrawals.forEach(withdrawal => {
        const row = document.createElement('tr');
        
        // تحديد حالة طلب السحب
        let statusClass = 'completed';
        let statusText = 'مكتمل';
        
        if (withdrawal.status) {
            statusClass = withdrawal.status === 'pending' ? 'pending' : withdrawal.status === 'canceled' ? 'canceled' : 'completed';
            statusText = withdrawal.status === 'pending' ? 'قيد المعالجة' : withdrawal.status === 'canceled' ? 'ملغي' : 'مكتمل';
        }
        
        // تحديد طريقة السحب
        let method = withdrawal.method || 'تحويل بنكي'; // افتراضي
        if (method === 'bank') method = 'تحويل بنكي';
        if (method === 'wallet') method = 'محفظة إلكترونية';
        if (method === 'cash') method = 'استلام نقدي';
        
        row.innerHTML = `
            <td>${formatDate(withdrawal.date)}</td>
            <td>${formatCurrency(withdrawal.amount)} دينار</td>
            <td>${method}</td>
            <td><span class="status ${statusClass}">${statusText}</span></td>
            <td>
                <button class="detail-btn" data-id="${withdrawal.id}" aria-label="عرض التفاصيل">
                    <i class="fas fa-info-circle"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
        
        // إضافة معالج الأحداث لزر التفاصيل
        row.querySelector('.detail-btn').addEventListener('click', () => {
            showTransactionDetails(withdrawal.id);
        });
    });
}

/**
 * تقديم طلب سحب
 */
function submitWithdrawalRequest() {
    const withdrawAmount = parseFloat(document.getElementById('withdraw-amount').value);
    const withdrawalMethod = document.getElementById('withdrawal-method').value;
    const withdrawNote = document.getElementById('withdraw-note').value;
    const confirmWithdrawal = document.getElementById('confirm-withdrawal').checked;
    
    // التحقق من البيانات
    if (!withdrawAmount || isNaN(withdrawAmount) || withdrawAmount <= 0) {
        showToast('خطأ', 'يرجى إدخال مبلغ صحيح للسحب', 'error');
        return;
    }
    
    if (!withdrawalMethod) {
        showToast('خطأ', 'يرجى اختيار طريقة السحب', 'error');
        return;
    }
    
    if (!confirmWithdrawal) {
        showToast('خطأ', 'يرجى الموافقة على شروط السحب', 'error');
        return;
    }
    
    // التحقق من كفاية الرصيد
    if (withdrawAmount > (investorData.amount || 0)) {
        showToast('خطأ', 'المبلغ المطلوب سحبه أكبر من الرصيد المتاح', 'error');
        return;
    }
    
    // بيانات طلب السحب
    let withdrawalData = {
        amount: withdrawAmount,
        method: withdrawalMethod,
        notes: withdrawNote,
        status: 'pending'
    };
    
    // إضافة بيانات إضافية حسب طريقة السحب
    if (withdrawalMethod === 'bank') {
        withdrawalData.bankAccount = document.getElementById('bank-account').value;
        withdrawalData.bankName = document.getElementById('bank-name').value;
        
        if (!withdrawalData.bankAccount || !withdrawalData.bankName) {
            showToast('خطأ', 'يرجى إدخال بيانات الحساب البنكي', 'error');
            return;
        }
    } else if (withdrawalMethod === 'wallet') {
        withdrawalData.walletNumber = document.getElementById('wallet-number').value;
        
        if (!withdrawalData.walletNumber) {
            showToast('خطأ', 'يرجى إدخال رقم المحفظة', 'error');
            return;
        }
    }
    
    // عرض حالة التحميل
    showLoaderOverlay('جاري تقديم طلب السحب...');
    
    // إرسال طلب السحب إلى النظام الرئيسي
    sendWithdrawalRequest(withdrawalData)
        .then(result => {
            hideLoaderOverlay();
            
            // عرض إشعار النجاح
            showToast('تم تقديم الطلب', 'تم تقديم طلب السحب بنجاح وسيتم معالجته قريبًا', 'success');
            
            // عرض نافذة تأكيد طلب السحب
            showWithdrawalSuccessModal(withdrawalData, result);
            
            // إعادة تعيين نموذج السحب
            document.getElementById('withdraw-form').reset();
            
            // تحديث تاريخ طلبات السحب
            loadWithdrawHistory();
        })
        .catch(error => {
            hideLoaderOverlay();
            console.error('خطأ في تقديم طلب السحب:', error);
            showToast('خطأ', 'حدث خطأ أثناء تقديم طلب السحب', 'error');
        });
}

/**
 * إرسال طلب السحب إلى النظام الرئيسي
 * @param {Object} withdrawalData بيانات طلب السحب
 * @returns {Promise<Object>} معلومات طلب السحب
 */
function sendWithdrawalRequest(withdrawalData) {
    return new Promise((resolve, reject) => {
        // محاكاة الاتصال بالخادم
        setTimeout(() => {
            try {
                // إنشاء طلب سحب جديد
                const withdrawalId = 'WD-' + Date.now();
                const withdrawalDate = new Date().toISOString();
                
                const newWithdrawal = {
                    id: withdrawalId,
                    date: withdrawalDate,
                    type: 'سحب',
                    investorId: investorData.id,
                    investorName: investorData.name,
                    amount: withdrawalData.amount,
                    status: 'pending',
                    method: withdrawalData.method,
                    notes: withdrawalData.notes,
                    requestDetails: withdrawalData
                };
                
                // إضافة الطلب إلى قائمة المعاملات
                transactions.unshift(newWithdrawal);
                
                resolve({
                    id: withdrawalId,
                    date: withdrawalDate,
                    amount: withdrawalData.amount
                });
            } catch (error) {
                reject(error);
            }
        }, 1500);
    });
}

/**
 * عرض نافذة تأكيد طلب السحب
 * @param {Object} withdrawalData بيانات طلب السحب
 * @param {Object} result نتيجة طلب السحب
 */
function showWithdrawalSuccessModal(withdrawalData, result) {
    // تحديث بيانات الطلب في النافذة
    document.getElementById('withdraw-request-id').textContent = `#${result.id}`;
    document.getElementById('withdraw-request-amount').textContent = `${formatCurrency(withdrawalData.amount)} دينار`;
    document.getElementById('withdraw-request-date').textContent = formatDate(result.date);
    
    // عرض النافذة
    document.getElementById('withdraw-success-modal').classList.add('active');
    
    // إضافة معالج الأحداث لزر إغلاق النافذة
    document.querySelectorAll('#withdraw-success-modal .modal-close, #withdraw-success-modal .modal-close-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.getElementById('withdraw-success-modal').classList.remove('active');
        });
    });
    
    // إضافة معالج الأحداث لزر متابعة حالة الطلب
    document.getElementById('view-withdrawal-status').addEventListener('click', () => {
        document.getElementById('withdraw-success-modal').classList.remove('active');
        navigateToPage('transactions');
        
        // تحديد تصفية المعاملات للسحوبات
        const withdrawFilter = document.querySelector('.filter-btn[data-filter="withdraw"]');
        if (withdrawFilter) {
            withdrawFilter.click();
        }
    });
}

/**
 * تحميل بيانات الملف الشخصي
 */
function loadProfileData() {
    if (!investorData || !currentUser) return;
    
    // تحديث بيانات الملف الشخصي
    document.getElementById('profile-name').textContent = investorData.name;
    document.getElementById('profile-id').textContent = 'معرف المستثمر: #' + investorData.id;
    
    // تحديث نموذج المعلومات الشخصية
    document.getElementById('full-name').value = investorData.name;
    document.getElementById('phone-number').value = investorData.phone || '';
    document.getElementById('email-address').value = currentUser.email;
    document.getElementById('address').value = investorData.address || '';
    document.getElementById('id-card').value = investorData.cardNumber || '';
}

/**
 * حفظ المعلومات الشخصية
 */
function savePersonalInfo() {
    if (!investorData || !currentUser) return;
    
    // جمع البيانات من النموذج
    const fullName = document.getElementById('full-name').value;
    const phoneNumber = document.getElementById('phone-number').value;
    const address = document.getElementById('address').value;
    
    // التحقق من البيانات
    if (!fullName || !phoneNumber) {
        showToast('خطأ', 'يرجى إدخال الاسم ورقم الهاتف', 'error');
        return;
    }
    
    // عرض حالة التحميل
    showLoaderOverlay('جاري حفظ البيانات...');
    
    // تحديث البيانات في النظام الرئيسي
    updateInvestorInfo({ name: fullName, phone: phoneNumber, address })
        .then(result => {
            hideLoaderOverlay();
            
            // تحديث واجهة المستخدم
            updateUserProfile();
            
            // عرض إشعار النجاح
            showToast('تم الحفظ', 'تم حفظ المعلومات الشخصية بنجاح', 'success');
        })
        .catch(error => {
            hideLoaderOverlay();
            console.error('خطأ في حفظ المعلومات الشخصية:', error);
            showToast('خطأ', 'حدث خطأ أثناء حفظ المعلومات الشخصية', 'error');
        });
}

/**
 * تحديث معلومات المستثمر
 * @param {Object} updateData البيانات المحدثة
 * @returns {Promise<Object>} معلومات المستثمر المحدثة
 */
function updateInvestorInfo(updateData) {
    return new Promise((resolve, reject) => {
        if (!investorData || !currentUser) {
            reject(new Error('بيانات المستثمر أو المستخدم غير متوفرة'));
            return;
        }
        
        // محاكاة الاتصال بالخادم
        setTimeout(() => {
            try {
                // تحديث البيانات المحلية
                Object.assign(investorData, updateData);
                
                resolve(investorData);
            } catch (error) {
                reject(error);
            }
        }, 1000);
    });
}

/**
 * حفظ إعدادات الأمان
 */
function saveSecuritySettings() {
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-new-password').value;
    const twoFactorEnabled = document.getElementById('two-factor').checked;
    
    // التحقق من البيانات
    if (!currentPassword) {
        showToast('خطأ', 'يرجى إدخال كلمة المرور الحالية', 'error');
        return;
    }
    
    if (newPassword && newPassword !== confirmPassword) {
        showToast('خطأ', 'كلمة المرور الجديدة وتأكيدها غير متطابقين', 'error');
        return;
    }
    
    // إذا كان المستخدم يريد تغيير كلمة المرور
    if (newPassword) {
        // التحقق من قوة كلمة المرور
        if (newPassword.length < 8) {
            showToast('خطأ', 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل', 'error');
            return;
        }
        
        // عرض حالة التحميل
        showLoaderOverlay('جاري تحديث كلمة المرور...');
        
        // محاكاة تحديث كلمة المرور
        setTimeout(() => {
            hideLoaderOverlay();
            
            // إعادة تعيين النموذج
            document.getElementById('security-form').reset();
            
            // عرض إشعار النجاح
            showToast('تم التحديث', 'تم تحديث كلمة المرور بنجاح', 'success');
        }, 1500);
    } else if (currentPassword) {
        // تحديث إعدادات المصادقة الثنائية فقط
        showLoaderOverlay('جاري تحديث إعدادات الأمان...');
        
        // محاكاة تحديث إعدادات الأمان
        setTimeout(() => {
            hideLoaderOverlay();
            
            // عرض إشعار النجاح
            showToast('تم التحديث', 'تم تحديث إعدادات الأمان بنجاح', 'success');
            
            // إعادة تعيين النموذج
            document.getElementById('security-form').reset();
            
            // إعادة تعيين حالة المصادقة الثنائية
            document.getElementById('two-factor').checked = twoFactorEnabled;
        }, 1000);
    }
}

/**
 * حفظ إعدادات الإشعارات
 */
function saveNotificationSettings() {
    // جمع الإعدادات من النموذج
    const inAppNotifications = document.getElementById('in-app-notifications').checked;
    const emailNotifications = document.getElementById('email-notifications').checked;
    const smsNotifications = document.getElementById('sms-notifications').checked;
    const profitNotifications = document.getElementById('profit-notifications').checked;
    const withdrawNotifications = document.getElementById('withdraw-notifications').checked;
    const reminderNotifications = document.getElementById('reminder-notifications').checked;
    const newsNotifications = document.getElementById('news-notifications').checked;
    
    // عرض حالة التحميل
    showLoaderOverlay('جاري حفظ إعدادات الإشعارات...');
    
    // محاكاة حفظ الإعدادات
    setTimeout(() => {
        hideLoaderOverlay();
        
        // عرض إشعار النجاح
        showToast('تم الحفظ', 'تم حفظ إعدادات الإشعارات بنجاح', 'success');
    }, 1000);
}

/**
 * تحميل إعدادات التطبيق
 */
function loadSettingsData() {
    // جلب إعدادات التطبيق من التخزين المحلي
    const storedSettings = localStorage.getItem('walletAppSettings');
    
    if (storedSettings) {
        try {
            appSettings = JSON.parse(storedSettings);
            
            // تطبيق الإعدادات على النموذج
            if (document.getElementById('language-setting')) {
                document.getElementById('language-setting').value = appSettings.language || 'ar';
            }
            
            if (document.getElementById('currency-setting')) {
                document.getElementById('currency-setting').value = appSettings.currency || 'دينار';
            }
            
            if (document.getElementById('dark-mode')) {
                document.getElementById('dark-mode').checked = appSettings.darkMode || false;
            }
            
            if (document.getElementById('auto-lock')) {
                document.getElementById('auto-lock').value = appSettings.autoLock || '1';
            }
            
            if (appSettings.notifications) {
                if (document.getElementById('profit-alerts')) {
                    document.getElementById('profit-alerts').checked = appSettings.notifications.profits !== false;
                }
                
                if (document.getElementById('transaction-alerts')) {
                    document.getElementById('transaction-alerts').checked = appSettings.notifications.transactions !== false;
                }
            }
            
            // تطبيق الوضع المظلم
            if (appSettings.darkMode) {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
        } catch (error) {
            console.error('خطأ في تحليل إعدادات التطبيق:', error);
        }
    } else {
        // إعدادات افتراضية إذا لم تكن هناك إعدادات مخزنة
        appSettings = {
            language: 'ar',
            currency: 'دينار',
            darkMode: false,
            autoLock: '1',
            notifications: {
                profits: true,
                transactions: true
            }
        };
        
        // تخزين الإعدادات الافتراضية
        localStorage.setItem('walletAppSettings', JSON.stringify(appSettings));
    }
}

/**
 * حفظ إعدادات التطبيق
 */
function saveAppSettings() {
    // جمع الإعدادات من النموذج
    const language = document.getElementById('language-setting').value;
    const currency = document.getElementById('currency-setting').value;
    const darkMode = document.getElementById('dark-mode').checked;
    const autoLock = document.getElementById('auto-lock').value;
    const profitAlerts = document.getElementById('profit-alerts').checked;
    const transactionAlerts = document.getElementById('transaction-alerts').checked;
    
    // تحديث الإعدادات
    appSettings = {
        language,
        currency,
        darkMode,
        autoLock,
        notifications: {
            profits: profitAlerts,
            transactions: transactionAlerts
        }
    };
    
    // تطبيق الإعدادات
    if (darkMode) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    
    // تخزين الإعدادات في التخزين المحلي
    localStorage.setItem('walletAppSettings', JSON.stringify(appSettings));
    
    // عرض إشعار النجاح
    showToast('تم الحفظ', 'تم حفظ الإعدادات بنجاح', 'success');
}

/**
 * إعادة تعيين إعدادات التطبيق
 */
function resetAppSettings() {
    // إعدادات افتراضية
    appSettings = {
        language: 'ar',
        currency: 'دينار',
        darkMode: false,
        autoLock: '1',
        notifications: {
            profits: true,
            transactions: true
        }
    };
    
    // تطبيق الإعدادات على النموذج
    document.getElementById('language-setting').value = 'ar';
    document.getElementById('currency-setting').value = 'دينار';
    document.getElementById('dark-mode').checked = false;
    document.getElementById('auto-lock').value = '1';
    document.getElementById('profit-alerts').checked = true;
    document.getElementById('transaction-alerts').checked = true;
    
    // إزالة الوضع المظلم
    document.body.classList.remove('dark-mode');
    
    // تخزين الإعدادات في التخزين المحلي
    localStorage.setItem('walletAppSettings', JSON.stringify(appSettings));
    
    // عرض إشعار النجاح
    showToast('تم التعيين', 'تم استعادة الإعدادات الافتراضية بنجاح', 'success');
}

/**
 * تبديل الوضع المظلم
 */
function toggleDarkMode() {
    const darkMode = document.getElementById('dark-mode').checked;
    
    if (darkMode) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    
    // تحديث الإعدادات
    appSettings.darkMode = darkMode;
    localStorage.setItem('walletAppSettings', JSON.stringify(appSettings));
}

/**
 * تحديد وقت قفل التطبيق التلقائي
 */
function setupAutoLock() {
    // استرجاع وقت القفل من الإعدادات
    const autoLockTime = parseInt(appSettings.autoLock || '1') * 60 * 1000; // تحويل الدقائق إلى ميلي ثانية
    
    if (autoLockTime > 0) {
        let inactivityTimer;
        
        // إعادة تعيين المؤقت عند أي نشاط
        const resetTimer = () => {
            clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(() => {
                // التحقق من تسجيل الدخول
                if (currentUser) {
                    // عرض شاشة القفل أو تسجيل الخروج
                    confirmLogout();
                }
            }, autoLockTime);
        };
        
        // إعادة تعيين المؤقت عند حركة الماوس، الضغط على المفاتيح، اللمس
        document.addEventListener('mousemove', resetTimer);
        document.addEventListener('keydown', resetTimer);
        document.addEventListener('touchstart', resetTimer);
        
        // بدء المؤقت
        resetTimer();
    }
}

/**
 * تهيئة الأحداث عند تحميل المستند
 */
document.addEventListener('DOMContentLoaded', function() {
    debugLog('بدء تهيئة التطبيق...');
    
    // تهيئة تفاعلات واجهة المستخدم
    setupUIInteractions();
    
    // تهيئة نظام المصادقة
    setupAuthentication();
    
    // التحقق من وجود مستخدم حالي (استئناف الجلسة)
    firebase.auth().onAuthStateChanged(user => {
        hideLoaderOverlay();
        
        if (user) {
            // المستخدم مسجل الدخول
            currentUser = user;
            debugLog('تم استئناف الجلسة للمستخدم:', user.email);
            
            // جلب بيانات المستثمر
            fetchInvestorData()
                .then(() => {
                    // عرض واجهة التطبيق
                    showMainAppUI();
                    
                    // تحميل إعدادات التطبيق
                    loadSettingsData();
                    
                    // إعداد القفل التلقائي
                    setupAutoLock();
                    
                    // التعامل مع المسار الحالي
                    handleCurrentPath();
                })
                .catch(error => {
                    debugLog('خطأ في استئناف الجلسة:', error);
                    
                    // تسجيل الخروج في حالة وجود خطأ
                    firebase.auth().signOut().then(() => {
                        // عرض شاشة تسجيل الدخول
                        showLoginScreen();
                        
                        // عرض رسالة الخطأ
                        showToast('خطأ', 'حدث خطأ أثناء تحميل بياناتك، يرجى تسجيل الدخول مرة أخرى', 'error');
                    });
                });
        } else {
            // المستخدم غير مسجل الدخول
            debugLog('المستخدم غير مسجل الدخول، عرض شاشة تسجيل الدخول');
            
            // عرض شاشة تسجيل الدخول
            showLoginScreen();
            
            // تحميل إعدادات التطبيق
            loadSettingsData();
        }
    });
});

/**
 * معالجة المسار الحالي
 */
function handleCurrentPath() {
    // استخراج المسار من عنوان URL
    const hash = window.location.hash.substring(1);
    
    if (hash) {
        // إذا كان هناك مسار، انتقل إلى الصفحة المناسبة
        navigateToPage(hash);
    } else {
        // إذا لم يكن هناك مسار، انتقل إلى الصفحة الرئيسية
        navigateToPage('dashboard');
    }
    
    // إضافة مستمع أحداث لتغيير المسار
    window.addEventListener('hashchange', function() {
        const newHash = window.location.hash.substring(1);
        
        if (newHash) {
            navigateToPage(newHash);
        }
    });
}

/**
 * إعداد المخطط الزمني للتنبيهات
 */
function setupNotificationScheduler() {
    if (!investorData || !appSettings.notifications.profits) return;
    
    // تاريخ الاستحقاق القادم
    const nextPaymentDate = calculateNextProfitDate();
    
    // إنشاء إشعار تذكير بالاستحقاق قبل 3 أيام
    const reminderDate = new Date(nextPaymentDate);
    reminderDate.setDate(reminderDate.getDate() - 3);
    
    // المقارنة مع التاريخ الحالي
    const now = new Date();
    
    if (reminderDate > now) {
        // حساب الفارق الزمني بالميلي ثانية
        const timeUntilReminder = reminderDate - now;
        
        // إنشاء مؤقت للتذكير
        setTimeout(() => {
            // إنشاء إشعار تذكير
            const notification = {
                id: 'NOTIF-' + Date.now(),
                date: new Date().toISOString(),
                type: 'system',
                title: 'تذكير بالاستحقاق',
                message: `أرباحك مستحقة خلال 3 أيام بتاريخ ${formatDate(nextPaymentDate)}`,
                isRead: false,
                iconClass: 'orange',
                iconName: 'fa-bell'
            };
            
            // إضافة الإشعار إلى قائمة الإشعارات
            notifications.unshift(notification);
            
            // تحديث عدد الإشعارات غير المقروءة
            updateNotificationsCount();
            
            // عرض إشعار مؤقت
            showToast('تذكير', 'أرباحك مستحقة خلال 3 أيام', 'info');
        }, timeUntilReminder);
    }
}

/**
 * تنظيف ذاكرة التطبيق
 */
function cleanupAppCache() {
    // تنظيف المخططات البيانية
    if (investmentChart) investmentChart.destroy();
    if (profitsChart) profitsChart.destroy();
    if (profitHistoryChart) profitHistoryChart.destroy();
    
    // إعادة تعيين المتغيرات
    investmentChart = null;
    profitsChart = null;
    profitHistoryChart = null;
    
    // إزالة مستمعات الأحداث الإضافية
    window.removeEventListener('beforeunload', cleanupAppCache);
}

/**
 * تنفيذ العمليات اللازمة قبل إغلاق التطبيق
 */
window.addEventListener('beforeunload', function() {
    cleanupAppCache();
});

/**
 * تشخيص وإصلاح مشاكل التطبيق
 */
function runDiagnostics() {
    debugLog('تشغيل التشخيصات...');
    
    // التحقق من اتصال فايربيس
    try {
        const testRef = firebase.database().ref('.info/connected');
        testRef.once('value')
            .then(snapshot => {
                const connected = snapshot.val();
                debugLog('حالة اتصال فايربيس:', connected);
                
                if (!connected) {
                    showToast('تحذير', 'لا يوجد اتصال بالخادم، سيتم تخزين التغييرات محليًا حتى استعادة الاتصال', 'warning');
                }
            })
            .catch(error => {
                debugLog('خطأ في التحقق من اتصال فايربيس:', error);
            });
    } catch (error) {
        debugLog('خطأ في تهيئة فايربيس:', error);
    }
    
    // التحقق من التخزين المحلي
    try {
        localStorage.setItem('test', 'test');
        const testStorage = localStorage.getItem('test');
        localStorage.removeItem('test');
        
        if (testStorage !== 'test') {
            debugLog('خطأ في التخزين المحلي: عدم تطابق القيم');
            showToast('تحذير', 'يواجه المتصفح مشكلة في التخزين المحلي، قد تفقد بعض الإعدادات عند إغلاق المتصفح', 'warning');
        } else {
            debugLog('التخزين المحلي يعمل بشكل صحيح');
        }
    } catch (error) {
        debugLog('خطأ في التخزين المحلي:', error);
        showToast('تحذير', 'التخزين المحلي غير متوفر، قد تفقد بعض الإعدادات عند إغلاق المتصفح', 'warning');
    }
    
    // التحقق من توافق المتصفح
    checkBrowserCompatibility();
}

/**
 * التحقق من توافق المتصفح
 */
function checkBrowserCompatibility() {
    // التحقق من دعم Chart.js
    if (typeof Chart === 'undefined') {
        debugLog('تحذير: Chart.js غير متوفر');
        showToast('تحذير', 'المتصفح لا يدعم بعض ميزات الرسوم البيانية', 'warning');
    }
    
    // التحقق من دعم المصفوفات الحديثة
    if (!Array.prototype.find || !Array.prototype.filter) {
        debugLog('تحذير: المتصفح قديم ولا يدعم بعض ميزات JavaScript الحديثة');
        showToast('تحذير', 'المتصفح قديم، قد لا تعمل بعض الميزات بشكل صحيح', 'warning');
    }
    
    // التحقق من دعم Flexbox
    try {
        const testEl = document.createElement('div');
        testEl.style.display = 'flex';
        if (testEl.style.display !== 'flex') {
            debugLog('تحذير: المتصفح لا يدعم Flexbox');
            showToast('تحذير', 'المتصفح قديم، قد تواجه مشاكل في تنسيق الواجهة', 'warning');
        }
    } catch (error) {
        debugLog('خطأ في اختبار توافق CSS:', error);
    }
}

/**
 * تنفيذ التطبيق في وضع عدم الاتصال
 */
function setupOfflineMode() {
    // التحقق من حالة الاتصال بالإنترنت
    window.addEventListener('online', function() {
        debugLog('استعادة الاتصال بالإنترنت');
        showToast('متصل', 'تم استعادة الاتصال بالإنترنت', 'success');
        
        // مزامنة التغييرات التي تمت أثناء عدم الاتصال
        syncOfflineChanges();
    });
    
    window.addEventListener('offline', function() {
        debugLog('فقدان الاتصال بالإنترنت');
        showToast('غير متصل', 'فقدت الاتصال بالإنترنت، سيتم حفظ التغييرات محليًا', 'warning');
    });
    
    // التحقق من حالة الاتصال الحالية
    if (!navigator.onLine) {
        debugLog('بدء التطبيق في وضع عدم الاتصال');
        showToast('غير متصل', 'أنت تعمل حاليًا في وضع عدم الاتصال', 'warning');
    }
}

/**
 * مزامنة التغييرات التي تمت أثناء عدم الاتصال
 */
function syncOfflineChanges() {
    // التحقق من وجود تغييرات غير متزامنة
    const offlineChanges = localStorage.getItem('offlineChanges');
    
    if (offlineChanges) {
        try {
            const changes = JSON.parse(offlineChanges);
            
            if (changes.length > 0) {
                debugLog('جاري مزامنة', changes.length, 'تغييرات غير متزامنة');
                showLoaderOverlay('جاري مزامنة التغييرات...');
                
                // محاكاة عملية المزامنة
                setTimeout(() => {
                    // إزالة التغييرات من التخزين المحلي بعد المزامنة
                    localStorage.removeItem('offlineChanges');
                    
                    hideLoaderOverlay();
                    showToast('تمت المزامنة', 'تمت مزامنة التغييرات بنجاح', 'success');
                }, 2000);
            }
        } catch (error) {
            debugLog('خطأ في مزامنة التغييرات غير المتصلة:', error);
            showToast('خطأ', 'فشلت مزامنة بعض التغييرات', 'error');
        }
    }
}

/**
 * تخزين تغيير في وضع عدم الاتصال
 * @param {string} type نوع التغيير
 * @param {Object} data بيانات التغيير
 */
function storeOfflineChange(type, data) {
    // التحقق من حالة الاتصال
    if (!navigator.onLine) {
        // الحصول على التغييرات الحالية
        let offlineChanges = [];
        const storedChanges = localStorage.getItem('offlineChanges');
        
        if (storedChanges) {
            try {
                offlineChanges = JSON.parse(storedChanges);
            } catch (error) {
                debugLog('خطأ في تحليل التغييرات غير المتصلة:', error);
                offlineChanges = [];
            }
        }
        
        // إضافة التغيير الجديد
        offlineChanges.push({
            type,
            data,
            timestamp: new Date().toISOString()
        });
        
        // تخزين التغييرات المحدثة
        localStorage.setItem('offlineChanges', JSON.stringify(offlineChanges));
        
        debugLog('تم تخزين تغيير غير متصل:', type);
    }
}

/**
 * تشغيل التشخيصات ومحاكاة التطبيق عند البدء
 */
runDiagnostics();
setupOfflineMode();
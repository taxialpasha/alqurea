// استكمال كود JavaScript من الملف السابق
/**
 * wallet-app.js
 * نظام الاستثمار المتكامل - تطبيق محفظتي للمستثمرين
 * 
 * يحتوي على شيفرة جافاسكريبت لوظائف التطبيق الثانوي الخاص بالمستثمرين
 * يتكامل مع النظام الرئيسي عبر قاعدة بيانات Firebase
 */

// وضع التصحيح


// تهيئة المتغيرات العامة
let currentUser = null;         // المستخدم الحالي
let investorData = null;        // بيانات المستثمر
let transactions = [];          // العمليات
let investmentChart = null;     // مخطط الاستثمار
let profitsChart = null;        // مخطط الأرباح
let profitHistoryChart = null;  // مخطط تاريخ الأرباح
let currentPage = "dashboard";  // الصفحة الحالية

// معلومات المزامنة
let syncStatus = {
    lastSync: null,
    isSyncing: false
};

// دوال المساعدة (Utility Functions) أولاً
function debugLog(...args) {
    if (DEBUG_MODE) {
        console.log('DEBUG:', ...args);
    }
}

// تنسيق العملة
const formatCurrency = (amount) => {
    if (isNaN(amount)) return "0";
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

// تنسيق التاريخ
function formatDate(dateString, includeTime = false) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    
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

// الحصول على اسم الشهر بالعربية
function getMonthName(monthIndex) {
    const months = [
        'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
        'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    
    return months[monthIndex];
}

// عرض شاشة التحميل
function showLoaderOverlay(message = 'جاري التحميل...') {
    // إنشاء عنصر التحميل إذا لم يكن موجودًا
    let loader = document.getElementById('app-loader');
    
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'app-loader';
        
        loader.innerHTML = `
            <div class="loader-content">
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

// إخفاء شاشة التحميل
function hideLoaderOverlay() {
    const loader = document.getElementById('app-loader');
    
    if (loader) {
        loader.style.opacity = '0';
        
        setTimeout(() => {
            loader.style.display = 'none';
        }, 300);
    }
}

// عرض إشعار مؤقت
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
        <button class="toast-close">
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
            toast.classList.add('hide');
            
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 5000);
    }
}

// عرض نافذة منبثقة
function showModal(title, content) {
    const modal = document.getElementById('transaction-details-modal');
    if (!modal) return;
    
    const modalTitle = modal.querySelector('.modal-header h3');
    const modalContent = document.getElementById('transaction-details-content');
    
    // تعيين العنوان والمحتوى
    modalTitle.textContent = title;
    modalContent.innerHTML = content;
    
    // عرض النافذة
    modal.classList.add('active');
    
    // إضافة معالج الأحداث لزر الإغلاق
    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.classList.remove('active');
    });
}

// الآن نقوم بتعريف وظائف واجهة المستخدم (UI Functions)
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
    document.querySelectorAll('.sidebar-nav a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // الحصول على معرف الصفحة
            const pageId = link.getAttribute('data-page');
            navigateToPage(pageId);
        });
    });

    // روابط التنقل داخل التطبيق
    document.querySelectorAll('[data-page]').forEach(element => {
        if (element.tagName.toLowerCase() === 'a') {
            element.addEventListener('click', (e) => {
                e.preventDefault();
                const pageId = element.getAttribute('data-page');
                navigateToPage(pageId);
            });
        }
    });

    // فتح/إغلاق الشريط الجانبي
    const menuToggle = document.getElementById('menu-toggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', toggleSidebar);
    }

    // الإجراءات السريعة في الصفحة الرئيسية
    const quickWithdraw = document.getElementById('quick-withdraw');
    const viewProfits = document.getElementById('view-profits');
    const viewHistory = document.getElementById('view-history');
    
    if (quickWithdraw) quickWithdraw.addEventListener('click', () => navigateToPage('withdraw'));
    if (viewProfits) viewProfits.addEventListener('click', () => navigateToPage('profits'));
    if (viewHistory) viewHistory.addEventListener('click', () => navigateToPage('transactions'));

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
            if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
                logout();
            }
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
    const withdrawForm = document.getElementById('withdraw-form');
    if (withdrawForm) {
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

    // نموذج المعلومات الشخصية
    const personalInfoForm = document.getElementById('personal-info-form');
    if (personalInfoForm) {
        personalInfoForm.addEventListener('submit', (e) => {
            e.preventDefault();
            savePersonalInfo();
        });
    }

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

    // نموذج الأمان
    const securityForm = document.getElementById('security-form');
    if (securityForm) {
        securityForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveSecuritySettings();
        });
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
    
    debugLog('تم تهيئة تفاعلات واجهة المستخدم بنجاح');
}

function setupAuthentication() {
    debugLog('تهيئة نظام المصادقة');
    
    // نماذج المصادقة
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
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
            
            // إنشاء حساب جديد
            registerWithEmailPassword(email, password, investorId);
        });
    }
    
    debugLog('تم تهيئة نظام المصادقة بنجاح');
}

// ثم باقي دوال التطبيق (يتم إضافة باقي الدوال هنا)

// التنقل إلى صفحة
function navigateToPage(pageId) {
    // تعريف الدالة
}

// تبديل حالة الشريط الجانبي
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.classList.toggle('active');
    }
}

// تبديل لوحة الإشعارات
function toggleNotificationsPanel() {
    const panel = document.getElementById('notifications-panel');
    if (panel) {
        panel.classList.toggle('active');
    }
}

// تصفية الإشعارات
function filterNotifications(type) {
    // تعريف الدالة
}

// تعيين جميع الإشعارات كمقروءة
function markAllNotificationsAsRead() {
    // تعريف الدالة
}

// تصفية المعاملات
function filterTransactions(filterType) {
    // تعريف الدالة
}

// تسجيل الدخول
function loginWithEmailPassword(email, password) {
    // تعريف الدالة
}

// إنشاء حساب
function registerWithEmailPassword(email, password, investorId) {
    // تعريف الدالة
}

// التحقق من معرف المستثمر
function verifyInvestorId(investorId) {
    // تعريف الدالة
}

// ربط المستثمر بالمستخدم
function linkInvestorToUser(userId, investorId) {
    // تعريف الدالة
}

// جلب بيانات المستثمر
function fetchInvestorData() {
    // تعريف الدالة التي صحاناها سابقًا
}

// تسجيل الخروج
function logout() {
    // تعريف الدالة
}

// عرض شاشة تسجيل الدخول
function showLoginScreen() {
    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.getElementById('app-container');
    
    if (loginScreen) loginScreen.classList.remove('hidden');
    if (appContainer) appContainer.classList.add('hidden');
}

// عرض واجهة التطبيق
function showMainAppUI() {
    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.getElementById('app-container');
    
    if (loginScreen) loginScreen.classList.add('hidden');
    if (appContainer) appContainer.classList.remove('hidden');
    
    // تهيئة الرسوم البيانية
    initCharts();
}

// تحديث لوحة التحكم
function updateDashboard() {
    // تعريف الدالة
}

// تحديث الملف الشخصي
function updateUserProfile() {
    // تعريف الدالة
}

// المزيد من وظائف التطبيق...

// ثم نهاية الملف يتم تنفيذ هذا الكود للبدء:
document.addEventListener('DOMContentLoaded', () => {
    console.log("تهيئة تطبيق محفظتي...");
    debugLog("بدء تهيئة التطبيق");

    // إضافة مهلة زمنية للتحميل (30 ثانية)
    const loaderTimeout = setTimeout(() => {
        hideLoaderOverlay();
        showLoginScreen();
        showToast('خطأ', 'فشل الاتصال بالخادم، يرجى المحاولة مرة أخرى', 'error');
    }, 30000);

    try {
        // تهيئة سلوك التطبيق
        setupUIInteractions();
        setupAuthentication();

        // محاولة استعادة المستخدم الحالي
        firebase.auth().onAuthStateChanged((user) => {
            try {
                debugLog("حدث تغيير في حالة المصادقة", user ? "المستخدم مسجل الدخول" : "المستخدم غير مسجل الدخول");
                
                const appLoader = document.getElementById('app-loader');
                
                if (user) {
                    // المستخدم مسجل الدخول
                    currentUser = user;
                    debugLog(`تم تسجيل الدخول: ${user.email}, UID: ${user.uid}`);
                    
                    // إلغاء المهلة الزمنية
                    clearTimeout(loaderTimeout);
                    
                    // إظهار شاشة تسجيل الدخول مؤقتاً
                    hideLoaderOverlay();
                    showLoginScreen();
                    
                    // عرض إشعار بالنجاح
                    showToast('تم تسجيل الدخول', 'جاري تحميل بياناتك...', 'success');
                    
                } else {
                    // المستخدم غير مسجل الدخول
                    currentUser = null;
                    
                    // إلغاء المهلة الزمنية
                    clearTimeout(loaderTimeout);
                    
                    // إخفاء شاشة التحميل
                    if (appLoader) {
                        appLoader.style.opacity = '0';
                        setTimeout(() => {
                            appLoader.style.display = 'none';
                        }, 300);
                    }
                    
                    // عرض شاشة تسجيل الدخول
                    showLoginScreen();
                }
            } catch (error) {
                debugLog("خطأ في معالج حدث تغيير حالة المصادقة:", error);
                
                // إلغاء المهلة الزمنية
                clearTimeout(loaderTimeout);
                
                // إخفاء شاشة التحميل
                hideLoaderOverlay();
                
                // عرض شاشة تسجيل الدخول
                showLoginScreen();
                
                // عرض إشعار الخطأ
                showToast('خطأ', 'حدث خطأ أثناء تحميل بيانات المستخدم', 'error');
            }
        });
    } catch (error) {
        debugLog("خطأ في تهيئة التطبيق:", error);
        
        // إلغاء المهلة الزمنية
        clearTimeout(loaderTimeout);
        
        // إخفاء شاشة التحميل
        hideLoaderOverlay();
        
        // عرض شاشة تسجيل الدخول
        showLoginScreen();
        
        // عرض إشعار الخطأ
        showToast('خطأ', 'حدث خطأ أثناء تهيئة التطبيق', 'error');
    }
});
    // أزرار الإشعارات
    document.getElementById('notifications-btn').addEventListener('click', toggleNotificationsPanel);
    document.getElementById('close-notifications').addEventListener('click', toggleNotificationsPanel);
    document.getElementById('mark-all-read').addEventListener('click', markAllNotificationsAsRead);

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
    document.getElementById('logout-btn').addEventListener('click', () => {
        if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
            logout();
        }
    });

    // تصفية المعاملات
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // تصفية المعاملات حسب النوع
            filterTransactions(btn.getAttribute('data-filter'));
        });
    });

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
    const withdrawForm = document.getElementById('withdraw-form');
    if (withdrawForm) {
        withdrawForm.addEventListener('submit', (e) => {
            e.preventDefault();
            submitWithdrawalRequest();
        });

        // تغيير طريقة السحب
        document.getElementById('withdrawal-method').addEventListener('change', () => {
            const method = document.getElementById('withdrawal-method').value;
            
            // إخفاء كل حقول الطرق
            document.getElementById('bank-details').classList.add('hidden');
            document.getElementById('wallet-details').classList.add('hidden');
            
            // إظهار حقول الطريقة المحددة
            if (method === 'bank') {
                document.getElementById('bank-details').classList.remove('hidden');
            } else if (method === 'wallet') {
                document.getElementById('wallet-details').classList.remove('hidden');
            }
        });

        // إلغاء السحب
        document.getElementById('cancel-withdraw').addEventListener('click', () => {
            withdrawForm.reset();
            navigateToPage('dashboard');
        });
    }

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

    // نموذج المعلومات الشخصية
    const personalInfoForm = document.getElementById('personal-info-form');
    if (personalInfoForm) {
        personalInfoForm.addEventListener('submit', (e) => {
            e.preventDefault();
            savePersonalInfo();
        });
    }

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

    // نموذج الأمان
    const securityForm = document.getElementById('security-form');
    if (securityForm) {
        securityForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveSecuritySettings();
        });
    }

    // إعدادات التطبيق
    document.getElementById('save-settings').addEventListener('click', saveAppSettings);
    document.getElementById('reset-settings').addEventListener('click', resetAppSettings);

    // تبديل الوضع المظلم
    document.getElementById('dark-mode').addEventListener('change', toggleDarkMode);


// إعداد المصادقة
function setupAuthentication() {
    // نماذج المصادقة
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
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
            
            // إنشاء حساب جديد
            registerWithEmailPassword(email, password, investorId);
        });
    }
}

// تسجيل الدخول باستخدام البريد الإلكتروني وكلمة المرور
function loginWithEmailPassword(email, password) {
    // عرض حالة التحميل
    showLoaderOverlay('جاري تسجيل الدخول...');
    
    firebase.auth().signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // تسجيل الدخول بنجاح
            currentUser = userCredential.user;
            showToast('تم تسجيل الدخول', 'تم تسجيل الدخول بنجاح', 'success');
        })
        .catch((error) => {
            console.error("خطأ في تسجيل الدخول:", error);
            
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
            
            showToast('خطأ', errorMessage, 'error');
            hideLoaderOverlay();
        });
}

// إنشاء حساب جديد
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
            showToast('تم إنشاء الحساب', 'تم إنشاء الحساب وربطه بحسابك الاستثماري بنجاح', 'success');
        })
        .catch((error) => {
            console.error("خطأ في إنشاء الحساب:", error);
            
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
            
            showToast('خطأ', errorMessage, 'error');
            hideLoaderOverlay();
        });
}

// تسجيل الخروج
function logout() {
    firebase.auth().signOut()
        .then(() => {
            // تسجيل الخروج بنجاح
            currentUser = null;
            investorData = null;
            
            // عرض شاشة تسجيل الدخول
            showLoginScreen();
            
            showToast('تم تسجيل الخروج', 'تم تسجيل الخروج بنجاح', 'info');
        })
        .catch((error) => {
            console.error("خطأ في تسجيل الخروج:", error);
            showToast('خطأ', 'فشل تسجيل الخروج', 'error');
        });
}

/// التحقق من معرف المستثمر
function verifyInvestorId(investorId) {
    return new Promise((resolve, reject) => {
        // البحث عن المستثمر في جميع المستخدمين
        // هذا مثال مبسط، قد تحتاج لتنفيذ منطق أكثر تعقيدًا حسب هيكل البيانات الفعلي
        firebase.database().ref('users').once('value')
            .then((snapshot) => {
                const users = snapshot.val();
                let found = false;
                
                // البحث في جميع المستخدمين
                for (const userId in users) {
                    if (users[userId].investors && users[userId].investors.data) {
                        for (const i in users[userId].investors.data) {
                            if (users[userId].investors.data[i].id === investorId) {
                                found = true;
                                break;
                            }
                        }
                    }
                    if (found) break;
                }
                
                resolve(found);
            })
            .catch((error) => {
                console.error("خطأ في التحقق من معرف المستثمر:", error);
                reject(error);
            });
    });
}
// ربط معرف المستثمر بحساب المستخدم
function linkInvestorToUser(userId, investorId) {
    // البحث عن بيانات المستثمر أولاً
    return firebase.database().ref('users').once('value')
        .then((snapshot) => {
            const users = snapshot.val();
            let investorData = null;
            let sourceUserId = null;
            
            // البحث عن المستثمر في جميع المستخدمين
            for (const uid in users) {
                if (users[uid].investors && users[uid].investors.data) {
                    for (const i in users[uid].investors.data) {
                        if (users[uid].investors.data[i].id === investorId) {
                            investorData = users[uid].investors.data[i];
                            sourceUserId = uid;
                            break;
                        }
                    }
                }
                if (investorData) break;
            }
            
            if (!investorData) {
                throw new Error('لم يتم العثور على بيانات المستثمر');
            }
            
            // إنشاء مرجع للمستثمر في حساب المستخدم الجديد
            return firebase.database().ref(`users/${userId}/investors/data/0`).set(investorData);
        });
}
// جلب بيانات المستثمر
function fetchInvestorData() {
    return new Promise((resolve, reject) => {
        if (!currentUser) {
            reject(new Error('المستخدم غير مسجل الدخول'));
            return;
        }
        
        // جلب بيانات المستثمر مباشرة من مسار المستخدم
        firebase.database().ref(`users/${currentUser.uid}/investors/data/0`).once('value')
            .then((snapshot) => {
                const data = snapshot.val();
                
                if (!data) {
                    reject(new Error('لم يتم العثور على بيانات المستثمر'));
                    return;
                }
                
                investorData = data;
                
                // جلب العمليات المرتبطة بالمستثمر - مسار العمليات قد يحتاج أيضًا للتعديل
                return firebase.database().ref(`users/${currentUser.uid}/transactions`).once('value');
            })
            .then((snapshot) => {
                const transactionsData = snapshot.val();
                
                if (transactionsData) {
                    transactions = Object.values(transactionsData);
                    // ترتيب العمليات من الأحدث إلى الأقدم
                    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
                }
                
                // تحديث وقت المزامنة الأخير
                syncStatus.lastSync = new Date();
                syncStatus.isSyncing = false;
                
                resolve(investorData);
            })
            .catch((error) => {
                console.error("خطأ في جلب بيانات المستثمر:", error);
                syncStatus.isSyncing = false;
                reject(error);
            });
    });
}

// عرض شاشة تسجيل الدخول
function showLoginScreen() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-container').classList.add('hidden');
}

// عرض واجهة التطبيق الرئيسية
function showMainAppUI() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
    
    // تهيئة الرسوم البيانية
    initCharts();
}

// عرض شاشة ربط المستثمر
function showLinkInvestorScreen() {
    // يمكن إضافة منطق لعرض شاشة لربط المستثمر بالحساب الحالي
}

// التنقل إلى صفحة معينة
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
    document.getElementById(`${pageId}-page`).classList.add('active');
    
    // إضافة الفئة النشطة لرابط التنقل المحدد
    document.querySelector(`.sidebar-nav li a[data-page="${pageId}"]`).parentElement.classList.add('active');
    
    // إغلاق الشريط الجانبي في الشاشات الصغيرة
    if (window.innerWidth < 1024) {
        document.querySelector('.sidebar').classList.remove('active');
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
    }
}

// تبديل حالة الشريط الجانبي
function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('active');
}

// تبديل لوحة الإشعارات
function toggleNotificationsPanel() {
    document.getElementById('notifications-panel').classList.toggle('active');
}

// تحديث لوحة التحكم
function updateDashboard() {
    if (!investorData) return;
    
    // تحديث بيانات البطاقة
    document.getElementById('total-balance').textContent = formatCurrency(investorData.amount || 0);
    document.getElementById('daily-profit').textContent = formatCurrency(calculateDailyProfit());
    document.getElementById('monthly-profit').textContent = formatCurrency(calculateMonthlyProfit());
    document.getElementById('investor-name').textContent = investorData.name;
    
    // تحديث ملخص البيانات
    document.getElementById('total-investment').textContent = `${formatCurrency(investorData.amount || 0)} دينار`;
    document.getElementById('interest-rate').textContent = `${investorData.interestRate || 17.5}%`;
    
    // حساب مدة الاستثمار
    const joinDate = new Date(investorData.joinDate || investorData.createdAt);
    const today = new Date();
    const durationDays = Math.floor((today - joinDate) / (1000 * 60 * 60 * 24));
    document.getElementById('investment-duration').textContent = `${durationDays} يوم`;
    
    // حساب تاريخ الاستحقاق القادم
    const nextPaymentDate = calculateNextProfitDate();
    document.getElementById('next-profit-date').textContent = formatDate(nextPaymentDate);
    
    // تحديث آخر المعاملات
    updateRecentTransactions();
}

// تحديث معلومات المستخدم في الواجهة
function updateUserProfile() {
    if (!investorData) return;
    
    // تحديث اسم المستخدم وصورته
    document.getElementById('user-name').textContent = investorData.name;
    document.getElementById('user-email').textContent = currentUser.email;
    
    // تحديث الصور في حالة وجودها
    if (investorData.photoURL) {
        document.getElementById('user-avatar').src = investorData.photoURL;
        document.getElementById('sidebar-avatar').src = investorData.photoURL;
    }
}

// حساب الربح اليومي
function calculateDailyProfit() {
    if (!investorData) return 0;
    
    const amount = investorData.amount || 0;
    const rate = investorData.interestRate || 17.5;
    
    // الربح اليومي (الربح السنوي / 365)
    return (amount * (rate / 100)) / 30;
}

// حساب الربح الشهري
function calculateMonthlyProfit() {
    if (!investorData) return 0;
    
    const amount = investorData.amount || 0;
    const rate = investorData.interestRate || 17.5;
    
    // الربح الشهري
    return amount * (rate / 100);
}

// حساب تاريخ استحقاق الربح القادم
function calculateNextProfitDate() {
    if (!investorData) return new Date();
    
    // تاريخ الانضمام
    const joinDate = new Date(investorData.joinDate || investorData.createdAt);
    const today = new Date();
    
    // الشهر القادم من تاريخ الانضمام
    const nextDate = new Date(joinDate);
    nextDate.setMonth(nextDate.getMonth() + Math.ceil((today - joinDate) / (30 * 24 * 60 * 60 * 1000)));
    
    return nextDate;
}

// تحديث آخر المعاملات
function updateRecentTransactions() {
    const recentTransactionsList = document.getElementById('recent-transactions-list');
    if (!recentTransactionsList || !transactions.length) return;
    
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

// تهيئة الرسوم البيانية
function initCharts() {
    // مخطط تطور الاستثمار
    initInvestmentChart();
    
    // مخطط الأرباح التراكمية
    initProfitsChart();
}

// تهيئة مخطط الاستثمار
function initInvestmentChart() {
    const ctx = document.getElementById('investment-chart');
    if (!ctx) return;
    
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

// تهيئة مخطط الأرباح
function initProfitsChart() {
    const ctx = document.getElementById('profits-chart');
    if (!ctx) return;
    
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

// توليد بيانات مخطط الاستثمار
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

// تحديث مخطط الاستثمار
function updateInvestmentChart(period) {
    if (!investmentChart) return;
    
    const chartData = generateInvestmentChartData(period);
    
    investmentChart.data.labels = chartData.labels;
    investmentChart.data.datasets[0].data = chartData.values;
    investmentChart.update();
}

// تحديث مخطط الأرباح
function updateProfitsChart(period) {
    if (!profitsChart) return;
    
    const chartData = generateProfitsChartData(period);
    
    profitsChart.data.labels = chartData.labels;
    profitsChart.data.datasets[0].data = chartData.values;
    profitsChart.update();
}

// تحميل بيانات المعاملات
function loadTransactions() {
    const tableBody = document.getElementById('transactions-table-body');
    if (!tableBody || !transactions.length) return;
    
    // عرض جميع المعاملات
    renderTransactionsTable(transactions);
}

// عرض المعاملات في الجدول
function renderTransactionsTable(transactionsData) {
    const tableBody = document.getElementById('transactions-table-body');
    if (!tableBody) return;
    
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
                <button class="detail-btn" data-id="${transaction.id}">
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
    
    // إذا لم تكن هناك معاملات
    if (transactionsData.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">لا توجد معاملات</td>
            </tr>
        `;
    }
    
    // تحديث أرقام الصفحات
    updatePagination(transactionsData.length);
}

// تصفية المعاملات حسب النوع
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
    
    // عرض المعاملات المصفاة
    renderTransactionsTable(filteredTransactions);
}

// عرض تفاصيل المعاملة
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

// تحديث الترقيم
function updatePagination(totalItems) {
    const paginationNumbers = document.getElementById('pagination-numbers');
    if (!paginationNumbers) return;
    
    // تغيير أرقام الصفحات حسب عدد العناصر
    const pageSize = 10; // عدد العناصر في الصفحة
    const totalPages = Math.ceil(totalItems / pageSize);
    
    let paginationHTML = '';
    
    for (let i = 1; i <= totalPages; i++) {
        paginationHTML += `<span class="page-number ${i === 1 ? 'active' : ''}">${i}</span>`;
    }
    
    paginationNumbers.innerHTML = paginationHTML;
    
    // إضافة معالجات الأحداث لأرقام الصفحات
    paginationNumbers.querySelectorAll('.page-number').forEach(pageNumber => {
        pageNumber.addEventListener('click', () => {
            // إزالة الفئة النشطة من جميع أرقام الصفحات
            paginationNumbers.querySelectorAll('.page-number').forEach(p => p.classList.remove('active'));
            // إضافة الفئة النشطة للرقم المحدد
            pageNumber.classList.add('active');
            
            // تحديث المعاملات المعروضة
            // في نسخة حقيقية: سيتم تنفيذ المنطق لجلب المعاملات للصفحة المحددة
        });
    });
}

// تحميل بيانات الأرباح
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

// تهيئة مخطط تاريخ الأرباح
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

// توليد بيانات مخطط تاريخ الأرباح
function generateProfitHistoryData(period) {
    // تصفية المعاملات للحصول على دفعات الأرباح فقط
    const profitPayments = transactions.filter(transaction => transaction.type === 'دفع أرباح');
    
    const labels = [];
    const values = [];
    
    const now = new Date();
    let intervals = 12; // الافتراضي: شهر (12 نقطة)
    
    if (period === 'quarter') {
        intervals = 6; // ربع سنة (6 نقاط)
    } else if (period === 'year') {
        intervals = 12; // سنة (12 نقطة، كل شهر)
    } else {
        intervals = 12; // شهر (12 نقطة، كل أسبوع)
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

// تحديث مخطط تاريخ الأرباح
function updateProfitHistoryChart(period) {
    if (!profitHistoryChart) return;
    
    const chartData = generateProfitHistoryData(period);
    
    profitHistoryChart.data.labels = chartData.labels;
    profitHistoryChart.data.datasets[0].data = chartData.values;
    profitHistoryChart.update();
}

// تحميل سجل دفعات الأرباح
function loadProfitPayments() {
    // تصفية المعاملات للحصول على دفعات الأرباح فقط
    const profitPayments = transactions.filter(transaction => transaction.type === 'دفع أرباح');
    
    const tbody = document.getElementById('profit-payments-body');
    if (!tbody) return;
    
    // تفريغ الجدول
    tbody.innerHTML = '';
    
    // إذا لم تكن هناك دفعات أرباح
    if (profitPayments.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center">لا توجد دفعات أرباح سابقة</td>
            </tr>
        `;
        return;
    }
    
    // عرض دفعات الأرباح
    profitPayments.forEach(payment => {
        const row = document.createElement('tr');
        
        // حساب الفترة (شهر، ربع سنة، إلخ)
        const period = 'شهر'; // افتراضي
        
        row.innerHTML = `
            <td>${formatDate(payment.date)}</td>
            <td>${period}</td>
            <td>${formatCurrency(payment.amount)} دينار</td>
            <td><span class="status completed">مدفوعة</span></td>
        `;
        
        tbody.appendChild(row);
    });
}

// تحميل معلومات السحب
function loadWithdrawInfo() {
    if (!investorData) return;
    
    // تحديث الرصيد المتاح للسحب
    document.getElementById('available-balance').textContent = formatCurrency(investorData.amount || 0);
    
    // تحميل تاريخ طلبات السحب
    loadWithdrawHistory();
}

// تحميل تاريخ طلبات السحب
function loadWithdrawHistory() {
    // تصفية المعاملات للحصول على عمليات السحب فقط
    const withdrawals = transactions.filter(transaction => transaction.type === 'سحب');
    
    const tbody = document.getElementById('withdrawals-history-body');
    if (!tbody) return;
    
    // تفريغ الجدول
    tbody.innerHTML = '';
    
    // إذا لم تكن هناك طلبات سحب
    if (withdrawals.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">لا توجد طلبات سحب سابقة</td>
            </tr>
        `;
        return;
    }
    
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
        
        row.innerHTML = `
            <td>${formatDate(withdrawal.date)}</td>
            <td>${formatCurrency(withdrawal.amount)} دينار</td>
            <td>${method}</td>
            <td><span class="status ${statusClass}">${statusText}</span></td>
            <td>
                <button class="detail-btn" data-id="${withdrawal.id}">
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

// تقديم طلب سحب
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
            // إعادة تحميل بيانات المستثمر
            return fetchInvestorData();
        })
        .then(() => {
            hideLoaderOverlay();
            
            // عرض إشعار النجاح
            showToast('تم تقديم الطلب', 'تم تقديم طلب السحب بنجاح وسيتم معالجته قريبًا', 'success');
            
            // عرض نافذة تأكيد طلب السحب
            showWithdrawalSuccessModal(withdrawalData);
            
            // إعادة تعيين نموذج السحب
            document.getElementById('withdraw-form').reset();
        })
        .catch(error => {
            hideLoaderOverlay();
            console.error('خطأ في تقديم طلب السحب:', error);
            showToast('خطأ', 'حدث خطأ أثناء تقديم طلب السحب', 'error');
        });
}

// إرسال طلب السحب إلى النظام الرئيسي
function sendWithdrawalRequest(withdrawalData) {
    return new Promise((resolve, reject) => {
        // في التطبيق الحقيقي: سيتم إرسال الطلب إلى API النظام الرئيسي
        
        // محاكاة الاتصال بالخادم
        setTimeout(() => {
            // إنشاء طلب سحب جديد
            const newWithdrawal = {
                id: 'WD-' + Date.now(),
                date: new Date().toISOString(),
                type: 'سحب',
                investorId: investorData.id,
                investorName: investorData.name,
                amount: withdrawalData.amount,
                status: 'pending',
                method: withdrawalData.method,
                notes: withdrawalData.notes,
                requestDetails: withdrawalData
            };
            
            // إضافة الطلب إلى قائمة المعاملات (محاكاة)
            transactions.unshift(newWithdrawal);
            
            resolve(newWithdrawal);
        }, 1500);
    });
}

// عرض نافذة تأكيد طلب السحب
function showWithdrawalSuccessModal(withdrawalData) {
    // تحديث بيانات الطلب في النافذة
    document.getElementById('withdraw-request-id').textContent = '#WD-' + Date.now();
    document.getElementById('withdraw-request-amount').textContent = formatCurrency(withdrawalData.amount) + ' دينار';
    document.getElementById('withdraw-request-date').textContent = formatDate(new Date());
    
    // عرض النافذة
    document.getElementById('withdraw-success-modal').classList.add('active');
    
    // إضافة معالج الأحداث لزر إغلاق النافذة
    document.querySelectorAll('#withdraw-success-modal .modal-close, #withdraw-success-modal .modal-close-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.getElementById('withdraw-success-modal').classList.remove('active');
            navigateToPage('dashboard');
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

// تحميل بيانات الملف الشخصي
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

// حفظ المعلومات الشخصية
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
      // إعادة تحميل بيانات المستثمر
      return fetchInvestorData();
  })
  .then(() => {
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

// تحديث معلومات المستثمر
function updateInvestorInfo(updateData) {
return new Promise((resolve, reject) => {
  if (!investorData || !currentUser) {
      reject(new Error('بيانات المستثمر أو المستخدم غير متوفرة'));
      return;
  }
  
  // في التطبيق الحقيقي: سيتم إرسال البيانات المحدثة إلى API النظام الرئيسي
  
  // محاكاة الاتصال بالخادم
  setTimeout(() => {
      // تحديث البيانات المحلية
      Object.assign(investorData, updateData);
      
      resolve(investorData);
  }, 1000);
});
}

// حفظ إعدادات الأمان
function saveSecuritySettings() {
const currentPassword = document.getElementById('current-password').value;
const newPassword = document.getElementById('new-password').value;
const confirmPassword = document.getElementById('confirm-new-password').value;

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
  // عرض حالة التحميل
  showLoaderOverlay('جاري تحديث كلمة المرور...');
  
  // إعادة المصادقة قبل تغيير كلمة المرور
  const credential = firebase.auth.EmailAuthProvider.credential(
      currentUser.email,
      currentPassword
  );
  
  currentUser.reauthenticateWithCredential(credential)
      .then(() => {
          // تغيير كلمة المرور
          return currentUser.updatePassword(newPassword);
      })
      .then(() => {
          hideLoaderOverlay();
          
          // إعادة تعيين النموذج
          document.getElementById('security-form').reset();
          
          // عرض إشعار النجاح
          showToast('تم التحديث', 'تم تحديث كلمة المرور بنجاح', 'success');
      })
      .catch(error => {
          hideLoaderOverlay();
          console.error('خطأ في تحديث كلمة المرور:', error);
          
          let errorMessage = 'حدث خطأ أثناء تحديث كلمة المرور';
          if (error.code === 'auth/wrong-password') {
              errorMessage = 'كلمة المرور الحالية غير صحيحة';
          }
          
          showToast('خطأ', errorMessage, 'error');
      });
}

// التعامل مع المصادقة الثنائية
const twoFactorEnabled = document.getElementById('two-factor').checked;

// في التطبيق الحقيقي: تحديث إعدادات المصادقة الثنائية
}

// حفظ إعدادات التطبيق
function saveAppSettings() {
// جمع الإعدادات من النموذج
const language = document.getElementById('language-setting').value;
const currency = document.getElementById('currency-setting').value;
const darkMode = document.getElementById('dark-mode').checked;

// حفظ الإعدادات في التخزين المحلي
const appSettings = {
  language,
  currency,
  darkMode,
  autoLock: document.getElementById('auto-lock').value,
  notifications: {
      profits: document.getElementById('profit-alerts').checked,
      transactions: document.getElementById('transaction-alerts').checked
  }
};

localStorage.setItem('walletAppSettings', JSON.stringify(appSettings));

// تطبيق الإعدادات
applyAppSettings(appSettings);

// عرض إشعار النجاح
showToast('تم الحفظ', 'تم حفظ الإعدادات بنجاح', 'success');
}

// إعادة تعيين إعدادات التطبيق إلى الافتراضية
function resetAppSettings() {
// الإعدادات الافتراضية
const defaultSettings = {
  language: 'ar',
  currency: 'دينار',
  darkMode: false,
  autoLock: '1',
  notifications: {
      profits: true,
      transactions: true
  }
};

// حفظ الإعدادات الافتراضية
localStorage.setItem('walletAppSettings', JSON.stringify(defaultSettings));

// تحديث قيم النموذج
document.getElementById('language-setting').value = defaultSettings.language;
document.getElementById('currency-setting').value = defaultSettings.currency;
document.getElementById('dark-mode').checked = defaultSettings.darkMode;
document.getElementById('auto-lock').value = defaultSettings.autoLock;
document.getElementById('profit-alerts').checked = defaultSettings.notifications.profits;
document.getElementById('transaction-alerts').checked = defaultSettings.notifications.transactions;

// تطبيق الإعدادات
applyAppSettings(defaultSettings);

// عرض إشعار النجاح
showToast('تم إعادة التعيين', 'تم إعادة تعيين الإعدادات إلى الافتراضية', 'success');
}

// تطبيق إعدادات التطبيق
function applyAppSettings(settings) {
// تطبيق الوضع المظلم
if (settings.darkMode) {
  document.body.classList.add('dark-mode');
} else {
  document.body.classList.remove('dark-mode');
}

// تطبيق اللغة والعملة
// في التطبيق الحقيقي: سيتم تنفيذ منطق أكثر تعقيدًا لتغيير اللغة والعملة
}

// تبديل الوضع المظلم
function toggleDarkMode() {
const darkModeEnabled = document.getElementById('dark-mode').checked;

if (darkModeEnabled) {
  document.body.classList.add('dark-mode');
} else {
  document.body.classList.remove('dark-mode');
}
}

// تصفية الإشعارات حسب النوع
function filterNotifications(type) {
// في التطبيق الحقيقي: سيتم تنفيذ منطق لتصفية الإشعارات حسب النوع
}

// تعيين جميع الإشعارات كمقروءة
function markAllNotificationsAsRead() {
// في التطبيق الحقيقي: سيتم تنفيذ منطق لتعيين جميع الإشعارات كمقروءة

// إزالة الفئة "unread" من جميع الإشعارات
document.querySelectorAll('.notification-item.unread').forEach(item => {
  item.classList.remove('unread');
});

// تحديث عدد الإشعارات
updateNotificationsCount();

// عرض إشعار النجاح
showToast('تم تعيين الكل كمقروء', 'تم تعيين جميع الإشعارات كمقروءة', 'success');
}

// تحديث عدد الإشعارات
function updateNotificationsCount() {
const unreadCount = document.querySelectorAll('.notification-item.unread').length;

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

// عرض نافذة منبثقة
function showModal(title, content) {
const modal = document.getElementById('transaction-details-modal');
const modalTitle = modal.querySelector('.modal-header h3');
const modalContent = document.getElementById('transaction-details-content');

// تعيين العنوان والمحتوى
modalTitle.textContent = title;
modalContent.innerHTML = content;

// عرض النافذة
modal.classList.add('active');

// إضافة معالج الأحداث لزر الإغلاق
modal.querySelector('.modal-close').addEventListener('click', () => {
  modal.classList.remove('active');
});
}

// عرض شاشة التحميل
function showLoaderOverlay(message = 'جاري التحميل...') {
// إنشاء عنصر التحميل إذا لم يكن موجودًا
let loader = document.getElementById('app-loader');

if (!loader) {
  loader = document.createElement('div');
  loader.id = 'app-loader';
  
  loader.innerHTML = `
      <div class="loader-content">
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

// إخفاء شاشة التحميل
function hideLoaderOverlay() {
const loader = document.getElementById('app-loader');

if (loader) {
  loader.style.opacity = '0';
  
  setTimeout(() => {
      loader.style.display = 'none';
  }, 300);
}
}

// عرض إشعار مؤقت
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
  <button class="toast-close">
      <i class="fas fa-times"></i>
  </button>
`;

// إضافة الإشعار إلى الحاوية
const container = document.getElementById('toast-container');
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
  toast.classList.add('hide');
  
  setTimeout(() => {
      toast.remove();
  }, 300);
}, 5000);
}

// تنسيق التاريخ
function formatDate(dateString, includeTime = false) {
if (!dateString) return '';

const date = new Date(dateString);

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

// الحصول على اسم الشهر بالعربية
function getMonthName(monthIndex) {
const months = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

return months[monthIndex];
}

// تهيئة التطبيق عند تحميل الصفحة
window.addEventListener('load', () => {
// تحميل إعدادات التطبيق من التخزين المحلي
const savedSettings = localStorage.getItem('walletAppSettings');

if (savedSettings) {
  try {
      const settings = JSON.parse(savedSettings);
      
      // تحديث قيم النموذج
      if (document.getElementById('language-setting')) {
          document.getElementById('language-setting').value = settings.language || 'ar';
      }
      
      if (document.getElementById('currency-setting')) {
          document.getElementById('currency-setting').value = settings.currency || 'دينار';
      }
      
      if (document.getElementById('dark-mode')) {
          document.getElementById('dark-mode').checked = settings.darkMode || false;
      }
      
      if (document.getElementById('auto-lock')) {
          document.getElementById('auto-lock').value = settings.autoLock || '1';
      }
      
      if (settings.notifications) {
          if (document.getElementById('profit-alerts')) {
              document.getElementById('profit-alerts').checked = settings.notifications.profits !== false;
          }
          
          if (document.getElementById('transaction-alerts')) {
              document.getElementById('transaction-alerts').checked = settings.notifications.transactions !== false;
          }
      }
      
      // تطبيق الإعدادات
      applyAppSettings(settings);
  } catch (error) {
      console.error('خطأ في تحميل إعدادات التطبيق:', error);
  }
}
});


// تعديل وظيفة تهيئة التطبيق
document.addEventListener('DOMContentLoaded', () => {
    console.log("تهيئة تطبيق محفظتي...");

    // إضافة مهلة زمنية للتحميل (30 ثانية)
    const loaderTimeout = setTimeout(() => {
        hideLoaderOverlay();
        showLoginScreen();
        showToast('خطأ', 'فشل الاتصال بالخادم، يرجى المحاولة مرة أخرى', 'error');
    }, 30000);

    // تهيئة سلوك التطبيق
    setupUIInteractions();
    setupAuthentication();

    // محاولة استعادة المستخدم الحالي
    firebase.auth().onAuthStateChanged((user) => {
        const appLoader = document.getElementById('app-loader');
        
        try {
            if (user) {
                // المستخدم مسجل الدخول
                currentUser = user;
                console.log(`تم تسجيل الدخول: ${user.email}`);
                
                // جلب بيانات المستثمر
                fetchInvestorData()
                    .then(() => {
                        // إلغاء المهلة الزمنية عند نجاح التحميل
                        clearTimeout(loaderTimeout);
                        
                        // إخفاء شاشة التحميل
                        if (appLoader) {
                            appLoader.style.opacity = '0';
                            setTimeout(() => {
                                appLoader.style.display = 'none';
                            }, 300);
                        }
                        
                        // عرض واجهة التطبيق
                        showMainAppUI();
                        
                        // تحديث الواجهة
                        updateDashboard();
                        updateUserProfile();
                    })
                    .catch(error => {
                        console.error("خطأ في جلب بيانات المستثمر:", error);
                        
                        // إلغاء المهلة الزمنية
                        clearTimeout(loaderTimeout);
                        
                        // إخفاء شاشة التحميل
                        hideLoaderOverlay();
                        
                        // إظهار خطأ
                        showToast('خطأ', 'تعذر جلب بيانات المستثمر: ' + error.message, 'error');
                        
                        // إظهار شاشة الربط بمعرف المستثمر أو تسجيل الخروج
                        logout();
                    });
            } else {
                // المستخدم غير مسجل الدخول
                currentUser = null;
                
                // إلغاء المهلة الزمنية
                clearTimeout(loaderTimeout);
                
                // إخفاء شاشة التحميل
                if (appLoader) {
                    appLoader.style.opacity = '0';
                    setTimeout(() => {
                        appLoader.style.display = 'none';
                    }, 300);
                }
                
                // عرض شاشة تسجيل الدخول
                showLoginScreen();
            }
        } catch (error) {
            console.error("خطأ غير متوقع في معالجة حالة المصادقة:", error);
            
            // إلغاء المهلة الزمنية
            clearTimeout(loaderTimeout);
            
            // إخفاء شاشة التحميل
            hideLoaderOverlay();
            
            // عرض شاشة تسجيل الدخول
            showLoginScreen();
            
            // عرض رسالة الخطأ
            showToast('خطأ', 'حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى', 'error');
        }
    }, error => {
        console.error("خطأ في حالة المصادقة:", error);
        
        // إلغاء المهلة الزمنية
        clearTimeout(loaderTimeout);
        
        // إخفاء شاشة التحميل
        hideLoaderOverlay();
        
        // عرض شاشة تسجيل الدخول
        showLoginScreen();
        
        // عرض رسالة الخطأ
        showToast('خطأ', 'فشل الاتصال بخدمة المصادقة، يرجى المحاولة مرة أخرى', 'error');
    });
});


// وضع التصحيح
const DEBUG_MODE = true;

function debugLog(...args) {
    if (DEBUG_MODE) {
        console.log('DEBUG:', ...args);
    }
}

// تعديل وظيفة fetchInvestorData لإضافة تسجيل التصحيح
function fetchInvestorData() {
    return new Promise((resolve, reject) => {
        if (!currentUser) {
            debugLog('لا يوجد مستخدم حالي');
            reject(new Error('المستخدم غير مسجل الدخول'));
            return;
        }
        
        debugLog('محاولة جلب بيانات المستثمر، UID:', currentUser.uid);
        
        // جلب بيانات المستثمر من مسار المستخدم
        firebase.database().ref(`users/${currentUser.uid}/investors/data/0`).once('value')
            .then((snapshot) => {
                debugLog('استجابة البيانات:', snapshot.val());
                const data = snapshot.val();
                
                if (!data) {
                    debugLog('لم يتم العثور على بيانات المستثمر');
                    reject(new Error('لم يتم العثور على بيانات المستثمر'));
                    return;
                }
                
                investorData = data;
                debugLog('تم استلام بيانات المستثمر:', investorData);
                
                // جلب العمليات المرتبطة بالمستثمر
                debugLog('جاري البحث عن العمليات');
                return firebase.database().ref(`users/${currentUser.uid}/transactions`).once('value');
            })
            .then((snapshot) => {
                const transactionsData = snapshot.val();
                debugLog('بيانات العمليات:', transactionsData);
                
                if (transactionsData) {
                    transactions = Object.values(transactionsData);
                    // ترتيب العمليات من الأحدث إلى الأقدم
                    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
                    debugLog('عدد العمليات:', transactions.length);
                } else {
                    transactions = [];
                    debugLog('لا توجد عمليات');
                }
                
                // تحديث وقت المزامنة الأخير
                syncStatus.lastSync = new Date();
                syncStatus.isSyncing = false;
                
                resolve(investorData);
            })
            .catch((error) => {
                debugLog('خطأ في جلب البيانات:', error);
                console.error("خطأ في جلب بيانات المستثمر:", error);
                syncStatus.isSyncing = false;
                reject(error);
            });
    });
}
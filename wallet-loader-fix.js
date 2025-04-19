/**
 * wallet-loader-fix.js
 * إصلاح مشكلة المؤشر الدوار في تطبيق محفظتي الاستثمارية
 */

// الأسباب المحتملة للمشكلة:
// 1. عدم إغلاق شاشة التحميل بعد استعادة البيانات
// 2. خطأ في الوعود (Promises) يمنع تنفيذ دالة hideLoaderOverlay
// 3. مشكلة في تهيئة Firebase أو تفاعل المستخدم مع قاعدة البيانات
// 4. تكرار استدعاء شاشة التحميل دون إغلاقها

// الحل: إضافة آلية أكثر موثوقية للتعامل مع شاشة التحميل وإصلاح الوعود

// 1. إصلاح دالة hideLoaderOverlay للتأكد من إغلاق شاشة التحميل
function hideLoaderOverlay() {
    const loader = document.getElementById('app-loader');
    
    if (loader) {
        // إعداد مؤقت احتياطي للإغلاق القسري بعد ثانيتين في حالة فشل الإغلاق العادي
        const forceHideTimeout = setTimeout(() => {
            loader.style.display = 'none';
            console.log('تم إغلاق شاشة التحميل قسريًا');
        }, 2000);
        
        loader.style.opacity = '0';
        
        // محاولة الإغلاق العادي
        setTimeout(() => {
            loader.style.display = 'none';
            clearTimeout(forceHideTimeout); // إلغاء المؤقت الاحتياطي إذا نجح الإغلاق العادي
            console.log('تم إغلاق شاشة التحميل بنجاح');
        }, 300);
    }
}

// 2. إضافة وظيفة التعافي التلقائي من عمليات التحميل العالقة
function setupAutoHideLoader() {
    // إضافة مؤقت احتياطي لإغلاق شاشة التحميل بعد 10 ثوانٍ كحد أقصى
    const maxLoadingTime = 10000; // 10 ثوانٍ
    
    setTimeout(() => {
        const loader = document.getElementById('app-loader');
        if (loader && getComputedStyle(loader).display !== 'none' && parseFloat(getComputedStyle(loader).opacity) > 0) {
            console.warn('تم اكتشاف شاشة تحميل عالقة، جاري الإغلاق التلقائي');
            hideLoaderOverlay();
            
            // إعادة تهيئة واجهة المستخدم
            try {
                if (currentUser) {
                    showMainAppUI();
                } else {
                    showLoginScreen();
                }
            } catch (error) {
                console.error('خطأ في إعادة تهيئة واجهة المستخدم:', error);
                // إظهار نافذة تسجيل الدخول كإجراء أخير للتعافي
                document.getElementById('login-screen').classList.remove('hidden');
                document.getElementById('app-container').classList.add('hidden');
            }
        }
    }, maxLoadingTime);
}

// 3. تحسين عملية تسجيل الدخول وتحميل البيانات
function enhancedLoginProcess(email, password) {
    // عرض حالة التحميل
    showLoaderOverlay('جاري تسجيل الدخول...');
    
    // تشغيل آلية التعافي التلقائي
    setupAutoHideLoader();
    
    return firebase.auth().signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // تسجيل الدخول بنجاح
            currentUser = userCredential.user;
            console.log('تم تسجيل الدخول بنجاح:', currentUser.email);
            
            // جلب بيانات المستثمر
            return fetchInvestorData()
                .then((data) => {
                    console.log('تم جلب بيانات المستثمر بنجاح');
                    return data;
                })
                .catch((error) => {
                    console.error('خطأ في جلب بيانات المستثمر:', error);
                    // إظهار إشعار الخطأ ولكن استمرار العملية
                    showToast('تنبيه', 'تم تسجيل الدخول ولكن حدث خطأ في جلب بيانات المستثمر', 'warning');
                    return null;
                })
                .finally(() => {
                    // إغلاق شاشة التحميل بغض النظر عن نتيجة جلب البيانات
                    hideLoaderOverlay();
                    showMainAppUI();
                });
        })
        .catch((error) => {
            console.error("خطأ في تسجيل الدخول:", error);
            hideLoaderOverlay();
            
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
            throw error;
        });
}

// 4. تحسين دالة جلب بيانات المستثمر لمعالجة الحالات الشاذة
function enhancedFetchInvestorData() {
    return new Promise((resolve, reject) => {
        if (!currentUser) {
            reject(new Error('المستخدم غير مسجل الدخول'));
            return;
        }
        
        console.log('جاري جلب بيانات المستثمر...');
        
        // إضافة مؤقت لتجنب الانتظار غير المحدود
        const timeout = setTimeout(() => {
            reject(new Error('انتهت مهلة جلب بيانات المستثمر'));
        }, 15000); // 15 ثانية كحد أقصى
        
        // جلب معرف المستثمر المرتبط بالمستخدم
        firebase.database().ref(`users/${currentUser.uid}`).once('value')
            .then((snapshot) => {
                const userData = snapshot.val();
                
                if (!userData || !userData.investorId) {
                    clearTimeout(timeout);
                    reject(new Error('لم يتم ربط المستخدم بمستثمر'));
                    return;
                }
                
                const investorId = userData.investorId;
                console.log('تم العثور على معرف المستثمر:', investorId);
                
                // جلب بيانات المستثمر من النظام الرئيسي
                return firebase.database().ref(`investors/${investorId}`).once('value');
            })
            .then((snapshot) => {
                const data = snapshot.val();
                
                if (!data) {
                    clearTimeout(timeout);
                    reject(new Error('لم يتم العثور على بيانات المستثمر'));
                    return;
                }
                
                investorData = data;
                console.log('تم جلب بيانات المستثمر بنجاح');
                
                // جلب العمليات المرتبطة بالمستثمر (محاولة وليست إلزامية للنجاح)
                return firebase.database().ref(`transactions`).orderByChild('investorId').equalTo(investorData.id).once('value')
                    .catch(err => {
                        console.warn('تحذير: فشل في جلب العمليات:', err);
                        return { val: () => null }; // إرجاع كائن وهمي مع دالة val تعيد null
                    });
            })
            .then((snapshot) => {
                clearTimeout(timeout);
                
                const transactionsData = snapshot.val();
                
                if (transactionsData) {
                    transactions = Object.values(transactionsData);
                    // ترتيب العمليات من الأحدث إلى الأقدم
                    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
                    console.log(`تم جلب ${transactions.length} عملية`);
                } else {
                    transactions = [];
                    console.log('لم يتم العثور على عمليات');
                }
                
                // تحديث وقت المزامنة الأخير
                syncStatus = syncStatus || {};
                syncStatus.lastSync = new Date();
                syncStatus.isSyncing = false;
                
                resolve(investorData);
            })
            .catch((error) => {
                clearTimeout(timeout);
                console.error("خطأ في جلب بيانات المستثمر:", error);
                
                // تحديث حالة المزامنة
                syncStatus = syncStatus || {};
                syncStatus.isSyncing = false;
                syncStatus.lastError = error.message;
                
                reject(error);
            });
    });
}

// 5. تحسين تعامل شاشة تسجيل الدخول
function setupEnhancedAuthentication() {
    // نماذج المصادقة
    const loginForm = document.getElementById('login-form');
    
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
            
            // استخدام عملية تسجيل الدخول المحسنة
            enhancedLoginProcess(email, password)
                .catch(error => {
                    console.error('فشلت عملية تسجيل الدخول المحسنة:', error);
                });
        });
    } else {
        console.warn('لم يتم العثور على نموذج تسجيل الدخول');
    }
}

// 6. تحسين عملية عرض واجهة التطبيق الرئيسية
function enhancedShowMainAppUI() {
    try {
        // إخفاء شاشة تسجيل الدخول وإظهار التطبيق الرئيسي
        const loginScreen = document.getElementById('login-screen');
        const appContainer = document.getElementById('app-container');
        
        if (loginScreen) loginScreen.classList.add('hidden');
        if (appContainer) appContainer.classList.remove('hidden');
        
        // تحديث معلومات المستخدم في الواجهة
        updateUserProfile();
        
        // تهيئة الرسوم البيانية
        setTimeout(() => {
            try {
                initCharts();
                console.log('تم تهيئة الرسوم البيانية بنجاح');
            } catch (error) {
                console.error('خطأ في تهيئة الرسوم البيانية:', error);
            }
        }, 500);
        
        // تحديث لوحة التحكم
        setTimeout(() => {
            try {
                updateDashboard();
                console.log('تم تحديث لوحة التحكم بنجاح');
            } catch (error) {
                console.error('خطأ في تحديث لوحة التحكم:', error);
            }
        }, 1000);
        
        console.log('تم عرض واجهة التطبيق الرئيسية بنجاح');
    } catch (error) {
        console.error('خطأ في عرض واجهة التطبيق الرئيسية:', error);
        // محاولة إغلاق شاشة التحميل في حالة حدوث خطأ
        hideLoaderOverlay();
    }
}

// 7. تصحيح مستمع حدث تحميل الصفحة لتنفيذ الإصلاح عند بدء التطبيق
document.addEventListener('DOMContentLoaded', function() {
    console.log('تهيئة الإصلاحات للتطبيق...');
    
    // تطبيق الإصلاحات على الدوال الأصلية
    window.hideLoaderOverlay = hideLoaderOverlay;
    window.loginWithEmailPassword = enhancedLoginProcess;
    window.fetchInvestorData = enhancedFetchInvestorData;
    window.showMainAppUI = enhancedShowMainAppUI;
    
    // إعداد مستمعي الأحداث المحسنة
    setupEnhancedAuthentication();
    
    // إضافة آلية التعافي التلقائي من شاشة التحميل العالقة
    setupAutoHideLoader();
    
    // معالجة الحالة إذا كانت شاشة التحميل معروضة عند تحميل الصفحة
    const loader = document.getElementById('app-loader');
    if (loader && getComputedStyle(loader).display !== 'none' && parseFloat(getComputedStyle(loader).opacity) > 0) {
        console.log('تم اكتشاف شاشة تحميل نشطة، جاري التحقق...');
        
        // التحقق من حالة المستخدم الحالي
        setTimeout(() => {
            firebase.auth().onAuthStateChanged(function(user) {
                if (user) {
                    console.log('المستخدم مسجل الدخول، جاري إغلاق شاشة التحميل وعرض التطبيق');
                    currentUser = user;
                    hideLoaderOverlay();
                    showMainAppUI();
                } else {
                    console.log('المستخدم غير مسجل الدخول، جاري إغلاق شاشة التحميل وعرض شاشة تسجيل الدخول');
                    hideLoaderOverlay();
                    showLoginScreen();
                }
            });
        }, 1000);
    }
    
    console.log('تم تطبيق الإصلاحات بنجاح');
});

/**
 * تعديل: أضف هذا الكود في نهاية ملف wallet-app.js الأصلي أو قم بتضمينه كملف جديد
 * واستدعائه بعد wallet-app.js في ملف HTML
 */
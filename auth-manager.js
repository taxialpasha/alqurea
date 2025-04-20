// Authentication Manager
const AuthManager = {
    // تسجيل مستخدم جديد
    async registerUser(name, email, password) {
        try {
            showSpinner();
            
            // إنشاء المستخدم في Firebase Authentication
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // إضافة اسم المستخدم في ملف التعريف
            await user.updateProfile({
                displayName: name
            });
            
            // تخزين بيانات المستخدم في قاعدة البيانات
            await firebase.database().ref(`appUsers/${user.uid}`).set({
                name: name,
                email: email,
                createdAt: new Date().toISOString()
            });
            
            currentUser = {
                uid: user.uid,
                email: user.email,
                name: name
            };
            
            hideSpinner();
            return true;
        } catch (error) {
            hideSpinner();
            console.error("Error registering user:", error);
            
            let errorMessage = 'حدث خطأ أثناء إنشاء الحساب';
            
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'البريد الإلكتروني مستخدم بالفعل';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'البريد الإلكتروني غير صالح';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = 'كلمة المرور ضعيفة جداً';
            }
            
            throw new Error(errorMessage);
        }
    },
    
    // تسجيل الدخول
    async loginUser(email, password) {
        try {
            showSpinner();
            
            const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // جلب بيانات المستخدم من قاعدة البيانات (إن وجدت)
            const userDataSnapshot = await firebase.database().ref(`appUsers/${user.uid}`).once('value');
            const userData = userDataSnapshot.val() || {};
            
            currentUser = {
                uid: user.uid,
                email: user.email,
                name: userData.name || user.displayName || 'مستخدم'
            };
            
            // حفظ حالة تسجيل الدخول
            localStorage.setItem('userEmail', email);
            
            hideSpinner();
            return true;
        } catch (error) {
            hideSpinner();
            console.error("Error logging in:", error);
            
            let errorMessage = 'حدث خطأ أثناء تسجيل الدخول';
            
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                errorMessage = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'البريد الإلكتروني غير صالح';
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = 'تم تقييد الحساب بسبب كثرة المحاولات الفاشلة. حاول مرة أخرى لاحقاً';
            }
            
            throw new Error(errorMessage);
        }
    },
                 
    // تسجيل الخروج
    async logout() {
        try {
            await firebase.auth().signOut();
            currentUser = null;
            currentInvestor = null;
            localStorage.removeItem('userEmail');
            localStorage.removeItem('investorData');
            return true;
        } catch (error) {
            console.error("Error logging out:", error);
            throw new Error('حدث خطأ أثناء تسجيل الخروج');
        }
    },
    
    // التحقق من حالة المصادقة
    getCurrentUser() {
        return firebase.auth().currentUser;
    }
};
// Investor Data Manager
const InvestorDataManager = {
    currentInvestor: null,
    dbRef: firebase.database(),
    
    async verifyInvestor(investorId, phoneNumber) {
        try {
            showSpinner();
            
            // تنظيف رقم الهاتف
            const cleanPhone = phoneNumber.replace(/\s/g, '');
            
            // البحث عن بيانات المستثمر في جميع المستخدمين
            const usersSnapshot = await this.dbRef.ref('users').once('value');
            const users = usersSnapshot.val();
            
            let investorData = null;
            let foundUserId = null;
            let foundInvestorIndex = null;
            let settings = {
                interestRate: 17.5,
                currency: 'دينار'
            };
            
            // البحث في كل مستخدم في النظام
            for (const userId in users) {
                if (users[userId].investors && users[userId].investors.data) {
                    // البحث في مصفوفة المستثمرين
                    const investorsData = users[userId].investors.data;
                    for (let i = 0; i < investorsData.length; i++) {
                        const investor = investorsData[i];
                        // البحث باستخدام رقم الهاتف والمعرف
                        const investorCleanPhone = investor.phone ? investor.phone.replace(/\s/g, '') : '';
                        
                        if (investorCleanPhone === cleanPhone && investor.id === investorId) {
                            investorData = investor;
                            foundUserId = userId;
                            foundInvestorIndex = i;
                            
                            // جلب الإعدادات من نفس المستخدم
                            if (users[userId].settings && users[userId].settings.data) {
                                settings = users[userId].settings.data;
                            }
                            break;
                        }
                    }
                }
                if (investorData) break;
            }
            
            if (!investorData) {
                throw new Error('لم يتم العثور على المستثمر بهذا المعرف أو رقم الهاتف');
            }
            
            // جلب جميع العمليات المرتبطة بالمستثمر
            let investorTransactions = [];
            if (users[foundUserId].transactions && users[foundUserId].transactions.data) {
                investorTransactions = users[foundUserId].transactions.data.filter(t => t.investorId === investorData.id);
            }
            
            // تحويل البيانات للشكل المطلوب
            this.currentInvestor = {
                id: investorData.id,
                name: investorData.name,
                phone: investorData.phone,
                joinDate: investorData.joinDate || investorData.createdAt,
                balance: investorData.amount || 0,
                profits: this.calculatePendingProfits(investorData),
                interestRate: settings.interestRate,
                dueDate: this.calculateDueDate(investorData),
                address: investorData.address,
                cardNumber: investorData.cardNumber,
                email: currentUser.email // إضافة بريد المستخدم المسجل دخوله
            };
            
            // تخزين بيانات المستثمر في التخزين المحلي
            localStorage.setItem('investorData', JSON.stringify({
                id: investorData.id,
                phone: cleanPhone
            }));
            
            // تخزين مسار البيانات للتحديثات في الوقت الحقيقي
            this.userPath = `users/${foundUserId}`;
            this.investorPath = `${this.userPath}/investors/data/${foundInvestorIndex}`;
            
            // تحويل العمليات للشكل المطلوب
            window.transactions = investorTransactions.map(t => ({
                id: t.id,
                type: this.getTransactionType(t.type),
                typeAr: t.type,
                amount: t.amount,
                date: t.date,
                description: t.notes || '',
                balanceAfter: t.balanceAfter
            }));
            
            // تحديث الإعدادات العامة
            window.settings = settings;
            
            // إعداد المستمعين للتحديثات في الوقت الحقيقي
            this.setupRealtimeListeners(investorData.id);
            
            hideSpinner();
            currentInvestor = this.currentInvestor;
            return currentInvestor;
        } catch (error) {
            hideSpinner();
            console.error("Error verifying investor:", error);
            throw error;
        }
    },
    
    setupRealtimeListeners(investorId) {
        // مستمع لتحديثات بيانات المستثمر
        if (this.investorPath) {
            this.dbRef.ref(this.investorPath).on('value', snapshot => {
                const data = snapshot.val();
                if (data) {
                    this.currentInvestor = {
                        ...this.currentInvestor,
                        name: data.name,
                        phone: data.phone,
                        balance: data.amount || 0,
                        profits: this.calculatePendingProfits(data),
                        address: data.address,
                        cardNumber: data.cardNumber
                    };
                    currentInvestor = this.currentInvestor;
                    updateUI();
                }
            });
        }
        
        // مستمع لتحديثات العمليات
        if (this.userPath) {
            this.dbRef.ref(`${this.userPath}/transactions/data`).on('value', snapshot => {
                const allTransactions = snapshot.val() || [];
                const investorTransactions = allTransactions.filter(t => t.investorId === investorId);
                
                window.transactions = investorTransactions.map(t => ({
                    id: t.id,
                    type: this.getTransactionType(t.type),
                    typeAr: t.type,
                    amount: t.amount,
                    date: t.date,
                    description: t.notes || '',
                    balanceAfter: t.balanceAfter
                }));
                
                renderRecentTransactions();
                if (document.getElementById('transactions-page').classList.contains('active')) {
                    renderAllTransactions();
                }
                if (document.getElementById('profits-page').classList.contains('active')) {
                    renderProfitsDetails();
                }
                // تحديث الرسوم البيانية
                updateCharts();
            });
        }
        
        // مستمع لتحديثات الإعدادات
        if (this.userPath) {
            this.dbRef.ref(`${this.userPath}/settings/data`).on('value', snapshot => {
                const settingsData = snapshot.val();
                if (settingsData) {
                    window.settings = settingsData;
                    // تحديث نسبة الفائدة في واجهة المستخدم
                    this.currentInvestor.interestRate = settingsData.interestRate;
                    currentInvestor = this.currentInvestor;
                    updateUI();
                }
            });
        }
    },
    
    calculatePendingProfits(investor) {
        // التحقق من وجود الاستثمارات
        if (!investor || !investor.investments || investor.investments.length === 0) return 0;
        
        // استخدام قيمة افتراضية لنسبة الفائدة إذا لم تكن موجودة في الإعدادات
        const interestRate = (window.settings && window.settings.interestRate) 
            ? (window.settings.interestRate / 100) 
            : 0.175; // قيمة افتراضية 17.5%
        
        const today = new Date();
        let totalProfit = 0;
        
        // حساب الأرباح من الاستثمارات النشطة
        investor.investments.forEach(inv => {
            // التحقق من وجود المبلغ وأنه أكبر من الصفر
            if (inv && inv.amount > 0 && inv.date) {
                try {
                    const start = new Date(inv.date);
                    const days = Math.floor((today - start) / (1000 * 60 * 60 * 24));
                    const profit = (inv.amount * interestRate * days) / 365;
                    totalProfit += profit;
                } catch (error) {
                    console.error("خطأ في حساب الأرباح:", error);
                    // تجاهل هذا الاستثمار إذا حدث خطأ
                }
            }
        });
        
        // خصم الأرباح المدفوعة سابقاً إذا وجدت
        if (investor.profits && investor.profits.length > 0) {
            const totalPaidProfits = investor.profits.reduce((sum, profit) => {
                return sum + (profit.amount || 0);
            }, 0);
            totalProfit -= totalPaidProfits;
        }
        
        return Math.max(0, totalProfit); // لا نريد أرباح سالبة
    },
    
    calculateDueDate(investor) {
        if (!investor.investments || investor.investments.length === 0) return '--';
        
        // إذا كان هناك أرباح مدفوعة سابقاً، نحسب من تاريخ آخر دفعة
        if (investor.profits && investor.profits.length > 0) {
            const lastProfitDate = new Date(investor.profits[investor.profits.length - 1].date);
            const nextDue = new Date(lastProfitDate);
            nextDue.setMonth(nextDue.getMonth() + 1);
            return formatDate(nextDue.toISOString().split('T')[0]);
        }
        
        // إذا لم يكن هناك أرباح مدفوعة، نحسب من تاريخ أول استثمار
        const firstInvestmentDate = new Date(investor.investments[0].date);
        const nextDue = new Date(firstInvestmentDate);
        nextDue.setMonth(nextDue.getMonth() + 1);
        
        return formatDate(nextDue.toISOString().split('T')[0]);
    },
    
    getTransactionType(type) {
        switch (type.toLowerCase()) {
            case 'إيداع':
                return 'deposit';
            case 'سحب':
                return 'withdrawal';
            case 'دفع أرباح':
                return 'profit';
            default:
                return 'unknown';
        }
    },
    
    clearListeners() {
        if (this.currentInvestor && this.investorPath) {
            this.dbRef.ref(this.investorPath).off();
            this.dbRef.ref(`${this.userPath}/transactions/data`).off();
            this.dbRef.ref(`${this.userPath}/settings/data`).off();
        }
        
        this.currentInvestor = null;
        this.userPath = null;
        this.investorPath = null;
        window.transactions = [];
    }
};
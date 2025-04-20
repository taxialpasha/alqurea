// Charts Module
let charts = {};

function initializeCharts() {
    // تهيئة الرسم البياني للاستثمار
    initializeInvestmentChart();
    
    // تهيئة الرسم البياني للأرباح
    initializeProfitsChart();
}

function initializeInvestmentChart() {
    const ctx = document.getElementById('investment-chart').getContext('2d');
    
    // تحويل البيانات إلى تنسيق مناسب للرسم البياني
    const chartData = prepareInvestmentChartData();
    
    // إنشاء الرسم البياني
    charts.investmentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'الرصيد',
                data: chartData.balances,
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderColor: 'rgba(99, 102, 241, 1)',
                borderWidth: 2,
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
                    rtl: true,
                    titleAlign: 'right',
                    bodyAlign: 'right',
                    callbacks: {
                        label: function(context) {
                            return `الرصيد: ${formatCurrency(context.raw)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            }
        }
    });
}

function initializeProfitsChart() {
    const ctx = document.getElementById('profits-chart').getContext('2d');
    
    // تحويل البيانات إلى تنسيق مناسب للرسم البياني
    const profitData = prepareProfitsChartData();
    
    // إنشاء الرسم البياني
    charts.profitsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: profitData.labels,
            datasets: [{
                label: 'الأرباح المستلمة',
                data: profitData.actual,
                backgroundColor: 'rgba(16, 185, 129, 0.7)',
                borderColor: 'rgba(16, 185, 129, 1)',
                borderWidth: 1
            },
            {
                label: 'الأرباح المتوقعة',
                data: profitData.expected,
                backgroundColor: 'rgba(245, 158, 11, 0.5)',
                borderColor: 'rgba(245, 158, 11, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    rtl: true,
                    labels: {
                        boxWidth: 15,
                        padding: 15
                    }
                },
                tooltip: {
                    rtl: true,
                    titleAlign: 'right',
                    bodyAlign: 'right',
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatCurrency(context.raw)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            }
        }
    });
}

function prepareInvestmentChartData() {
    // ترتيب العمليات حسب التاريخ
    const sortedTransactions = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // تحضير البيانات للرسم البياني
    const labels = [];
    const balances = [];
    
    // بدء من تاريخ الانضمام إذا كان متاحًا
    let startDate = currentInvestor && currentInvestor.joinDate ? new Date(currentInvestor.joinDate) : null;
    
    // إذا لم يكن تاريخ الانضمام متاحًا، استخدم تاريخ أول عملية
    if (!startDate && sortedTransactions.length > 0) {
        startDate = new Date(sortedTransactions[0].date);
    }
    
    // إذا لم توجد أي بيانات، استخدم بيانات افتراضية
    if (!startDate) {
        return {
            labels: ['اليوم'],
            balances: [currentInvestor ? currentInvestor.balance : 0]
        };
    }
    
    // حساب الرصيد التراكمي
    let runningBalance = 0;
    
    for (const transaction of sortedTransactions) {
        const transDate = new Date(transaction.date);
        const formattedDate = formatDate(transaction.date);
        
        if (transaction.type === 'deposit') {
            runningBalance += transaction.amount;
        } else if (transaction.type === 'withdrawal') {
            runningBalance -= transaction.amount;
        }
        
        labels.push(formattedDate);
        balances.push(runningBalance);
    }
    
    // إضافة القيمة الحالية إذا كانت مختلفة عن آخر قيمة
    if (currentInvestor && (balances.length === 0 || balances[balances.length - 1] !== currentInvestor.balance)) {
        labels.push('الحالي');
        balances.push(currentInvestor.balance);
    }
    
    return { labels, balances };
}

function prepareProfitsChartData() {
    // الحصول على العمليات المتعلقة بالأرباح
    const profitTransactions = transactions.filter(t => t.type === 'profit');
    
    // إذا لم توجد عمليات ربح، استخدم بيانات افتراضية
    if (profitTransactions.length === 0) {
        // حساب الربح الشهري المتوقع
        const monthlyProfit = currentInvestor ? (currentInvestor.balance * (currentInvestor.interestRate / 100)) / 12 : 0;
        
        // إنشاء بيانات لآخر 3 أشهر
        const labels = [];
        const expected = [];
        const actual = [];
        
        const today = new Date();
        
        for (let i = 2; i >= 0; i--) {
            const month = new Date(today.getFullYear(), today.getMonth() - i, 1);
            labels.push(month.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' }));
            expected.push(monthlyProfit);
            actual.push(0);
        }
        
        return { labels, expected, actual };
    }
    
    // تجميع عمليات الربح حسب الشهر
    const profitsByMonth = {};
    
    for (const transaction of profitTransactions) {
        const date = new Date(transaction.date);
        const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
        
        if (!profitsByMonth[monthKey]) {
            profitsByMonth[monthKey] = {
                label: date.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' }),
                amount: 0,
                date: date
            };
        }
        
        profitsByMonth[monthKey].amount += transaction.amount;
    }
    
    // ترتيب الأشهر تصاعديًا
    const sortedMonths = Object.values(profitsByMonth).sort((a, b) => a.date - b.date);
    
    // حساب الربح الشهري المتوقع
    const monthlyProfit = currentInvestor ? (currentInvestor.balance * (currentInvestor.interestRate / 100)) / 12 : 0;
    
    // إعداد البيانات للرسم البياني
    const labels = sortedMonths.map(month => month.label);
    const actual = sortedMonths.map(month => month.amount);
    const expected = sortedMonths.map(() => monthlyProfit);
    
    return { labels, expected, actual };
}

function updateCharts() {
    // تحديث بيانات الرسوم البيانية إذا كانت متاحة
    if (charts.investmentChart) {
        const investmentData = prepareInvestmentChartData();
        charts.investmentChart.data.labels = investmentData.labels;
        charts.investmentChart.data.datasets[0].data = investmentData.balances;
        charts.investmentChart.update();
    }
    
    if (charts.profitsChart) {
        const profitsData = prepareProfitsChartData();
        charts.profitsChart.data.labels = profitsData.labels;
        charts.profitsChart.data.datasets[0].data = profitsData.actual;
        charts.profitsChart.data.datasets[1].data = profitsData.expected;
        charts.profitsChart.update();
    }
}
// ========== ИНИЦИАЛИЗАЦИЯ ==========
let tg = null;
let currentUser = null;

// Безопасная инициализация Telegram WebApp
try {
    if (window.Telegram && window.Telegram.WebApp) {
        tg = window.Telegram.WebApp;
        if (tg && typeof tg.expand === 'function') tg.expand();
        if (tg && typeof tg.ready === 'function') tg.ready();
    }
} catch(e) {
    console.log('Telegram init error:', e);
}

// Фолбэк для работы вне Telegram или при ошибках
if (!tg) {
    tg = {
        initDataUnsafe: { user: null },
        showPopup: (options) => alert(options.message || options.title),
        sendData: () => {},
        MainButton: { hide: () => {}, show: () => {} },
        BackButton: { hide: () => {}, show: () => {} },
        onEvent: () => {},
        expand: () => {},
        ready: () => {}
    };
}

// Безопасное получение пользователя
try {
    currentUser = (tg.initDataUnsafe && tg.initDataUnsafe.user) ? tg.initDataUnsafe.user : {
        id: Date.now(),
        username: 'user_' + Math.floor(Math.random() * 10000),
        first_name: 'Пользователь'
    };
} catch(e) {
    currentUser = {
        id: Date.now(),
        username: 'user_' + Math.floor(Math.random() * 10000),
        first_name: 'Пользователь'
    };
}

// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
let wallets = {};
let deals = [];
let currentDeal = null;
let dealProgress = 0;
let selectedCurrency = 'USDT';
let pendingCryptoType = null;
let currentScreen = null;

const currencySymbols = { 'TON': 'TON', 'USDT': 'USDT', 'RUB': '₽', 'STARS': '★', 'UAH': '₴', 'EUR': '€' };

// ========== БЕЗОПАСНОЕ ХРАНЕНИЕ ==========
try {
    const savedWallets = localStorage.getItem('trustzipper_wallets');
    if (savedWallets) wallets = JSON.parse(savedWallets);
} catch(e) { wallets = {}; }

try {
    const savedDeals = localStorage.getItem('trustzipper_deals');
    if (savedDeals) deals = JSON.parse(savedDeals);
} catch(e) { deals = []; }

function saveWallets() {
    try {
        localStorage.setItem('trustzipper_wallets', JSON.stringify(wallets));
    } catch(e) {}
}

function saveDeals() {
    try {
        localStorage.setItem('trustzipper_deals', JSON.stringify(deals));
    } catch(e) {}
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function generateDealId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '#';
    for (let i = 0; i < 12; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function formatAmount(amount, currency) {
    const symbol = currencySymbols[currency] || currency;
    const formatted = parseFloat(amount).toFixed(2).replace(/\.00$/, '');
    return `${formatted} ${symbol}`;
}

function calculateAmountWithFee(amount, feePayer) {
    return feePayer === 'buyer' ? amount * 1.02 : amount;
}

function getFormattedDate() {
    const now = new Date();
    const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    return `${now.getDate()} ${months[now.getMonth()]} · ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

function showMessage(title, message) {
    try {
        if (tg && typeof tg.showPopup === 'function') {
            tg.showPopup({ title: title, message: message, buttons: [{ type: 'ok' }] });
        } else {
            alert(title + ': ' + message);
        }
    } catch(e) {
        alert(title + ': ' + message);
    }
}

// ========== ОТОБРАЖЕНИЕ КОШЕЛЬКОВ ==========
function renderWalletsList() {
    const container = document.getElementById('walletsList');
    if (!container) return;
    
    if (Object.keys(wallets).length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #8a8f9e;">У вас пока нет добавленных кошельков</div>';
        return;
    }
    
    let html = '';
    for (const [type, data] of Object.entries(wallets)) {
        let typeName = '', icon = '';
        switch(type) {
            case 'card': typeName = '💳 Банковская карта'; icon = '💳'; break;
            case 'btc': typeName = '₿ Bitcoin'; icon = '₿'; break;
            case 'eth': typeName = 'Ξ Ethereum'; icon = 'Ξ'; break;
            case 'ton': typeName = '👛 TON кошелёк'; icon = '👛'; break;
            case 'usdt': typeName = '$ USDT'; icon = '$'; break;
            default: typeName = type; icon = '📦';
        }
        html += `<div class="wallet-item">
                    <div class="wallet-type">${icon} ${typeName}</div>
                    <div class="wallet-address">${escapeHtml(data.address)}</div>
                    <span class="delete-wallet" data-wallet-type="${type}">🗑 Удалить</span>
                </div>`;
    }
    container.innerHTML = html;
    
    document.querySelectorAll('.delete-wallet').forEach(el => {
        el.addEventListener('click', (e) => {
            const walletType = e.target.getAttribute('data-wallet-type');
            delete wallets[walletType];
            saveWallets();
            renderWalletsList();
            showMessage('Удалено', 'Кошелек удален');
        });
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ========== ОТОБРАЖЕНИЕ ИСТОРИИ СДЕЛОК ==========
function renderHistoryList() {
    const container = document.getElementById('historyList');
    if (!container) return;
    
    const userDeals = deals.filter(d => d.sellerId === currentUser.id);
    if (userDeals.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #8a8f9e;">У вас пока нет сделок</div>';
        return;
    }
    
    let html = '';
    const reversedDeals = [...userDeals].reverse();
    for (const deal of reversedDeals) {
        let statusText = '', statusClass = '';
        switch(deal.status) {
            case 'completed': statusText = '✅ Завершена'; statusClass = 'status-completed'; break;
            case 'paid': statusText = '🟣 Оплата подтверждена'; statusClass = 'status-paid'; break;
            case 'waiting_buyer': statusText = '⏳ Ожидание покупателя'; statusClass = 'status-waiting'; break;
            default: statusText = '⏳ В процессе'; statusClass = 'status-waiting';
        }
        html += `<div class="deal-history-item">
                    <div class="flex-between mb-2">
                        <strong>${escapeHtml(deal.name)}</strong>
                        <span class="deal-status ${statusClass}">${statusText}</span>
                    </div>
                    <div class="flex-between mb-2">
                        <span>Сумма:</span>
                        <span>${deal.amount} ${deal.currency}</span>
                    </div>
                    <div class="flex-between">
                        <span>ID:</span>
                        <span style="font-family: monospace; font-size: 12px;">${deal.id}</span>
                    </div>
                    <div style="font-size: 11px; color: #8a8f9e; margin-top: 4px;">${deal.createdAt}</div>
                </div>`;
    }
    container.innerHTML = html;
}

// ========== ОБНОВЛЕНИЕ ПРОГРЕССА ==========
function updateProgressDisplay() {
    const waitingBuyerDiv = document.getElementById('waitingBuyer');
    const progressStepsDiv = document.getElementById('progressSteps');
    
    if (!waitingBuyerDiv || !progressStepsDiv) return;
    
    if (dealProgress === 0) {
        waitingBuyerDiv.classList.remove('hidden');
        progressStepsDiv.classList.add('hidden');
    } else {
        waitingBuyerDiv.classList.add('hidden');
        progressStepsDiv.classList.remove('hidden');
        
        const steps = [
            { icon: 'step2Icon', active: dealProgress >= 1, completed: dealProgress > 1 },
            { icon: 'step3Icon', active: dealProgress >= 2, completed: dealProgress > 2 },
            { icon: 'step4Icon', active: dealProgress >= 3, completed: dealProgress > 3 },
            { icon: 'step5Icon', active: dealProgress >= 4, completed: dealProgress > 4 }
        ];
        
        steps.forEach((step) => {
            const iconEl = document.getElementById(step.icon);
            if (iconEl) {
                if (step.completed) { 
                    iconEl.innerHTML = '✓'; 
                    iconEl.style.background = '#22c55e'; 
                } else if (step.active) { 
                    iconEl.innerHTML = '●'; 
                    iconEl.style.background = '#a855f7'; 
                } else { 
                    iconEl.innerHTML = '⏳'; 
                    iconEl.style.background = '#252a35'; 
                }
            }
        });
    }
}

// ========== ФУНКЦИЯ ПОКАЗА ЭКРАНОВ ==========
function showScreenById(screenId) {
    if (currentScreen === screenId) return;
    
    const allScreens = ['mainScreen', 'joinDealScreen', 'infoScreen', 'supportScreen', 
                       'referralScreen', 'walletScreen', 'addCardScreen', 'selectCryptoScreen', 
                       'addCryptoScreen', 'addTonScreen', 'listWalletsScreen', 'historyScreen', 
                       'createDealScreen', 'dealProgressScreen', 'dealCreatedScreen', 'successScreen'];
    
    allScreens.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    
    const target = document.getElementById(screenId);
    if (target) target.classList.remove('hidden');
    
    if (screenId === 'listWalletsScreen') renderWalletsList();
    if (screenId === 'historyScreen') renderHistoryList();
    if (screenId === 'referralScreen') updateReferralLink();
    
    currentScreen = screenId;
}

// ========== РЕФЕРАЛЬНАЯ ССЫЛКА ==========
function updateReferralLink() {
    const linkInput = document.getElementById('referralLinkInput');
    if (linkInput) {
        const refLink = `https://t.me/TrustZipperBot?start=ref_${currentUser.id}`;
        linkInput.value = refLink;
    }
}

function copyReferralLink() {
    const linkInput = document.getElementById('referralLinkInput');
    if (linkInput && linkInput.value) {
        navigator.clipboard.writeText(linkInput.value).catch(() => {});
        showMessage('Скопировано', 'Реферальная ссылка скопирована');
    }
}

// ========== ПРИСОЕДИНЕНИЕ К СДЕЛКЕ ==========
function joinDeal() {
    const input = document.getElementById('joinDealIdInput');
    if (!input) return;
    const dealId = input.value.trim();
    if (!dealId) {
        showMessage('Ошибка', 'Введите ID сделки');
        return;
    }
    
    const deal = deals.find(d => d.id === dealId);
    if (deal) {
        openDeal(deal);
    } else {
        showMessage('Поиск', 'Сделка не найдена. Проверьте ID');
    }
}

// ========== ОТКРЫТИЕ СДЕЛКИ ==========
function openDeal(deal) {
    currentDeal = deal;
    
    const dealNameEl = document.getElementById('dealNameValue');
    const dealAmountEl = document.getElementById('dealAmount');
    const sellerNameEl = document.getElementById('sellerName');
    const buyerNameEl = document.getElementById('buyerName');
    const createdDateEl = document.getElementById('createdDate');
    const dealIdEl = document.getElementById('dealIdValue');
    
    if (dealNameEl) dealNameEl.textContent = deal.name;
    if (dealAmountEl) dealAmountEl.textContent = formatAmount(deal.amount, deal.currency);
    if (sellerNameEl) sellerNameEl.textContent = deal.sellerUsername;
    if (buyerNameEl) buyerNameEl.textContent = currentUser.username ? `@${currentUser.username}` : `id${currentUser.id}`;
    if (createdDateEl) createdDateEl.textContent = deal.createdAt;
    if (dealIdEl) dealIdEl.textContent = deal.id;

    const dealCreatedAmount = document.getElementById('dealCreatedAmount');
    const dealCreatedId = document.getElementById('dealCreatedId');
    
    if (dealCreatedAmount) dealCreatedAmount.textContent = formatAmount(deal.amount, deal.currency);
    if (dealCreatedId) dealCreatedId.textContent = deal.id;

    dealProgress = 1;
    updateProgressDisplay();
    
    if (deal.sellerId === currentUser.id) {
        showScreenById('dealCreatedScreen');
    } else {
        showScreenById('dealProgressScreen');
    }
}

// ========== КОПИРОВАНИЕ ID И ССЫЛОК ==========
function copyDealId() {
    if (!currentDeal) {
        showMessage('Ошибка', 'Сначала создайте сделку');
        return;
    }
    navigator.clipboard.writeText(currentDeal.id).catch(() => {});
    showMessage('Скопировано', `ID сделки ${currentDeal.id} скопирован`);
}

function copyPaymentLink() {
    if (!currentDeal || !currentDeal.id) {
        showMessage('Ошибка', 'Сначала создайте сделку');
        return;
    }
    const link = `https://t.me/TrustZipperBot?start=pay_${currentDeal.id.replace('#', '')}`;
    navigator.clipboard.writeText(link).catch(() => {});
    showMessage('Скопировано', 'Ссылка для оплаты скопирована');
}

function inviteBuyer() {
    if (!currentDeal) {
        showMessage('Ошибка', 'Сначала создайте сделку');
        return;
    }
    const link = `https://t.me/TrustZipperBot?start=deal_${currentDeal.id.replace('#', '')}`;
    navigator.clipboard.writeText(link).catch(() => {});
    showMessage('Ссылка скопирована', `Ссылка для покупателя: ${link}`);
}

// ========== СОЗДАНИЕ СДЕЛКИ ==========
function createDeal() {
    const nameInput = document.getElementById('dealName');
    const amountInput = document.getElementById('amount');
    const additionalInfoInput = document.getElementById('additionalInfo');
    
    if (!nameInput || !amountInput) return;
    
    const name = nameInput.value.trim();
    let amount = parseFloat(amountInput.value);
    const feePayerElem = document.querySelector('input[name="feePayer"]:checked');
    const feePayer = feePayerElem ? feePayerElem.value : 'buyer';
    const additionalInfo = additionalInfoInput ? additionalInfoInput.value : '';

    if (!name) {
        showMessage('Ошибка', 'Введите название сделки');
        return;
    }
    if (!amount || amount < 0.1) {
        showMessage('Ошибка', 'Минимальная сумма: 0.1');
        return;
    }

    const finalAmount = calculateAmountWithFee(amount, feePayer);
    const sellerUsername = currentUser.username ? `@${currentUser.username}` : `user_${currentUser.id}`;

    currentDeal = {
        id: generateDealId(),
        name: name,
        originalAmount: amount,
        amount: finalAmount,
        currency: selectedCurrency,
        feePayer: feePayer,
        additionalInfo: additionalInfo,
        sellerId: currentUser.id,
        sellerUsername: sellerUsername,
        sellerName: currentUser.first_name || 'Продавец',
        createdAt: getFormattedDate(),
        status: 'waiting_buyer'
    };

    deals.push(currentDeal);
    saveDeals();
    renderHistoryList();

    const dealNameEl = document.getElementById('dealNameValue');
    const dealAmountEl = document.getElementById('dealAmount');
    const sellerNameEl = document.getElementById('sellerName');
    const createdDateEl = document.getElementById('createdDate');
    const dealIdEl = document.getElementById('dealIdValue');
    
    if (dealNameEl) dealNameEl.textContent = currentDeal.name;
    if (dealAmountEl) dealAmountEl.textContent = formatAmount(currentDeal.amount, currentDeal.currency);
    if (sellerNameEl) sellerNameEl.textContent = currentDeal.sellerUsername;
    if (createdDateEl) createdDateEl.textContent = currentDeal.createdAt;
    if (dealIdEl) dealIdEl.textContent = currentDeal.id;

    const dealCreatedAmount = document.getElementById('dealCreatedAmount');
    const dealCreatedId = document.getElementById('dealCreatedId');
    
    if (dealCreatedAmount) dealCreatedAmount.textContent = formatAmount(currentDeal.amount, currentDeal.currency);
    if (dealCreatedId) dealCreatedId.textContent = currentDeal.id;

    dealProgress = 0;
    updateProgressDisplay();
    
    showScreenById('dealCreatedScreen');
    
    // Очистка полей
    nameInput.value = '';
    amountInput.value = '';
    if (additionalInfoInput) additionalInfoInput.value = '';
}

// ========== ИНИЦИАЛИЗАЦИЯ ОБРАБОТЧИКОВ ==========
document.addEventListener('DOMContentLoaded', () => {
    // Основные кнопки
    const createDealBtn = document.getElementById('createDealBtn');
    if (createDealBtn) createDealBtn.onclick = () => showScreenById('createDealScreen');
    
    const joinDealBtn = document.getElementById('joinDealBtn');
    if (joinDealBtn) joinDealBtn.onclick = () => showScreenById('joinDealScreen');
    
    const submitJoinDealBtn = document.getElementById('submitJoinDealBtn');
    if (submitJoinDealBtn) submitJoinDealBtn.onclick = joinDeal;
    
    const copyDealIdBtn = document.getElementById('copyDealIdBtn');
    if (copyDealIdBtn) copyDealIdBtn.onclick = copyDealId;
    
    const copyPaymentLinkBtn = document.getElementById('copyPaymentLinkBtn');
    if (copyPaymentLinkBtn) copyPaymentLinkBtn.onclick = copyPaymentLink;
    
    const inviteBuyerBtn = document.getElementById('inviteBuyerBtn');
    if (inviteBuyerBtn) inviteBuyerBtn.onclick = inviteBuyer;
    
    const submitDealBtn = document.getElementById('submitDealBtn');
    if (submitDealBtn) submitDealBtn.onclick = createDeal;

    // Навигационные кнопки
    document.querySelectorAll('[data-action="info"]').forEach(el => {
        el.addEventListener('click', () => showScreenById('infoScreen'));
    });
    document.querySelectorAll('[data-action="support"]').forEach(el => {
        el.addEventListener('click', () => showScreenById('supportScreen'));
    });
    document.querySelectorAll('[data-action="referral"]').forEach(el => {
        el.addEventListener('click', () => showScreenById('referralScreen'));
    });
    document.querySelectorAll('[data-action="wallet"]').forEach(el => {
        el.addEventListener('click', () => showScreenById('walletScreen'));
    });
    document.querySelectorAll('[data-action="history"]').forEach(el => {
        el.addEventListener('click', () => showScreenById('historyScreen'));
    });

    // Кошельки
    document.querySelectorAll('[data-wallet-action="add_card"]').forEach(el => {
        el.addEventListener('click', () => showScreenById('addCardScreen'));
    });
    document.querySelectorAll('[data-wallet-action="add_crypto"]').forEach(el => {
        el.addEventListener('click', () => showScreenById('selectCryptoScreen'));
    });
    document.querySelectorAll('[data-wallet-action="add_ton"]').forEach(el => {
        el.addEventListener('click', () => showScreenById('addTonScreen'));
    });
    document.querySelectorAll('[data-wallet-action="list_wallets"]').forEach(el => {
        el.addEventListener('click', () => showScreenById('listWalletsScreen'));
    });

    // Кнопки возврата
    const backButtons = {
        'backToMainFromJoin': 'mainScreen',
        'backToMainFromInfo': 'mainScreen',
        'backToMainFromSupport': 'mainScreen',
        'backToMainFromCreate': 'mainScreen',
        'backToMainFromProgress': 'mainScreen',
        'backToMainFromSuccess': 'mainScreen',
        'backToMainFromDealCreated': 'mainScreen',
        'backToMainFromDealCreatedBtn': 'mainScreen',
        'cancelCreateBtn': 'mainScreen',
        'backToMainFromWallet': 'mainScreen',
        'backToMainFromHistory': 'mainScreen',
        'backToMainFromReferral': 'mainScreen',
        'backToWalletFromCard': 'walletScreen',
        'backToWalletFromCrypto': 'walletScreen',
        'backToWalletFromTon': 'walletScreen',
        'backToWalletFromList': 'walletScreen',
        'backToCryptoSelect': 'selectCryptoScreen'
    };
    
    for (const [id, screen] of Object.entries(backButtons)) {
        const el = document.getElementById(id);
        if (el) el.onclick = () => showScreenById(screen);
    }

    // Сохранение карты
    const saveCardBtn = document.getElementById('saveCardBtn');
    if (saveCardBtn) {
        saveCardBtn.addEventListener('click', () => {
            const cardNumber = document.getElementById('cardNumber').value.trim();
            if (!cardNumber) {
                showMessage('Ошибка', 'Введите номер карты');
                return;
            }
            wallets.card = { address: cardNumber };
            saveWallets();
            showMessage('Успех', 'Карта сохранена');
            showScreenById('walletScreen');
        });
    }
    
    // Выбор криптовалюты
    document.querySelectorAll('[data-crypto-type]').forEach(el => {
        el.addEventListener('click', () => {
            pendingCryptoType = el.getAttribute('data-crypto-type');
            const titles = { btc: 'Bitcoin', eth: 'Ethereum', usdt: 'USDT' };
            const prompts = { btc: 'Введите адрес BTC кошелька:', eth: 'Введите адрес ETH кошелька:', usdt: 'Введите адрес USDT кошелька:' };
            const titleEl = document.getElementById('cryptoScreenTitle');
            const promptEl = document.getElementById('cryptoPrompt');
            if (titleEl) titleEl.textContent = `Добавление ${titles[pendingCryptoType]}`;
            if (promptEl) promptEl.textContent = prompts[pendingCryptoType];
            showScreenById('addCryptoScreen');
        });
    });
    
    // Сохранение криптокошелька
    const saveCryptoBtn = document.getElementById('saveCryptoBtn');
    if (saveCryptoBtn) {
        saveCryptoBtn.addEventListener('click', () => {
            const address = document.getElementById('cryptoAddress').value.trim();
            if (!address) {
                showMessage('Ошибка', 'Введите адрес кошелька');
                return;
            }
            wallets[pendingCryptoType] = { address: address };
            saveWallets();
            showMessage('Успех', `${pendingCryptoType.toUpperCase()} кошелек сохранен`);
            showScreenById('walletScreen');
        });
    }
    
    // Сохранение TON кошелька
    const saveTonBtn = document.getElementById('saveTonBtn');
    if (saveTonBtn) {
        saveTonBtn.addEventListener('click', () => {
            const address = document.getElementById('tonAddress').value.trim();
            if (!address) {
                showMessage('Ошибка', 'Введите адрес TON кошелька');
                return;
            }
            wallets.ton = { address: address };
            saveWallets();
            showMessage('Успех', 'TON кошелек сохранен');
            showScreenById('walletScreen');
        });
    }
    
    // Копирование реферальной ссылки
    const copyReferralLinkBtn = document.getElementById('copyReferralLinkBtn');
    if (copyReferralLinkBtn) copyReferralLinkBtn.addEventListener('click', copyReferralLink);

    // Выбор валюты
    document.querySelectorAll('.currency-item').forEach(el => {
        el.addEventListener('click', () => {
            document.querySelectorAll('.currency-item').forEach(c => c.classList.remove('selected'));
            el.classList.add('selected');
            selectedCurrency = el.getAttribute('data-currency');
        });
    });
    
    const firstCurrency = document.querySelector('.currency-item');
    if (firstCurrency) firstCurrency.classList.add('selected');

    // Выбор радио кнопок
    document.querySelectorAll('.radio-option').forEach(option => {
        option.addEventListener('click', function() {
            const radio = this.querySelector('input[type="radio"]');
            if (radio && !radio.checked) {
                radio.checked = true;
                document.querySelectorAll('.radio-option').forEach(opt => opt.classList.remove('selected'));
                this.classList.add('selected');
            }
        });
    });

    // Скрываем кнопки Telegram если есть
    if (tg && tg.MainButton && tg.MainButton.hide) tg.MainButton.hide();
    if (tg && tg.BackButton && tg.BackButton.hide) tg.BackButton.hide();

    // Показываем главный экран
    showScreenById('mainScreen');
});

// Глобальная функция для тестирования (можно удалить)
window.advanceProgress = function() {
    if (dealProgress < 4 && currentDeal) {
        dealProgress++;
        updateProgressDisplay();
        if (dealProgress === 4 && currentDeal) {
            const index = deals.findIndex(d => d.id === currentDeal.id);
            if (index !== -1) deals[index].status = 'completed';
            saveDeals();
            renderHistoryList();
            setTimeout(() => showScreenById('successScreen'), 500);
        }
    }
};

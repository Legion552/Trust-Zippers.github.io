'backToMainFromDealPaid'; 'mainScreen'

// Кнопка "На главную" на экране оплаты продавца
let backToMainFromDealPaid = document.getElementById('backToMainFromDealPaid');
if (backToMainFromDealPaid) backToMainFromDealPaid.onclick = () => showScreenById('mainScreen');

// ======================================================
// ПРОСТАЯ И НАДЁЖНАЯ СИСТЕМА (ДАННЫЕ В ССЫЛКЕ)
// ======================================================

let tg = null;
let currentUser = null;
let dealProgress = 0;

// ======================================================
// ИНИЦИАЛИЗАЦИЯ
// ======================================================

try {
    if (window.Telegram && window.Telegram.WebApp) {
        tg = window.Telegram.WebApp;
        if (tg && typeof tg.expand === 'function') tg.expand();
        if (tg && typeof tg.ready === 'function') tg.ready();
    }
} catch(e) { console.log('Telegram init error:', e); }

if (!tg) {
    tg = {
        initDataUnsafe: { user: null, start_param: null },
        showPopup: (options) => alert(options.message || options.title),
        sendData: () => {},
        MainButton: { hide: () => {}, show: () => {} },
        BackButton: { hide: () => {}, show: () => {} },
        onEvent: () => {},
        offEvent: () => {},
        expand: () => {},
        ready: () => {}
    };
}

try {
    currentUser = (tg.initDataUnsafe && tg.initDataUnsafe.user) ? tg.initDataUnsafe.user : {
        id: Date.now(),
        username: 'user_' + Math.floor(Math.random() * 10000),
        first_name: 'Пользователь'
    };
} catch(e) {
    currentUser = { id: Date.now(), username: 'user_' + Math.floor(Math.random() * 10000), first_name: 'Пользователь' };
}

function getStartParam() {
    try { return tg.initDataUnsafe?.start_param || null; } catch(e) { return null; }
}

// ======================================================
// ОТПРАВКА ДАННЫХ В БОТ
// ======================================================

function sendToBot(action, data) {
    if (tg && tg.sendData) {
        try {
            const payload = { action, ...data };
            tg.sendData(JSON.stringify(payload));
            console.log('Отправлено в бот:', payload);
        } catch(e) {
            console.error('Ошибка отправки в бот:', e);
        }
    }
}

// ======================================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ======================================================

let wallets = {};
let deals = [];
let currentDeal = null;
let selectedCurrency = 'USDT';
let pendingCryptoType = null;
let currentScreen = null;
let isPaymentOptionsVisible = false;
let currentBuyerUsername = null;

const currencySymbols = { 'TON': 'TON', 'USDT': 'USDT', 'RUB': '₽', 'STARS': '★', 'UAH': '₴', 'EUR': '€' };
const BOT_USERNAME = 'TrustZippersBot';

// ======================================================
// ХРАНЕНИЕ
// ======================================================

try { const saved = localStorage.getItem('trustzipper_wallets'); if (saved) wallets = JSON.parse(saved); } catch(e) { wallets = {}; }
try { const saved = localStorage.getItem('trustzipper_deals'); if (saved) deals = JSON.parse(saved); } catch(e) { deals = []; }

function saveWallets() { try { localStorage.setItem('trustzipper_wallets', JSON.stringify(wallets)); } catch(e) {} }
function saveDeals() { try { localStorage.setItem('trustzipper_deals', JSON.stringify(deals)); } catch(e) {} }

function updateDealStatus(dealId, status) {
    const index = deals.findIndex(d => d.id === dealId);
    if (index !== -1) {
        deals[index].status = status;
        saveDeals();
        renderHistoryList();
    }
}

// ======================================================
// КОДИРОВАНИЕ ДАННЫХ В ССЫЛКУ (ГЛАВНОЕ!)
// ======================================================

function encodeDealData(deal) {
    const data = {
        id: deal.id,
        n: deal.name,
        a: deal.amount,
        c: deal.currency,
        su: deal.sellerUsername,
        si: deal.sellerId,
        b: currentBuyerUsername
    };
    return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
}

function decodeDealData(encoded) {
    try {
        const json = decodeURIComponent(escape(atob(encoded)));
        const data = JSON.parse(json);
        return {
            id: data.id,
            name: data.n,
            amount: data.a,
            currency: data.c,
            sellerUsername: data.su,
            sellerId: data.si,
            buyerUsername: data.b || 'Покупатель',
            createdAt: getFormattedDate(),
            status: 'waiting_buyer'
        };
    } catch(e) { return null; }
}

// ======================================================
// ВСПОМОГАТЕЛЬНЫЕ
// ======================================================

function generateDealId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '#';
    for (let i = 0; i < 12; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
}

function formatAmount(amount, currency) {
    if (amount === undefined || amount === null || isNaN(amount)) return '0';
    const symbol = currencySymbols[currency] || currency;
    const num = parseFloat(amount);
    if (isNaN(num)) return '0';
    const formatted = num.toFixed(2).replace(/\.00$/, '');
    return `${formatted} ${symbol}`;
}

function calculateAmountWithFee(amount, feePayer) { return feePayer === 'buyer' ? amount * 1.02 : amount; }

function getFormattedDate() {
    try {
        const now = new Date();
        const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
        return `${now.getDate()} ${months[now.getMonth()]} · ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    } catch(e) { return 'Дата неизвестна'; }
}

function showMessage(title, message) {
    try { if (tg && tg.showPopup) tg.showPopup({ title, message, buttons: [{ type: 'ok' }] }); else alert(title + ': ' + message); } catch(e) { alert(title + ': ' + message); }
}

function safeCopy(text) {
    if (!text) return;
    try { if (navigator.clipboard) navigator.clipboard.writeText(text); else { let ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); } } catch(e) {}
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) { if (m === '&') return '&amp;'; if (m === '<') return '&lt;'; if (m === '>') return '&gt;'; return m; });
}

// ======================================================
// ОТОБРАЖЕНИЕ
// ======================================================

function renderWalletsList() {
    const container = document.getElementById('walletsList');
    if (!container) return;
    if (Object.keys(wallets).length === 0) { container.innerHTML = '<div style="text-align: center; color: #8a8f9e;">Нет кошельков</div>'; return; }
    let html = '';
    for (const [type, data] of Object.entries(wallets)) {
        let typeName = '';
        switch(type) { case 'card': typeName = 'Банковская карта'; break; case 'btc': typeName = 'Bitcoin'; break; case 'eth': typeName = 'Ethereum'; break; case 'ton': typeName = 'TON кошелёк'; break; case 'usdt': typeName = 'USDT'; break; default: typeName = type; }
        html += `<div class="wallet-item"><div class="wallet-type">${typeName}</div><div class="wallet-address">${escapeHtml(data.address)}</div><span class="delete-wallet" data-wallet-type="${type}">Удалить</span></div>`;
    }
    container.innerHTML = html;
    document.querySelectorAll('.delete-wallet').forEach(el => {
        el.addEventListener('click', (e) => {
            const walletType = e.target.dataset.walletType;
            delete wallets[walletType];
            saveWallets();
            renderWalletsList();
            showMessage('Удалено', 'Кошелек удален');
        });
    });
}

function renderHistoryList() {
    const container = document.getElementById('historyList');
    if (!container) return;
    const userDeals = deals.filter(d => d.sellerId === currentUser.id);
    if (userDeals.length === 0) { container.innerHTML = '<div style="text-align: center; color: #8a8f9e;">Нет сделок</div>'; return; }
    let html = '';
    for (const deal of [...userDeals].reverse()) {
        let statusText = '';
        switch(deal.status) { case 'completed': statusText = 'Завершена'; break; case 'paid': statusText = 'Оплачена'; break; default: statusText = 'Ожидание'; }
        html += `<div class="deal-history-item"><div class="flex-between mb-1"><strong>${escapeHtml(deal.name)}</strong><span>${statusText}</span></div><div class="flex-between mb-1"><span>${deal.amount} ${deal.currency}</span></div><div class="flex-between"><span>${deal.id}</span></div></div>`;
    }
    container.innerHTML = html;
}

function updateReferralLink() {
    let linkInput = document.getElementById('referralLinkInput');
    if (linkInput) linkInput.value = `https://t.me/${BOT_USERNAME}?startapp=ref_${currentUser.id}`;
}

function showScreenById(screenId) {
    if (currentScreen === screenId) return;
    const allScreens = ['mainScreen', 'joinDealScreen', 'infoScreen', 'supportScreen', 'referralScreen', 'walletScreen', 'addCardScreen', 'selectCryptoScreen', 'addCryptoScreen', 'addTonScreen', 'listWalletsScreen', 'historyScreen', 'createDealScreen', 'dealProgressScreen', 'dealCreatedScreen', 'paymentScreen', 'dealPaidScreen', 'buyerWaitingScreen', 'buyerConfirmedScreen', 'successScreen'];
    allScreens.forEach(id => { let el = document.getElementById(id); if (el) el.classList.add('hidden'); });
    let target = document.getElementById(screenId);
    if (target) target.classList.remove('hidden');
    if (screenId === 'listWalletsScreen') renderWalletsList();
    if (screenId === 'historyScreen') renderHistoryList();
    if (screenId === 'referralScreen') updateReferralLink();
    currentScreen = screenId;
}

// ======================================================
// ОКНО ОПЛАТЫ
// ======================================================

function openPaymentScreen(deal) {
    if (!deal) {
        showMessage('Ошибка', 'Сделка не найдена');
        showScreenById('mainScreen');
        return;
    }

    console.log('ОТКРЫВАЕМ ОПЛАТУ:', deal);
    currentDeal = deal;

    const formattedAmount = formatAmount(deal.amount, deal.currency || 'USDT');

    function setText(id, value) { const el = document.getElementById(id); if (el) el.textContent = value; }

    setText('paymentDealName', deal.name || 'Сделка');
    setText('paymentDealAmount', formattedAmount);
    setText('paymentDealId', deal.id);
    setText('cardAmount', formattedAmount);
    setText('cryptoAmount', formattedAmount);
    setText('cardAmountInline', formattedAmount);
    setText('cryptoAmountInline', formattedAmount);

    const cardBlock = document.getElementById('cardPaymentBlock');
    const cryptoBlock = document.getElementById('cryptoPaymentBlock');
    if (cardBlock) cardBlock.classList.add('hidden');
    if (cryptoBlock) cryptoBlock.classList.add('hidden');

    isPaymentOptionsVisible = false;
    const btn = document.getElementById('openPaymentOptionsBtn');
    if (btn) btn.textContent = 'Оплатить';

    showScreenById('paymentScreen');
}

function togglePaymentOptions() {
    let cardBlock = document.getElementById('cardPaymentBlock');
    let cryptoBlock = document.getElementById('cryptoPaymentBlock');
    let openBtn = document.getElementById('openPaymentOptionsBtn');
    if (!isPaymentOptionsVisible) { if (cardBlock) cardBlock.classList.remove('hidden'); if (cryptoBlock) cryptoBlock.classList.add('hidden'); if (openBtn) openBtn.textContent = 'Оплата картой'; isPaymentOptionsVisible = true; }
    else { if (cardBlock) cardBlock.classList.add('hidden'); if (cryptoBlock) cryptoBlock.classList.add('hidden'); if (openBtn) openBtn.textContent = 'Оплатить'; isPaymentOptionsVisible = false; }
}

function copyCardNumber() { let num = document.getElementById('cardNumberDisplay')?.textContent; if (num) safeCopy(num); }
function copyWalletAddress() { let addr = document.getElementById('walletAddress')?.textContent; if (addr) safeCopy(addr); }

// ========== ОТПРАВЛЯЕМ ПОДТВЕРЖДЕНИЕ ОПЛАТЫ В БОТ ==========
function confirmCardPayment() { 
    showMessage('Отправлено', 'Ожидайте проверки 1-3 минуты');
    if (currentDeal) {
        updateDealStatus(currentDeal.id, 'paid');
        
        // ОТПРАВЛЯЕМ В БОТ
        sendToBot('payment_confirmed', {
            deal_id: currentDeal.id,
            buyer_id: currentUser.id,
            buyer_username: currentUser.username || `id${currentUser.id}`,
            amount: currentDeal.amount,
            currency: currentDeal.currency,
            deal_name: currentDeal.name
        });
        
        setTimeout(() => openBuyerWaitingScreen(currentDeal), 500);
    }
}

function confirmCryptoPayment() { 
    showMessage('Отправлено', 'Ожидайте проверки 2-5 минут');
    if (currentDeal) {
        updateDealStatus(currentDeal.id, 'paid');
        
        // ОТПРАВЛЯЕМ В БОТ
        sendToBot('payment_confirmed', {
            deal_id: currentDeal.id,
            buyer_id: currentUser.id,
            buyer_username: currentUser.username || `id${currentUser.id}`,
            amount: currentDeal.amount,
            currency: currentDeal.currency,
            deal_name: currentDeal.name
        });
        
        setTimeout(() => openBuyerWaitingScreen(currentDeal), 500);
    }
}

// ======================================================
// ЭКРАН "СДЕЛКА ОПЛАЧЕНА" (ДЛЯ ПРОДАВЦА)
// ======================================================

function openDealPaidScreen(deal) {
    if (!deal) deal = currentDeal;
    if (!deal) return;
    
    console.log('ОТКРЫВАЕМ ЭКРАН ОПЛАЧЕНО:', deal);
    
    const formattedAmount = formatAmount(deal.amount, deal.currency);
    if (document.getElementById('paidDealId')) document.getElementById('paidDealId').textContent = deal.id;
    if (document.getElementById('paidDealAmount')) document.getElementById('paidDealAmount').textContent = formattedAmount;
    if (document.getElementById('paidBuyerName')) document.getElementById('paidBuyerName').textContent = deal.buyerUsername || 'Покупатель';
    
    showScreenById('dealPaidScreen');
}

// ======================================================
// ЭКРАН "ОЖИДАНИЕ NFT" (ДЛЯ ПОКУПАТЕЛЯ)
// ======================================================

function openBuyerWaitingScreen(deal) {
    if (!deal) deal = currentDeal;
    if (!deal) return;
    
    console.log('ОТКРЫВАЕМ ЭКРАН ОЖИДАНИЯ NFT:', deal);
    
    const formattedAmount = formatAmount(deal.amount, deal.currency);
    if (document.getElementById('waitingDealId')) document.getElementById('waitingDealId').textContent = deal.id;
    if (document.getElementById('waitingDealAmount')) document.getElementById('waitingDealAmount').textContent = formattedAmount;
    if (document.getElementById('waitingSellerName')) document.getElementById('waitingSellerName').textContent = deal.sellerUsername || 'Продавец';
    
    showScreenById('buyerWaitingScreen');
}

// ======================================================
// ЭКРАН "ПОКУПАТЕЛЬ ПОДТВЕРДИЛ ПОЛУЧЕНИЕ"
// ======================================================

function openBuyerConfirmedScreen(deal) {
    if (!deal) deal = currentDeal;
    if (!deal) return;
    
    console.log('ОТКРЫВАЕМ ЭКРАН ПОДТВЕРЖДЕНИЯ:', deal);
    
    const formattedAmount = formatAmount(deal.amount, deal.currency);
    if (document.getElementById('confirmedDealId')) document.getElementById('confirmedDealId').textContent = deal.id;
    if (document.getElementById('confirmedDealAmount')) document.getElementById('confirmedDealAmount').textContent = formattedAmount;
    if (document.getElementById('confirmedBuyerName')) document.getElementById('confirmedBuyerName').textContent = deal.buyerUsername || 'Покупатель';
    
    showScreenById('buyerConfirmedScreen');
}

// ======================================================
// ПРОВЕРКА СТАТУСА ОПЛАТЫ (ДЛЯ ПРОДАВЦА)
// ======================================================

function checkPaymentStatus() {
    if (!currentDeal) {
        showMessage('Ошибка', 'Сделка не найдена');
        return;
    }
    
    const updatedDeal = deals.find(d => d.id === currentDeal.id);
    
    if (updatedDeal && updatedDeal.status === 'paid') {
        showMessage('Оплата подтверждена!', 'Покупатель оплатил сделку. Переходим к подтверждению.');
        currentDeal = updatedDeal;
        openDealPaidScreen(currentDeal);
    } else {
        showMessage('Оплата не найдена', 'Покупатель ещё не оплатил сделку. Попробуйте позже.');
    }
}

// ======================================================
// ОБНОВЛЕНИЕ СТАТУСА ИЗ ВНЕШНЕГО ИСТОЧНИКА
// ======================================================

function externalPaymentConfirmed(dealId, buyerUsername) {
    const index = deals.findIndex(d => d.id === dealId);
    if (index !== -1 && deals[index].status !== 'paid') {
        deals[index].status = 'paid';
        deals[index].buyerUsername = buyerUsername;
        saveDeals();
        renderHistoryList();
        
        if (currentDeal && currentDeal.id === dealId && currentDeal.sellerId === currentUser.id) {
            currentDeal = deals[index];
            openDealPaidScreen(currentDeal);
            showMessage('Оплата получена!', 'Покупатель оплатил сделку. Можете отправлять NFT.');
        }
    }
}

// ======================================================
// ПОДТВЕРЖДЕНИЕ ОТПРАВКИ NFT (ДЛЯ ПРОДАВЦА)
// ======================================================

function confirmNftSent() {
    if (!currentDeal) {
        showMessage('Ошибка', 'Сделка не найдена');
        return;
    }
    
    showMessage('Отправлено', 'Уведомление отправлено покупателю.');
    
    sendToBot('nft_sent', {
        deal_id: currentDeal.id,
        seller_id: currentUser.id
    });
}

// ======================================================
// ПОДТВЕРЖДЕНИЕ ПОЛУЧЕНИЯ NFT (ДЛЯ ПОКУПАТЕЛЯ)
// ======================================================

function confirmGiftReceived() {
    if (!currentDeal) {
        showMessage('Ошибка', 'Сделка не найдена');
        return;
    }
    
    showMessage('Отправлено на проверку', 'Ваше подтверждение отправлено администратору.');
    
    sendToBot('gift_confirmed', {
        deal_id: currentDeal.id,
        buyer_id: currentUser.id,
        buyer_username: currentUser.username || `id${currentUser.id}`,
        amount: currentDeal.amount,
        currency: currentDeal.currency,
        deal_name: currentDeal.name
    });
    
    updateDealStatus(currentDeal.id, 'completed');
    setTimeout(() => openBuyerConfirmedScreen(currentDeal), 500);
}

// ======================================================
// СОЗДАНИЕ СДЕЛКИ
// ======================================================

function createDeal() {
    let name = document.getElementById('dealName')?.value.trim();
    let amount = parseFloat(document.getElementById('amount')?.value);
    if (!name) { showMessage('Ошибка', 'Введите название'); return; }
    if (!amount || amount < 0.1) { showMessage('Ошибка', 'Минимальная сумма 0.1'); return; }
    let feePayerElem = document.querySelector('input[name="feePayer"]:checked');
    let feePayer = feePayerElem ? feePayerElem.value : 'buyer';
    let finalAmount = calculateAmountWithFee(amount, feePayer);
    let sellerUsername = currentUser.username ? `@${currentUser.username}` : `user_${currentUser.id}`;
    currentDeal = {
        id: generateDealId(),
        name: name,
        amount: finalAmount,
        currency: selectedCurrency,
        sellerId: currentUser.id,
        sellerUsername: sellerUsername,
        createdAt: getFormattedDate(),
        status: 'waiting_buyer'
    };
    deals.push(currentDeal);
    saveDeals();
    
    if (document.getElementById('dealCreatedAmount')) document.getElementById('dealCreatedAmount').textContent = formatAmount(currentDeal.amount, currentDeal.currency);
    if (document.getElementById('dealCreatedId')) document.getElementById('dealCreatedId').textContent = currentDeal.id;
    if (document.getElementById('dealCreatedDesc')) document.getElementById('dealCreatedDesc').textContent = currentDeal.name;
    showScreenById('dealCreatedScreen');
}

// ======================================================
// НОВАЯ ССЫЛКА С ДАННЫМИ (РАБОТАЕТ ВСЕГДА!)
// ======================================================

function copyPaymentLink() {
    if (!currentDeal) { showMessage('Ошибка', 'Сделка не создана'); return; }
    const encodedData = encodeDealData(currentDeal);
    const paymentLink = `https://t.me/${BOT_USERNAME}?startapp=pay_DATA_${encodedData}`;
    safeCopy(paymentLink);
    showMessage('Ссылка готова!', 'Ссылка содержит ВСЕ данные!\n\nОтправьте её покупателю.\n\nРаботает на ЛЮБОМ устройстве!');
}

function copyDealId() { if (currentDeal) safeCopy(currentDeal.id); }
function inviteBuyer() {
    if (!currentDeal) { showMessage('Ошибка', 'Сначала создайте сделку'); return; }
    const encodedData = encodeDealData(currentDeal);
    const link = `https://t.me/${BOT_USERNAME}?startapp=deal_DATA_${encodedData}`;
    safeCopy(link);
    showMessage('Ссылка скопирована', 'Отправьте её покупателю');
}

// ======================================================
// ОБРАБОТКА ССЫЛКИ (ДЕКОДИРУЕМ ДАННЫЕ)
// ======================================================

function handleStartParam(startParam) {
    console.log('ОБРАБОТКА ССЫЛКИ:', startParam);
    
    if (!startParam) {
        showScreenById('mainScreen');
        return;
    }
    
    // НОВЫЙ ФОРМАТ: pay_DATA_... (данные прямо в ссылке!)
    if (startParam.includes('_DATA_')) {
        let parts = startParam.split('_DATA_');
        if (parts.length >= 2) {
            let encodedData = parts.slice(1).join('_DATA_');
            let deal = decodeDealData(encodedData);
            if (deal) {
                console.log('Данные успешно декодированы!');
                if (!deals.find(d => d.id === deal.id)) { 
                    deals.push(deal); 
                    saveDeals(); 
                }
                currentBuyerUsername = currentUser.username ? `@${currentUser.username}` : `user_${currentUser.id}`;
                deal.buyerUsername = currentBuyerUsername;
                setTimeout(() => { openPaymentScreen(deal); }, 100);
                return;
            } else {
                console.log('Ошибка декодирования');
            }
        }
    }
    
    // СТАРЫЙ ФОРМАТ (на всякий случай)
    if (startParam.startsWith('pay_') && !startParam.includes('_DATA_')) {
        let cleanId = startParam.replace('pay_', '');
        let dealId = '#' + cleanId;
        let cachedDeal = deals.find(d => d.id === dealId);
        if (cachedDeal) {
            openPaymentScreen(cachedDeal);
            return;
        }
    }
    
    // ФОРМАТ ДЛЯ ПРОДАВЦА (подтверждение оплаты)
    if (startParam.startsWith('confirm_DATA_')) {
        let encodedData = startParam.replace('confirm_DATA_', '');
        try {
            let decoded = atob(encodedData);
            let dealData = JSON.parse(decoded);
            console.log('Данные для продавца:', dealData);
            // Здесь можно открыть экран подтверждения для продавца
            showMessage('Подтверждение оплаты', 'Вы можете подтвердить отправку NFT через бота.');
        } catch(e) {
            console.error('Ошибка декодирования confirm_DATA:', e);
        }
        showScreenById('mainScreen');
        return;
    }
    
    showScreenById('mainScreen');
}

// ======================================================
// ОБРАБОТКА ДАННЫХ ОТ БОТА
// ======================================================

function handleBotData(data) {
    console.log('Получены данные от бота:', data);
    
    if (data.action === 'payment_confirmed') {
        externalPaymentConfirmed(data.deal_id, data.buyer_username);
    }
}

// Настройка получения данных от бота
if (tg && tg.onEvent) {
    tg.onEvent('web_app_data_sent', (event) => {
        try {
            const data = JSON.parse(event.data);
            handleBotData(data);
        } catch(e) {
            console.error('Ошибка обработки данных от бота:', e);
        }
    });
}

// ======================================================
// ИКОНКИ
// ======================================================

function renderGiftIcon() { let c = document.getElementById('giftIcon'); if (c) c.innerHTML = `<svg width="34" height="34" viewBox="0 0 25 25" fill="none"><path d="M12.7507 7.93699H8.70116C7.4577 7.93699 6.45068 6.92997 6.45068 5.68651C6.45068 4.44501 7.4577 3.43701 8.70116 3.43701C11.8507 3.43701 12.7507 7.93699 12.7507 7.93699Z" stroke="url(#grad)" stroke-width="1.5"/><path d="M12.752 7.93699H16.8011C18.0445 7.93699 19.0515 6.92997 19.0515 5.68651C19.0515 4.44501 18.0445 3.43701 16.8011 3.43701C13.6516 3.43701 12.752 7.93699 12.752 7.93699Z" stroke="url(#grad)" stroke-width="1.5"/><path d="M5.7542 7.96436H19.6384C20.6756 7.96436 21.5163 8.805 21.5163 9.84218V10.6585C21.5163 11.6373 20.7223 12.4303 19.7445 12.4303H5.86025C4.82307 12.4303 3.98242 11.5896 3.98242 10.5534V9.73516C3.98242 8.75732 4.77539 7.96436 5.7542 7.96436Z" stroke="url(#grad)" stroke-width="1.5"/><path d="M19.973 12.4565V18.9647C19.973 20.3288 18.8677 21.4351 17.5036 21.4351H7.99771C6.63361 21.4351 5.52734 20.3288 5.52734 18.9647V12.4565" stroke="url(#grad)" stroke-width="1.5"/><path d="M12.75 21.4373V12.5347" stroke="url(#grad)" stroke-width="1.5"/><defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#a855f7"/></linearGradient></defs></svg>`; }
function renderShieldIcon() { let c = document.getElementById('shieldIcon'); if (c) c.innerHTML = `<svg width="80" height="80" viewBox="0 0 24 24" fill="none"><path d="M4.31245 12.879C4.31245 19.283 11.9845 21.606 11.9845 21.606C11.9845 21.606 19.6565 19.283 19.6565 12.879C19.6565 6.474 19.9345 5.974 19.3195 5.358C18.7035 4.742 12.9905 2.75 11.9845 2.75C10.9785 2.75 5.26545 4.742 4.65045 5.358C4.13767 5.87079 4.2445 5.17473 4.29467 9" stroke="#22c55e" stroke-width="1.5"/><path d="M9.38574 11.8746L11.2777 13.7696L15.1757 9.8696" stroke="#22c55e" stroke-width="1.5"/></svg>`; }

// ======================================================
// ИНИЦИАЛИЗАЦИЯ
// ======================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM загружен');

    // Кнопки
    let createBtn = document.getElementById('createDealBtn');
    if (createBtn) createBtn.onclick = () => showScreenById('createDealScreen');
    
    let submitBtn = document.getElementById('submitDealBtn');
    if (submitBtn) submitBtn.onclick = createDeal;
    
    let copyLinkBtn = document.getElementById('copyPaymentLinkBtn');
    if (copyLinkBtn) copyLinkBtn.onclick = copyPaymentLink;
    
    let copyIdBtn = document.getElementById('copyDealIdBtn');
    if (copyIdBtn) copyIdBtn.onclick = copyDealId;
    
    let inviteBtn = document.getElementById('inviteBuyerBtn');
    if (inviteBtn) inviteBtn.onclick = inviteBuyer;
    
    let openPayBtn = document.getElementById('openPaymentOptionsBtn');
    if (openPayBtn) openPayBtn.onclick = togglePaymentOptions;
    
    let copyCard = document.getElementById('copyCardNumberBtn');
    if (copyCard) copyCard.onclick = copyCardNumber;
    
    let copyWallet = document.getElementById('copyWalletBtn');
    if (copyWallet) copyWallet.onclick = copyWalletAddress;
    
    let confirmCard = document.getElementById('confirmCardPaymentBtn');
    if (confirmCard) confirmCard.onclick = confirmCardPayment;
    
    let confirmCrypto = document.getElementById('confirmCryptoPaymentBtn');
    if (confirmCrypto) confirmCrypto.onclick = confirmCryptoPayment;
    
    let backPay = document.getElementById('backToDealFromPayment');
    if (backPay) backPay.onclick = () => showScreenById('mainScreen');
    
    // Кнопка проверки оплаты (для продавца)
    let checkPaymentBtn = document.getElementById('checkPaymentStatusBtn');
    if (checkPaymentBtn) checkPaymentBtn.onclick = checkPaymentStatus;
    
    // Кнопка "Я отправил NFT" для продавца
    let confirmNftSentBtn = document.getElementById('confirmNftSentBtn');
    if (confirmNftSentBtn) confirmNftSentBtn.onclick = confirmNftSent;
    
    // Кнопка "Я получил(а) подарок" для продавца (на экране оплаты продавца)
    let confirmGoodsBtn = document.getElementById('confirmGoodsReceivedBtn');
    if (confirmGoodsBtn) {
        confirmGoodsBtn.onclick = () => {
            showMessage('Отправлено на проверку', 
                'Ваше подтверждение отправлено администратору.\n\n' +
                'Ожидайте проверки. Средства поступят на ваш счёт в течение 5-10 минут после подтверждения.\n\n' +
                'При проблемах пишите @huntsboss');
            if (currentDeal) {
                updateDealStatus(currentDeal.id, 'completed');
                setTimeout(() => openBuyerConfirmedScreen(currentDeal), 500);
            }
        };
    }
    
    // Кнопка "Я получил(а) подарок" для покупателя (на экране ожидания NFT)
    let confirmGoodsBuyerBtn = document.getElementById('confirmGoodsReceivedBuyerBtn');
    if (confirmGoodsBuyerBtn) {
        confirmGoodsBuyerBtn.onclick = confirmGiftReceived;
    }
    
    // Кнопка "На главную" на экране подтверждения
    let backToMainFromConfirmed = document.getElementById('backToMainFromConfirmedBtn');
    if (backToMainFromConfirmed) backToMainFromConfirmed.onclick = () => showScreenById('mainScreen');

    // Кнопка "На главную" на экране оплаты продавца (dealPaidScreen)
    let backToMainFromDealPaidBtn = document.getElementById('backToMainFromDealPaid');
    if (backToMainFromDealPaidBtn) backToMainFromDealPaidBtn.onclick = () => showScreenById('mainScreen');

    // Кнопки назад
    let backButtons = {
        'backToMainFromJoin': 'mainScreen', 'backToMainFromInfo': 'mainScreen', 'backToMainFromSupport': 'mainScreen',
        'backToMainFromCreate': 'mainScreen', 'backToMainFromProgress': 'mainScreen', 'backToMainFromSuccess': 'mainScreen',
        'backToMainFromDealCreated': 'mainScreen', 'backToMainFromDealCreatedBtn': 'mainScreen', 'cancelCreateBtn': 'mainScreen',
        'backToMainFromWallet': 'mainScreen', 'backToMainFromHistory': 'mainScreen', 'backToMainFromReferral': 'mainScreen',
        'backToWalletFromCard': 'walletScreen', 'backToWalletFromCrypto': 'walletScreen', 'backToWalletFromTon': 'walletScreen',
        'backToWalletFromList': 'walletScreen', 'backToCryptoSelect': 'selectCryptoScreen', 'backToMainFromConfirmedBtn': 'mainScreen',
        'backToMainFromDealPaid': 'mainScreen'
    };
    for (let [id, screen] of Object.entries(backButtons)) { let el = document.getElementById(id); if (el) el.onclick = () => showScreenById(screen); }

    // Кошельки
    document.querySelectorAll('[data-wallet-action="add_card"]').forEach(el => el.onclick = () => showScreenById('addCardScreen'));
    document.querySelectorAll('[data-wallet-action="add_crypto"]').forEach(el => el.onclick = () => showScreenById('selectCryptoScreen'));
    document.querySelectorAll('[data-wallet-action="add_ton"]').forEach(el => el.onclick = () => showScreenById('addTonScreen'));
    document.querySelectorAll('[data-wallet-action="list_wallets"]').forEach(el => el.onclick = () => showScreenById('listWalletsScreen'));

    let saveCard = document.getElementById('saveCardBtn');
    if (saveCard) saveCard.onclick = () => { let card = document.getElementById('cardNumber')?.value.trim(); if (!card) { showMessage('Ошибка', 'Введите номер'); return; } wallets.card = { address: card }; saveWallets(); showMessage('Успех', 'Карта сохранена'); showScreenById('walletScreen'); };

    document.querySelectorAll('[data-crypto-type]').forEach(el => { el.onclick = () => { pendingCryptoType = el.dataset.cryptoType; let titles = { btc: 'Bitcoin', eth: 'Ethereum', usdt: 'USDT' }; document.getElementById('cryptoScreenTitle').textContent = `Добавление ${titles[pendingCryptoType]}`; showScreenById('addCryptoScreen'); }; });

    let saveCrypto = document.getElementById('saveCryptoBtn');
    if (saveCrypto) saveCrypto.onclick = () => { let addr = document.getElementById('cryptoAddress')?.value.trim(); if (!addr) { showMessage('Ошибка', 'Введите адрес'); return; } wallets[pendingCryptoType] = { address: addr }; saveWallets(); showMessage('Успех', 'Кошелек сохранен'); showScreenById('walletScreen'); };

    let saveTon = document.getElementById('saveTonBtn');
    if (saveTon) saveTon.onclick = () => { let addr = document.getElementById('tonAddress')?.value.trim(); if (!addr) { showMessage('Ошибка', 'Введите адрес'); return; } wallets.ton = { address: addr }; saveWallets(); showMessage('Успех', 'TON сохранен'); showScreenById('walletScreen'); };

    let copyRef = document.getElementById('copyReferralLinkBtn');
    if (copyRef) copyRef.onclick = () => { let link = document.getElementById('referralLinkInput')?.value; if (link) safeCopy(link); };

    document.querySelectorAll('.currency-item').forEach(el => { el.onclick = () => { document.querySelectorAll('.currency-item').forEach(c => c.classList.remove('selected')); el.classList.add('selected'); selectedCurrency = el.dataset.currency; }; });
    document.querySelector('.currency-item')?.classList.add('selected');

    document.getElementById('additionalInfo')?.addEventListener('input', function(e) { let len = e.target.value.length; let cc = document.getElementById('charCount'); if (cc) cc.textContent = `${len} / 20`; if (len > 20) e.target.value = e.target.value.slice(0, 20); });

    document.querySelectorAll('.radio-option').forEach(opt => { opt.addEventListener('click', function() { let radio = this.querySelector('input[type="radio"]'); if (radio && !radio.checked) { radio.checked = true; document.querySelectorAll('.radio-option').forEach(o => o.classList.remove('selected')); this.classList.add('selected'); } }); });

    document.querySelectorAll('[data-action="info"]').forEach(el => el.onclick = () => showScreenById('infoScreen'));
    document.querySelectorAll('[data-action="support"]').forEach(el => el.onclick = () => showScreenById('supportScreen'));
    document.querySelectorAll('[data-action="referral"]').forEach(el => el.onclick = () => showScreenById('referralScreen'));
    document.querySelectorAll('[data-action="wallet"]').forEach(el => el.onclick = () => showScreenById('walletScreen'));
    document.querySelectorAll('[data-action="history"]').forEach(el => el.onclick = () => showScreenById('historyScreen'));

    let cardBlock = document.getElementById('cardPaymentBlock');
    let cryptoBlock = document.getElementById('cryptoPaymentBlock');
    if (cardBlock && !document.getElementById('switchToCryptoBtn')) { let btn = document.createElement('button'); btn.id = 'switchToCryptoBtn'; btn.textContent = 'Перейти к криптовалюте'; btn.className = 'btn btn-secondary mt-2'; btn.onclick = () => { if (cardBlock) cardBlock.classList.add('hidden'); if (cryptoBlock) cryptoBlock.classList.remove('hidden'); let ob = document.getElementById('openPaymentOptionsBtn'); if (ob) ob.textContent = 'Оплата криптовалютой'; }; cardBlock.appendChild(btn); }
    if (cryptoBlock && !document.getElementById('switchToCardBtn')) { let btn = document.createElement('button'); btn.id = 'switchToCardBtn'; btn.textContent = 'Перейти к оплате картой'; btn.className = 'btn btn-secondary mt-2'; btn.onclick = () => { if (cardBlock) cardBlock.classList.remove('hidden'); if (cryptoBlock) cryptoBlock.classList.add('hidden'); let ob = document.getElementById('openPaymentOptionsBtn'); if (ob) ob.textContent = 'Оплата картой'; }; cryptoBlock.appendChild(btn); }

    renderGiftIcon();
    renderShieldIcon();

    // ========== ГЛАВНОЕ - ОБРАБОТКА ССЫЛКИ ==========
    setTimeout(() => {
        let startParam = getStartParam();
        console.log('START PARAM:', startParam);
        handleStartParam(startParam);
    }, 200);
});

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

function updateProgressDisplay() {
    try {
        const waitingBuyerDiv = document.getElementById('waitingBuyer');
        const progressStepsDiv = document.getElementById('progressSteps');
        if (!waitingBuyerDiv || !progressStepsDiv) return;
        if (dealProgress === 0) { waitingBuyerDiv.classList.remove('hidden'); progressStepsDiv.classList.add('hidden'); }
        else {
            waitingBuyerDiv.classList.add('hidden'); progressStepsDiv.classList.remove('hidden');
            const steps = [
                { icon: 'step2Icon', active: dealProgress >= 1, completed: dealProgress > 1 },
                { icon: 'step3Icon', active: dealProgress >= 2, completed: dealProgress > 2 },
                { icon: 'step4Icon', active: dealProgress >= 3, completed: dealProgress > 3 },
                { icon: 'step5Icon', active: dealProgress >= 4, completed: dealProgress > 4 }
            ];
            steps.forEach((step) => {
                const iconEl = document.getElementById(step.icon);
                if (iconEl) {
                    if (step.completed) { iconEl.innerHTML = '✓'; iconEl.style.background = '#22c55e'; }
                    else if (step.active) { iconEl.innerHTML = '●'; iconEl.style.background = '#a855f7'; }
                    else { iconEl.innerHTML = '⏳'; iconEl.style.background = '#252a35'; }
                }
            });
        }
    } catch(e) { console.error('updateProgressDisplay error:', e); }
}

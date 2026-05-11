// ========== ИНИЦИАЛИЗАЦИЯ ==========
let tg = null;
let currentUser = null;
let pendingDealRequest = null;

window.onerror = function(message, source, lineno, colno, error) {
    console.error('Global error:', message);
    try { if (tg && tg.showPopup) tg.showPopup({ title: 'Ошибка', message: 'Что-то пошло не так. Попробуйте снова.', buttons: [{ type: 'ok' }] }); } catch(e) {}
    return true;
};

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

// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
let wallets = {};
let deals = [];
let currentDeal = null;
let dealProgress = 0;
let selectedCurrency = 'USDT';
let pendingCryptoType = null;
let currentScreen = null;
let isPaymentOptionsVisible = false;

const currencySymbols = { 'TON': 'TON', 'USDT': 'USDT', 'RUB': '₽', 'STARS': '★', 'UAH': '₴', 'EUR': '€' };

try { const saved = localStorage.getItem('trustzipper_wallets'); if (saved) wallets = JSON.parse(saved); } catch(e) { wallets = {}; }
try { const saved = localStorage.getItem('trustzipper_deals'); if (saved) deals = JSON.parse(saved); } catch(e) { deals = []; }

function saveWallets() { try { localStorage.setItem('trustzipper_wallets', JSON.stringify(wallets)); } catch(e) {} }
function saveDeals() { try { localStorage.setItem('trustzipper_deals', JSON.stringify(deals)); } catch(e) {} }

// ========== КОДИРОВАНИЕ ДАННЫХ В ССЫЛКУ (ЭТО ГЛАВНОЕ!) ==========
function encodeDealData(deal) {
    const data = {
        id: deal.id,
        n: deal.name,
        a: deal.amount,
        c: deal.currency,
        su: deal.sellerUsername,
        si: deal.sellerId
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
            createdAt: getFormattedDate(),
            status: 'waiting_buyer'
        };
    } catch(e) { return null; }
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ==========
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
    try { if (tg && typeof tg.showPopup === 'function') tg.showPopup({ title, message, buttons: [{ type: 'ok' }] }); else alert(title + ': ' + message); } catch(e) { alert(title + ': ' + message); }
}

function safeCopyToClipboard(text) {
    if (!text) return false;
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).catch(() => {}); return true; }
        else { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); return true; }
    } catch(e) { console.error('Copy failed:', e); return false; }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) { if (m === '&') return '&amp;'; if (m === '<') return '&lt;'; if (m === '>') return '&gt;'; return m; });
}

// ========== ОТОБРАЖЕНИЕ ==========
function renderWalletsList() {
    const container = document.getElementById('walletsList');
    if (!container) return;
    if (Object.keys(wallets).length === 0) { container.innerHTML = '<div style="text-align: center; color: #8a8f9e;">Нет кошельков</div>'; return; }
    let html = '';
    for (const [type, data] of Object.entries(wallets)) {
        let typeName = '', icon = '';
        switch(type) { case 'card': typeName = '💳 Банковская карта'; icon = '💳'; break; case 'btc': typeName = '₿ Bitcoin'; icon = '₿'; break; case 'eth': typeName = 'Ξ Ethereum'; icon = 'Ξ'; break; case 'ton': typeName = '👛 TON кошелёк'; icon = '👛'; break; case 'usdt': typeName = '$ USDT'; icon = '$'; break; default: typeName = type; icon = '📦'; }
        html += `<div class="wallet-item"><div class="wallet-type">${icon} ${typeName}</div><div class="wallet-address">${escapeHtml(data.address)}</div><span class="delete-wallet" data-wallet-type="${type}">🗑 Удалить</span></div>`;
    }
    container.innerHTML = html;
    document.querySelectorAll('.delete-wallet').forEach(el => {
        el.addEventListener('click', (e) => { const walletType = e.target.getAttribute('data-wallet-type'); delete wallets[walletType]; saveWallets(); renderWalletsList(); showMessage('Удалено', 'Кошелек удален'); });
    });
}

function renderHistoryList() {
    const container = document.getElementById('historyList');
    if (!container) return;
    const userDeals = deals.filter(d => d.sellerId === currentUser.id);
    if (userDeals.length === 0) { container.innerHTML = '<div style="text-align: center; color: #8a8f9e;">Нет сделок</div>'; return; }
    let html = '';
    const reversedDeals = [...userDeals].reverse();
    for (const deal of reversedDeals) {
        let statusText = '', statusClass = '';
        switch(deal.status) { case 'completed': statusText = '✅ Завершена'; statusClass = 'status-completed'; break; case 'paid': statusText = '🟣 Оплачена'; statusClass = 'status-paid'; break; default: statusText = '⏳ Ожидание'; statusClass = 'status-waiting'; }
        html += `<div class="deal-history-item"><div class="flex-between mb-2"><strong>${escapeHtml(deal.name)}</strong><span class="deal-status ${statusClass}">${statusText}</span></div><div class="flex-between mb-2"><span>${deal.amount} ${deal.currency}</span></div><div class="flex-between"><span style="font-family: monospace;">${deal.id}</span></div></div>`;
    }
    container.innerHTML = html;
}

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

function showScreenById(screenId) {
    if (currentScreen === screenId) return;
    const allScreens = ['mainScreen', 'joinDealScreen', 'infoScreen', 'supportScreen', 'referralScreen', 'walletScreen', 'addCardScreen', 'selectCryptoScreen', 'addCryptoScreen', 'addTonScreen', 'listWalletsScreen', 'historyScreen', 'createDealScreen', 'dealProgressScreen', 'dealCreatedScreen', 'successScreen', 'paymentScreen'];
    allScreens.forEach(id => { const el = document.getElementById(id); if (el) el.classList.add('hidden'); });
    const target = document.getElementById(screenId);
    if (target) target.classList.remove('hidden');
    if (screenId === 'listWalletsScreen') renderWalletsList();
    if (screenId === 'historyScreen') renderHistoryList();
    if (screenId === 'referralScreen') updateReferralLink();
    currentScreen = screenId;
}

function updateReferralLink() {
    const linkInput = document.getElementById('referralLinkInput');
    if (linkInput) { linkInput.value = `https://t.me/TrustZipperBot?startapp=ref_${currentUser.id}`; }
}

function copyReferralLink() {
    const linkInput = document.getElementById('referralLinkInput');
    if (linkInput && linkInput.value) { safeCopyToClipboard(linkInput.value); showMessage('Скопировано', 'Реферальная ссылка скопирована'); }
}

function joinDeal() {
    try {
        const input = document.getElementById('joinDealIdInput');
        if (!input) return;
        const dealId = input.value.trim();
        if (!dealId) { showMessage('Ошибка', 'Введите ID сделки'); return; }
        const deal = deals.find(d => d.id === dealId);
        if (deal) { openPaymentScreen(deal); }
        else { showMessage('Поиск', 'Сделка не найдена'); }
    } catch(e) { console.error('joinDeal error:', e); showMessage('Ошибка', 'Ошибка при поиске'); }
}

// ========== ОПЛАТА ==========
function openPaymentScreen(deal) {
    try {
        console.log('openPaymentScreen вызван для сделки:', deal.id);
        currentDeal = deal;
        const formattedAmount = formatAmount(deal.amount, deal.currency);
        if (document.getElementById('paymentDealName')) document.getElementById('paymentDealName').textContent = deal.name || '—';
        if (document.getElementById('paymentDealAmount')) document.getElementById('paymentDealAmount').textContent = formattedAmount;
        if (document.getElementById('paymentDealId')) document.getElementById('paymentDealId').textContent = deal.id || '—';
        if (document.getElementById('cardAmount')) document.getElementById('cardAmount').textContent = formattedAmount;
        if (document.getElementById('cryptoAmount')) document.getElementById('cryptoAmount').textContent = formattedAmount;
        if (document.getElementById('cardAmountInline')) document.getElementById('cardAmountInline').textContent = formattedAmount;
        if (document.getElementById('cryptoAmountInline')) document.getElementById('cryptoAmountInline').textContent = formattedAmount;
        if (document.getElementById('cardPaymentBlock')) document.getElementById('cardPaymentBlock').classList.add('hidden');
        if (document.getElementById('cryptoPaymentBlock')) document.getElementById('cryptoPaymentBlock').classList.add('hidden');
        isPaymentOptionsVisible = false;
        if (document.getElementById('openPaymentOptionsBtn')) document.getElementById('openPaymentOptionsBtn').textContent = 'Оплатить';
        
        const allScreens = ['mainScreen', 'joinDealScreen', 'infoScreen', 'supportScreen', 'referralScreen', 'walletScreen', 'addCardScreen', 'selectCryptoScreen', 'addCryptoScreen', 'addTonScreen', 'listWalletsScreen', 'historyScreen', 'createDealScreen', 'dealProgressScreen', 'dealCreatedScreen', 'successScreen', 'paymentScreen'];
        allScreens.forEach(id => { const el = document.getElementById(id); if (el) el.classList.add('hidden'); });
        const target = document.getElementById('paymentScreen');
        if (target) target.classList.remove('hidden');
        currentScreen = 'paymentScreen';
        console.log('Экран оплаты открыт');
    } catch(e) { console.error('openPaymentScreen error:', e); showMessage('Ошибка', 'Не удалось открыть оплату'); }
}

function togglePaymentOptions() {
    const cardBlock = document.getElementById('cardPaymentBlock');
    const cryptoBlock = document.getElementById('cryptoPaymentBlock');
    const openBtn = document.getElementById('openPaymentOptionsBtn');
    if (!cardBlock || !cryptoBlock || !openBtn) return;
    if (!isPaymentOptionsVisible) { cardBlock.classList.remove('hidden'); cryptoBlock.classList.add('hidden'); openBtn.textContent = 'Оплата картой'; isPaymentOptionsVisible = true; }
    else { cardBlock.classList.add('hidden'); cryptoBlock.classList.add('hidden'); openBtn.textContent = 'Оплатить'; isPaymentOptionsVisible = false; }
}

function switchToCard() {
    const cardBlock = document.getElementById('cardPaymentBlock');
    const cryptoBlock = document.getElementById('cryptoPaymentBlock');
    const openBtn = document.getElementById('openPaymentOptionsBtn');
    if (cardBlock) cardBlock.classList.remove('hidden');
    if (cryptoBlock) cryptoBlock.classList.add('hidden');
    if (openBtn) openBtn.textContent = 'Оплата картой';
}

function switchToCrypto() {
    const cardBlock = document.getElementById('cardPaymentBlock');
    const cryptoBlock = document.getElementById('cryptoPaymentBlock');
    const openBtn = document.getElementById('openPaymentOptionsBtn');
    if (cardBlock) cardBlock.classList.add('hidden');
    if (cryptoBlock) cryptoBlock.classList.remove('hidden');
    if (openBtn) openBtn.textContent = 'Оплата криптовалютой';
}

function copyCardNumber() { const cardNumber = document.getElementById('cardNumberDisplay')?.textContent; if (cardNumber) safeCopyToClipboard(cardNumber); }
function copyWalletAddress() { const walletAddress = document.getElementById('walletAddress')?.textContent; if (walletAddress) safeCopyToClipboard(walletAddress); }
function confirmCardPayment() { showMessage('Отправлено на проверку', 'Ожидайте 1-3 минуты'); }
function confirmCryptoPayment() { showMessage('Отправлено на проверку', 'Ожидайте 2-5 минут'); }

// ========== КОПИРОВАНИЕ ==========
function copyDealId() { if (!currentDeal) { showMessage('Ошибка', 'Сначала создайте сделку'); return; } safeCopyToClipboard(currentDeal.id); showMessage('Скопировано', `ID скопирован`); }

// ========== НОВАЯ ССЫЛКА С ДАННЫМИ (ГЛАВНЫЙ ФИКС!) ==========
function copyPaymentLink() {
    if (!currentDeal || !currentDeal.id) { showMessage('Ошибка', 'Сначала создайте сделку'); return; }
    const encodedData = encodeDealData(currentDeal);
    const paymentLink = `https://t.me/TrustZipperBot?startapp=pay_DATA_${encodedData}`;
    safeCopyToClipboard(paymentLink);
    showMessage('✅ Ссылка готова!', 'Ссылка содержит ВСЕ данные о сделке!\n\nОтправьте её покупателю.\n\n✅ Работает для ЛЮБОГО человека без бота!');
}

function inviteBuyer() {
    if (!currentDeal) { showMessage('Ошибка', 'Сначала создайте сделку'); return; }
    const encodedData = encodeDealData(currentDeal);
    const dealLink = `https://t.me/TrustZipperBot?startapp=deal_DATA_${encodedData}`;
    safeCopyToClipboard(dealLink);
    showMessage('Ссылка скопирована', 'Отправьте эту ссылку покупателю');
}

// ========== СОЗДАНИЕ СДЕЛКИ ==========
function createDeal() {
    try {
        const nameInput = document.getElementById('dealName');
        const amountInput = document.getElementById('amount');
        if (!nameInput || !amountInput) { showMessage('Ошибка', 'Ошибка формы'); return; }
        const name = nameInput.value.trim();
        let amount = parseFloat(amountInput.value);
        if (isNaN(amount)) { showMessage('Ошибка', 'Введите сумму цифрами'); return; }
        const feePayerElem = document.querySelector('input[name="feePayer"]:checked');
        const feePayer = feePayerElem ? feePayerElem.value : 'buyer';
        if (!name) { showMessage('Ошибка', 'Введите название сделки'); return; }
        if (amount < 0.1) { showMessage('Ошибка', 'Минимальная сумма 0.1'); return; }
        const finalAmount = calculateAmountWithFee(amount, feePayer);
        const sellerUsername = currentUser.username ? `@${currentUser.username}` : `user_${currentUser.id}`;
        currentDeal = {
            id: generateDealId(), name: name, amount: finalAmount, currency: selectedCurrency,
            sellerId: currentUser.id, sellerUsername: sellerUsername, createdAt: getFormattedDate(), status: 'waiting_buyer'
        };
        deals.push(currentDeal);
        saveDeals();
        renderHistoryList();
        if (document.getElementById('dealCreatedAmount')) document.getElementById('dealCreatedAmount').textContent = formatAmount(currentDeal.amount, currentDeal.currency);
        if (document.getElementById('dealCreatedId')) document.getElementById('dealCreatedId').textContent = currentDeal.id;
        if (document.getElementById('dealCreatedDesc')) document.getElementById('dealCreatedDesc').textContent = currentDeal.name;
        showScreenById('dealCreatedScreen');
        if (nameInput) nameInput.value = '';
        if (amountInput) amountInput.value = '';
    } catch(e) { console.error('createDeal error:', e); showMessage('Ошибка', 'Ошибка создания сделки'); }
}

// ========== ОБРАБОТКА ССЫЛКИ (ГЛАВНЫЙ ФИКС!) ==========
let linkProcessed = false;

function processStartParam() {
    if (linkProcessed) return;
    let startParam = getStartParam();
    console.log('processStartParam:', startParam);
    
    if (!startParam) { showScreenById('mainScreen'); return; }
    
    // НОВЫЙ ФОРМАТ: pay_DATA_... или deal_DATA_... (ДАННЫЕ В ССЫЛКЕ!)
    if (startParam.includes('_DATA_')) {
        let parts = startParam.split('_DATA_');
        if (parts.length >= 2) {
            let encodedData = parts.slice(1).join('_DATA_');
            let deal = decodeDealData(encodedData);
            if (deal) {
                linkProcessed = true;
                if (!deals.find(d => d.id === deal.id)) { deals.push(deal); saveDeals(); }
                openPaymentScreen(deal);
                return;
            }
        }
    }
    
    // СТАРЫЙ ФОРМАТ (для совместимости)
    if (startParam.startsWith('pay_') && !startParam.includes('_DATA_')) {
        let cleanId = startParam.replace('pay_', '');
        let dealId = '#' + cleanId;
        let deal = deals.find(d => d.id === dealId);
        if (deal) { linkProcessed = true; openPaymentScreen(deal); return; }
        else { showMessage('Ошибка', 'Сделка не найдена. Создайте новую сделку'); showScreenById('mainScreen'); return; }
    }
    
    showScreenById('mainScreen');
}

// ========== ИКОНКИ ==========
function renderAddUserIcon() { const c = document.getElementById('addUserIcon'); if (c) c.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M9.92234 21.8084C6.10834 21.8084 2.85034 21.2314 2.85034 18.9214C2.85034 16.6114 6.08734 14.5104 9.92234 14.5104C13.7363 14.5104 16.9943 16.5914 16.9943 18.9004C16.9943 21.2094 13.7573 21.8084 9.92234 21.8084Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path fill-rule="evenodd" clip-rule="evenodd" d="M9.92243 11.216C12.4254 11.216 14.4554 9.18602 14.4554 6.68302C14.4554 4.17902 12.4254 2.15002 9.92243 2.15002C7.41943 2.15002 5.38943 4.17902 5.38943 6.68302C5.38043 9.17702 7.39643 11.207 9.89043 11.216H9.92243Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M19.1313 8.12915V12.1392" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M21.1776 10.1339H17.0876" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`; }
function renderInfoIcon() { const c = document.getElementById('infoIcon'); if (c) c.innerHTML = `<svg width="20" height="21" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M18.6963 19.696C19.9193 18.473 20.5002 16.4268 20.5002 12.9999C20.5002 9.57301 19.9193 7.52684 18.6963 6.30386C17.4733 5.08089 15.4271 4.49991 12.0002 4.49991C8.57334 4.49991 6.52717 5.08089 5.3042 6.30386C4.08123 7.52684 3.50024 9.57301 3.50024 12.9999C3.50024 16.4268 4.08123 18.473 5.3042 19.696C6.52717 20.9189 8.57334 21.4999 12.0002 21.4999C15.4271 21.4999 17.4733 20.9189 18.6963 19.696ZM19.7569 20.7566C18.0892 22.4244 15.5103 22.9999 12.0002 22.9999C8.49015 22.9999 5.91132 22.4244 4.24354 20.7566C2.57576 19.0888 2.00024 16.51 2.00024 12.9999C2.00024 9.48981 2.57576 6.91098 4.24354 5.2432C5.91132 3.57543 8.49015 2.99991 12.0002 2.99991C15.5103 2.99991 18.0892 3.57543 19.7569 5.2432C21.4247 6.91098 22.0002 9.48981 22.0002 12.9999C22.0002 16.51 21.4247 19.0888 19.7569 20.7566Z" fill="#FFFFFF"/><path fill-rule="evenodd" clip-rule="evenodd" d="M12.0002 17.645C11.586 17.645 11.2502 17.3092 11.2502 16.895V13C11.2502 12.5858 11.586 12.25 12.0002 12.25C12.4145 12.25 12.7502 12.5858 12.7502 13V16.895C12.7502 17.3092 12.4145 17.645 12.0002 17.645Z" fill="#FFFFFF"/><path fill-rule="evenodd" clip-rule="evenodd" d="M12.7546 9.5C12.7546 9.91421 12.4189 10.25 12.0046 10.25H11.9956C11.5814 10.25 11.2456 9.91421 11.2456 9.5C11.2456 9.08579 11.5814 8.75 11.9956 8.75H12.0046C12.4189 8.75 12.7546 9.08579 12.7546 9.5Z" fill="#FFFFFF"/></svg>`; }
function renderProfileIcon() { const c = document.getElementById('profileIcon'); if (c) c.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7.17048 12.5317C3.30286 12.5317 -4.08562e-14 13.1165 -4.08562e-14 15.4584C-4.08562e-14 17.8003 3.2819 18.406 7.17048 18.406C11.0381 18.406 14.34 17.8203 14.34 15.4793C14.34 13.1384 11.059 12.5317 7.17048 12.5317Z"/><path d="M7.17048 9.19143C9.70857 9.19143 11.7657 7.13333 11.7657 4.59524C11.7657 2.05714 9.70857 -5.32907e-15 7.17048 -5.32907e-15C4.63238 -5.32907e-15 2.57426 2.05714 2.57426 4.59524C2.56571 7.12476 4.60952 9.18286 7.1381 9.19143L7.17048 9.19143Z"/></g></svg>`; }
function renderChartIcon() { const c = document.getElementById('chartIcon'); if (c) c.innerHTML = `<svg width="20" height="21" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M7.48315 10.5109C7.89737 10.5109 8.23315 10.8467 8.23315 11.2609V17.9546C8.23315 18.3688 7.89737 18.7046 7.48315 18.7046C7.06894 18.7046 6.73315 18.3688 6.73315 17.9546V11.2609C6.73315 10.8467 7.06894 10.5109 7.48315 10.5109Z" fill="#FFFFFF"/><path fill-rule="evenodd" clip-rule="evenodd" d="M12.0369 7.30734C12.4511 7.30734 12.7869 7.64313 12.7869 8.05734V17.9552C12.7869 18.3695 12.4511 18.7052 12.0369 18.7052C11.6227 18.7052 11.2869 18.3695 11.2869 17.9552V8.05734C11.2869 7.64313 11.6227 7.30734 12.0369 7.30734Z" fill="#FFFFFF"/><path fill-rule="evenodd" clip-rule="evenodd" d="M16.5157 14.0482C16.93 14.0482 17.2657 14.384 17.2657 14.7982V17.955C17.2657 18.3692 16.93 18.705 16.5157 18.705C16.1015 18.705 15.7657 18.3692 15.7657 17.955V14.7982C15.7657 14.384 16.1015 14.0482 16.5157 14.0482Z" fill="#FFFFFF"/><path fill-rule="evenodd" clip-rule="evenodd" d="M4.96051 5.96045C3.66147 7.25949 3.05005 9.42738 3.05005 13.0368C3.05005 16.6463 3.66147 18.8142 4.96051 20.1132C6.25956 21.4123 8.42744 22.0237 12.0369 22.0237C15.6463 22.0237 17.8142 21.4123 19.1133 20.1132C20.4123 18.8142 21.0237 16.6463 21.0237 13.0368C21.0237 9.42738 20.4123 7.25949 19.1133 5.96045C17.8142 4.6614 15.6463 4.04999 12.0369 4.04999C8.42744 4.04999 6.25956 4.6614 4.96051 5.96045ZM3.89985 4.89979C5.6437 3.15594 8.34424 2.54999 12.0369 2.54999C15.7295 2.54999 18.4301 3.15594 20.1739 4.89979C21.9178 6.64364 22.5237 9.34418 22.5237 13.0368C22.5237 16.7295 21.9178 19.43 20.1739 21.1739C18.4301 22.9177 15.7295 23.5237 12.0369 23.5237C8.34424 23.5237 5.6437 22.9177 3.89985 21.1739C2.156 19.43 1.55005 16.7295 1.55005 13.0368C1.55005 9.34418 2.156 6.64364 3.89985 4.89979Z" fill="#FFFFFF"/></svg>`; }
function renderWalletIcon() { const c = document.getElementById('walletIcon'); if (c) c.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19.1389 11.3958L15.0906 11.3958C13.6042 11.3949 12.3994 10.1909 12.3985 8.70449C12.3985 7.21805 13.6042 6.01413 15.0906 6.01321L19.1389 6.01321"/><line x1="15.5486" y1="8.64288" x2="15.2369" y2="8.64288"/><path d="M5.24766 0L13.8911 0C16.7892 0 19.1388 2.34951 19.1388 5.24766L19.1388 12.4247C19.1388 15.3229 16.7892 17.6724 13.8911 17.6724L5.24766 17.6724C2.34951 17.6724 0 15.3229 0 12.4247L0 5.24766C0 2.34951 2.34951 0 5.24766 0Z"/><line x1="4.53561" y1="4.53816" x2="9.93456" y2="4.53816"/></g></svg>`; }
function renderWorkIcon() { const c = document.getElementById('workIcon'); if (c) c.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.9612 16.5168V13.8888" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M21.0895 11.4777L21.0605 11.4987C18.6385 12.9907 15.4405 13.8917 11.9565 13.8917C8.47252 13.8917 5.28352 12.9907 2.86252 11.4987L2.83252 11.4777" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path fill-rule="evenodd" clip-rule="evenodd" d="M2.75024 13.3507C2.75024 7.19871 5.05324 5.14771 11.9612 5.14771C18.8702 5.14771 21.1722 7.19871 21.1722 13.3507C21.1722 19.5027 18.8702 21.5537 11.9612 21.5537C5.05324 21.5537 2.75024 19.5027 2.75024 13.3507Z" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.2237 5.36932V4.73932C15.2237 3.47532 14.3007 2.45032 13.1637 2.45032H10.7587C9.62173 2.45032 8.69873 3.47532 8.69873 4.73932V5.36932" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`; }
function renderNotificationIcon() { const c = document.getElementById('notificationIcon'); if (c) c.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18.5586 13.3986C18.5586 15.2846 19.1326 17.1266 20.2026 18.6796H4.29761C5.36861 17.1266 5.94161 15.2846 5.94161 13.3986V10.6056C5.94161 7.12163 8.76561 4.29663 12.2506 4.29663C15.4016 4.29663 18.0136 6.60763 18.4836 9.62763" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"/><path d="M12.2505 4.29667V2.13867" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"/><path d="M15.4802 18.6797V18.9097C15.4802 20.6927 14.0342 22.1387 12.2512 22.1387C10.4682 22.1387 9.02319 20.6927 9.02319 18.9097V18.6797" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"/></svg>`; }
function renderGiftIcon() { const c = document.getElementById('giftIcon'); if (c) c.innerHTML = `<svg width="34" height="34" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" clipRule="evenodd" d="M12.7507 7.93699H8.70116C7.4577 7.93699 6.45068 6.92997 6.45068 5.68651C6.45068 4.44501 7.4577 3.43701 8.70116 3.43701C11.8507 3.43701 12.7507 7.93699 12.7507 7.93699Z" stroke="url(#grad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path fillRule="evenodd" clipRule="evenodd" d="M12.752 7.93699H16.8011C18.0445 7.93699 19.0515 6.92997 19.0515 5.68651C19.0515 4.44501 18.0445 3.43701 16.8011 3.43701C13.6516 3.43701 12.752 7.93699 12.752 7.93699Z" stroke="url(#grad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M5.7542 7.96436H19.6384C20.6756 7.96436 21.5163 8.805 21.5163 9.84218V10.6585C21.5163 11.6373 20.7223 12.4303 19.7445 12.4303H5.86025C4.82307 12.4303 3.98242 11.5896 3.98242 10.5534V9.73516C3.98242 8.75732 4.77539 7.96436 5.7542 7.96436Z" stroke="url(#grad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M19.973 12.4565V18.9647C19.973 20.3288 18.8677 21.4351 17.5036 21.4351H7.99771C6.63361 21.4351 5.52734 20.3288 5.52734 18.9647V12.4565" stroke="url(#grad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M12.75 21.4373V12.5347" stroke="url(#grad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#a855f7"/></linearGradient></defs></svg>`; }
function renderShieldIcon() { const c = document.getElementById('shieldIcon'); if (c) c.innerHTML = `<svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4.31245 12.879C4.31245 19.283 11.9845 21.606 11.9845 21.606C11.9845 21.606 19.6565 19.283 19.6565 12.879C19.6565 6.474 19.9345 5.974 19.3195 5.358C18.7035 4.742 12.9905 2.75 11.9845 2.75C10.9785 2.75 5.26545 4.742 4.65045 5.358C4.13767 5.87079 4.2445 5.17473 4.29467 9" stroke="#22c55e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.38574 11.8746L11.2777 13.7696L15.1757 9.8696" stroke="#22c55e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`; }

// ========== ИНИЦИАЛИЗАЦИЯ ==========
document.addEventListener('DOMContentLoaded', () => {
    try {
        document.getElementById('createDealBtn').onclick = () => showScreenById('createDealScreen');
        document.getElementById('submitDealBtn').onclick = createDeal;
        document.getElementById('copyPaymentLinkBtn').onclick = copyPaymentLink;
        document.getElementById('copyDealIdBtn').onclick = copyDealId;
        document.getElementById('inviteBuyerBtn').onclick = inviteBuyer;
        document.getElementById('openPaymentOptionsBtn').onclick = togglePaymentOptions;
        document.getElementById('copyCardNumberBtn').onclick = copyCardNumber;
        document.getElementById('copyWalletBtn').onclick = copyWalletAddress;
        document.getElementById('confirmCardPaymentBtn').onclick = confirmCardPayment;
        document.getElementById('confirmCryptoPaymentBtn').onclick = confirmCryptoPayment;
        document.getElementById('backToDealFromPayment').onclick = () => showScreenById('mainScreen');
        
        const backButtons = {
            'backToMainFromJoin': 'mainScreen', 'backToMainFromInfo': 'mainScreen', 'backToMainFromSupport': 'mainScreen',
            'backToMainFromCreate': 'mainScreen', 'backToMainFromProgress': 'mainScreen', 'backToMainFromSuccess': 'mainScreen',
            'backToMainFromDealCreated': 'mainScreen', 'backToMainFromDealCreatedBtn': 'mainScreen', 'cancelCreateBtn': 'mainScreen',
            'backToMainFromWallet': 'mainScreen', 'backToMainFromHistory': 'mainScreen', 'backToMainFromReferral': 'mainScreen',
            'backToWalletFromCard': 'walletScreen', 'backToWalletFromCrypto': 'walletScreen', 'backToWalletFromTon': 'walletScreen',
            'backToWalletFromList': 'walletScreen', 'backToCryptoSelect': 'selectCryptoScreen'
        };
        for (const [id, screen] of Object.entries(backButtons)) { const el = document.getElementById(id); if (el) el.onclick = () => showScreenById(screen); }
        
        document.querySelectorAll('[data-wallet-action="add_card"]').forEach(el => { el.onclick = () => showScreenById('addCardScreen'); });
        document.querySelectorAll('[data-wallet-action="add_crypto"]').forEach(el => { el.onclick = () => showScreenById('selectCryptoScreen'); });
        document.querySelectorAll('[data-wallet-action="add_ton"]').forEach(el => { el.onclick = () => showScreenById('addTonScreen'); });
        document.querySelectorAll('[data-wallet-action="list_wallets"]').forEach(el => { el.onclick = () => showScreenById('listWalletsScreen'); });
        
        document.getElementById('saveCardBtn').onclick = () => { const cardNumber = document.getElementById('cardNumber').value.trim(); if (!cardNumber) { showMessage('Ошибка', 'Введите номер'); return; } wallets.card = { address: cardNumber }; saveWallets(); showMessage('Успех', 'Карта сохранена'); showScreenById('walletScreen'); };
        
        document.querySelectorAll('[data-crypto-type]').forEach(el => { el.onclick = () => { pendingCryptoType = el.getAttribute('data-crypto-type'); const titles = { btc: 'Bitcoin', eth: 'Ethereum', usdt: 'USDT' }; const prompts = { btc: 'BTC адрес:', eth: 'ETH адрес:', usdt: 'USDT адрес:' }; document.getElementById('cryptoScreenTitle').textContent = `Добавление ${titles[pendingCryptoType]}`; document.getElementById('cryptoPrompt').textContent = prompts[pendingCryptoType]; showScreenById('addCryptoScreen'); }; });
        
        document.getElementById('saveCryptoBtn').onclick = () => { const address = document.getElementById('cryptoAddress').value.trim(); if (!address) { showMessage('Ошибка', 'Введите адрес'); return; } wallets[pendingCryptoType] = { address: address }; saveWallets(); showMessage('Успех', 'Кошелек сохранен'); showScreenById('walletScreen'); };
        document.getElementById('saveTonBtn').onclick = () => { const address = document.getElementById('tonAddress').value.trim(); if (!address) { showMessage('Ошибка', 'Введите адрес TON'); return; } wallets.ton = { address: address }; saveWallets(); showMessage('Успех', 'TON сохранен'); showScreenById('walletScreen'); };
        
        document.querySelectorAll('.currency-item').forEach(el => { el.onclick = () => { document.querySelectorAll('.currency-item').forEach(c => c.classList.remove('selected')); el.classList.add('selected'); selectedCurrency = el.getAttribute('data-currency'); }; });
        const firstCurrency = document.querySelector('.currency-item'); if (firstCurrency) firstCurrency.classList.add('selected');
        
        document.getElementById('additionalInfo')?.addEventListener('input', function(e) { const count = e.target.value.length; const charCount = document.getElementById('charCount'); if (charCount) charCount.textContent = `${count} / 20`; if (count > 20) e.target.value = e.target.value.slice(0, 20); });
        
        document.querySelectorAll('.radio-option').forEach(option => { option.addEventListener('click', function() { const radio = this.querySelector('input[type="radio"]'); if (radio && !radio.checked) { radio.checked = true; document.querySelectorAll('.radio-option').forEach(opt => opt.classList.remove('selected')); this.classList.add('selected'); } }); });
        
        document.querySelectorAll('[data-action="info"]').forEach(el => el.onclick = () => showScreenById('infoScreen'));
        document.querySelectorAll('[data-action="support"]').forEach(el => el.onclick = () => showScreenById('supportScreen'));
        document.querySelectorAll('[data-action="referral"]').forEach(el => el.onclick = () => showScreenById('referralScreen'));
        document.querySelectorAll('[data-action="wallet"]').forEach(el => el.onclick = () => showScreenById('walletScreen'));
        document.querySelectorAll('[data-action="history"]').forEach(el => el.onclick = () => showScreenById('historyScreen'));
        
        document.getElementById('copyReferralLinkBtn').onclick = copyReferralLink;
        
        const cardBlock = document.getElementById('cardPaymentBlock');
        const cryptoBlock = document.getElementById('cryptoPaymentBlock');
        if (cardBlock && !document.getElementById('switchToCryptoBtn')) { const btn = document.createElement('button'); btn.id = 'switchToCryptoBtn'; btn.textContent = 'Перейти к криптовалюте'; btn.className = 'btn btn-secondary mt-2'; btn.style.marginTop = '12px'; btn.onclick = switchToCrypto; cardBlock.appendChild(btn); }
        if (cryptoBlock && !document.getElementById('switchToCardBtn')) { const btn = document.createElement('button'); btn.id = 'switchToCardBtn'; btn.textContent = 'Перейти к оплате картой'; btn.className = 'btn btn-secondary mt-2'; btn.style.marginTop = '12px'; btn.onclick = switchToCard; cryptoBlock.appendChild(btn); }
        
        if (tg && tg.MainButton && tg.MainButton.hide) tg.MainButton.hide();
        if (tg && tg.BackButton && tg.BackButton.hide) tg.BackButton.hide();
        
        renderGiftIcon(); renderShieldIcon(); renderWorkIcon(); renderNotificationIcon(); renderInfoIcon(); renderProfileIcon(); renderChartIcon(); renderWalletIcon(); renderAddUserIcon();
        
        // ГЛАВНОЕ - ОБРАБОТКА ССЫЛКИ
        const startParam = getStartParam();
        console.log('Start param:', startParam);
        pendingDealRequest = null;
        currentScreen = null;
        
        setTimeout(() => { processStartParam(); }, 200);
        
        if (tg && typeof tg.onEvent === 'function') { tg.onEvent('web_app_open', () => { setTimeout(() => { processStartParam(); }, 100); }); }
        
    } catch(e) { console.error('Initialization error:', e); showMessage('Ошибка', 'Ошибка инициализации'); showScreenById('mainScreen'); }
});

window.advanceProgress = function() {
    if (dealProgress < 4 && currentDeal) { dealProgress++; updateProgressDisplay(); if (dealProgress === 4 && currentDeal) { const index = deals.findIndex(d => d.id === currentDeal.id); if (index !== -1) deals[index].status = 'completed'; saveDeals(); renderHistoryList(); setTimeout(() => showScreenById('successScreen'), 500); } }
};

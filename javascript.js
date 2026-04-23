// ========== ИНИЦИАЛИЗАЦИЯ TELEGRAM WEB APP ==========
let tg;
try {
    tg = window.Telegram.WebApp;
    if (tg) {
        // Безопасный вызов expand
        if (typeof tg.expand === 'function') {
            try {
                tg.expand();
            } catch(e) {
                console.error('Expand error:', e);
            }
        }
        
        if (typeof tg.ready === 'function') {
            try {
                tg.ready();
            } catch(e) {
                console.error('Ready error:', e);
            }
        }
        
        document.body.style.backgroundColor = '#0a0c10';
        document.body.style.color = '#ffffff';
        
        try {
            if (typeof tg.setBackgroundColor === 'function') {
                tg.setBackgroundColor('#0a0c10');
            }
            if (typeof tg.setHeaderColor === 'function') {
                tg.setHeaderColor('#0a0c10');
            }
        } catch(e) {
            console.error('Color setting error:', e);
        }
    }
} catch(e) {
    console.error('Telegram init failed:', e);
    // Фолбэк для работы вне Telegram
    tg = {
        initDataUnsafe: { user: null },
        showPopup: (options) => alert(options.message),
        sendData: (data) => console.log('Send data:', data),
        MainButton: { hide: () => {}, show: () => {} },
        BackButton: { hide: () => {}, show: () => {} },
        onEvent: () => {},
        expand: () => {},
        ready: () => {}
    };
}

// ========== ТЁМНАЯ ТЕМА ==========
document.body.style.backgroundColor = '#0a0c10';
document.body.style.color = '#ffffff';

const BOT_USERNAME = 'TrustZipperBot';

// ========== БЕЗОПАСНЫЙ currentUser ==========
const currentUser = (tg.initDataUnsafe && tg.initDataUnsafe.user) ? tg.initDataUnsafe.user : { 
    id: Date.now(),
    username: 'user_' + Math.floor(Math.random() * 10000),
    first_name: 'Пользователь' 
};

// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
let wallets = {};
let deals = [];
let currentDeal = null;
let dealProgress = 0;
let selectedCurrency = 'USDT';
let updateInterval = null;
let pendingCryptoType = null;
let currentScreen = null;

const currencySymbols = { 'TON': 'TON', 'USDT': 'USDT', 'RUB': '₽', 'STARS': '★', 'UAH': '₴', 'EUR': '€' };

// ========== БЕЗОПАСНОЕ ХРАНЕНИЕ ==========
try {
    wallets = JSON.parse(localStorage.getItem('trustzipper_wallets')) || {};
    deals = JSON.parse(localStorage.getItem('trustzipper_deals')) || [];
} catch(e) {
    console.error('Storage error:', e);
    wallets = {};
    deals = [];
}

// ========== ФУНКЦИИ ХРАНЕНИЯ ==========
function saveWallets() {
    try {
        localStorage.setItem('trustzipper_wallets', JSON.stringify(wallets));
    } catch(e) {
        console.error('Save wallets error:', e);
    }
}

function saveDeals() {
    try {
        localStorage.setItem('trustzipper_deals', JSON.stringify(deals));
    } catch(e) {
        console.error('Save deals error:', e);
    }
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

// ========== ОСНОВНЫЕ ФУНКЦИИ ==========
function saveDeal(deal) {
    deals.push(deal);
    saveDeals();
    renderHistoryList();
    
    if (tg && typeof tg.sendData === 'function') {
        try {
            tg.sendData(JSON.stringify({
                action: 'create_deal',
                deal: {
                    id: deal.id,
                    name: deal.name,
                    amount: deal.amount,
                    currency: deal.currency,
                    seller_id: deal.sellerId,
                    seller_username: deal.sellerUsername,
                    created_at: deal.createdAt,
                    status: deal.status
                }
            }));
        } catch(e) {
            console.error('Send data error:', e);
        }
    }
}

function updateDealStatus(dealId, status) {
    const index = deals.findIndex(d => d.id === dealId);
    if (index !== -1) {
        deals[index].status = status;
        saveDeals();
        renderHistoryList();
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
                    <div class="wallet-address">${data.address}</div>
                    <span class="delete-wallet" data-wallet-type="${type}">🗑 Удалить</span>
                </div>`;
    }
    container.innerHTML = html;
    
    document.querySelectorAll('.delete-wallet').forEach(el => {
        el.addEventListener('click', (e) => {
            const walletType = e.target.dataset.walletType;
            delete wallets[walletType];
            saveWallets();
            renderWalletsList();
            if (tg && typeof tg.showPopup === 'function') {
                tg.showPopup({ title: 'Удалено', message: 'Кошелек удален', buttons: [{ type: 'ok' }] });
            }
        });
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
    for (const deal of [...userDeals].reverse()) {
        let statusText = '', statusClass = '';
        switch(deal.status) {
            case 'completed': statusText = '✅ Завершена'; statusClass = 'status-completed'; break;
            case 'paid': statusText = '🟣 Оплата подтверждена'; statusClass = 'status-paid'; break;
            case 'waiting_buyer': statusText = '⏳ Ожидание покупателя'; statusClass = 'status-waiting'; break;
            default: statusText = '⏳ В процессе'; statusClass = 'status-waiting';
        }
        html += `<div class="deal-history-item">
                    <div class="flex-between mb-1">
                        <strong>${deal.name}</strong>
                        <span class="deal-status ${statusClass}">${statusText}</span>
                    </div>
                    <div class="flex-between mb-1">
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
    
    if (dealProgress === 0) {
        if (waitingBuyerDiv) waitingBuyerDiv.classList.remove('hidden');
        if (progressStepsDiv) progressStepsDiv.classList.add('hidden');
    } else {
        if (waitingBuyerDiv) waitingBuyerDiv.classList.add('hidden');
        if (progressStepsDiv) progressStepsDiv.classList.remove('hidden');
        
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
        const refLink = `https://t.me/${BOT_USERNAME}?start=ref_${currentUser.id}`;
        linkInput.value = refLink;
    }
}

function copyReferralLink() {
    const linkInput = document.getElementById('referralLinkInput');
    if (linkInput && linkInput.value) {
        navigator.clipboard.writeText(linkInput.value);
        if (tg && typeof tg.showPopup === 'function') {
            tg.showPopup({ title: 'Скопировано', message: 'Реферальная ссылка скопирована', buttons: [{ type: 'ok' }] });
        }
    }
}

// ========== ПРИСОЕДИНЕНИЕ К СДЕЛКЕ ==========
function joinDeal() {
    const dealId = document.getElementById('joinDealIdInput').value.trim();
    if (!dealId) {
        if (tg && typeof tg.showPopup === 'function') {
            tg.showPopup({ title: 'Ошибка', message: 'Введите ID сделки', buttons: [{ type: 'ok' }] });
        }
        return;
    }
    
    let deal = deals.find(d => d.id === dealId);
    if (deal) {
        openDeal(deal);
    } else {
        if (tg && typeof tg.showPopup === 'function') {
            tg.showPopup({ title: 'Поиск', message: 'Ищем сделку...', buttons: [{ type: 'ok' }] });
        }
        if (tg && typeof tg.sendData === 'function') {
            tg.sendData(JSON.stringify({
                action: 'get_deal',
                deal_id: dealId
            }));
        }
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
    const dealCreatedDesc = document.getElementById('dealCreatedDesc');
    const dealCreatedId = document.getElementById('dealCreatedId');
    
    if (dealCreatedAmount) dealCreatedAmount.textContent = formatAmount(deal.amount, deal.currency);
    if (dealCreatedDesc) dealCreatedDesc.textContent = deal.name;
    if (dealCreatedId) dealCreatedId.textContent = deal.id;

    dealProgress = 1;
    updateProgressDisplay();
    
    if (deal.sellerId === currentUser.id) {
        showScreenById('dealCreatedScreen');
    } else {
        showScreenById('dealProgressScreen');
    }

    if (tg && typeof tg.sendData === 'function') {
        tg.sendData(JSON.stringify({
            action: 'join_deal',
            deal_id: deal.id,
            buyer_id: currentUser.id,
            buyer_username: currentUser.username || `id${currentUser.id}`
        }));
    }
}

// ========== КОПИРОВАНИЕ ID И ССЫЛОК ==========
function copyDealId() {
    if (!currentDeal) {
        if (tg && typeof tg.showPopup === 'function') {
            tg.showPopup({ title: 'Ошибка', message: 'Сначала создайте сделку', buttons: [{ type: 'ok' }] });
        }
        return;
    }
    navigator.clipboard.writeText(currentDeal.id);
    if (tg && typeof tg.showPopup === 'function') {
        tg.showPopup({ title: 'Скопировано', message: `ID сделки ${currentDeal.id} скопирован`, buttons: [{ type: 'ok' }] });
    }
}

function copyPaymentLink() {
    if (!currentDeal || !currentDeal.id) {
        if (tg && typeof tg.showPopup === 'function') {
            tg.showPopup({ title: 'Ошибка', message: 'Сначала создайте сделку', buttons: [{ type: 'ok' }] });
        }
        return;
    }
    const link = `https://t.me/${BOT_USERNAME}?start=pay_${currentDeal.id.replace('#', '')}`;
    navigator.clipboard.writeText(link);
    if (tg && typeof tg.showPopup === 'function') {
        tg.showPopup({ title: 'Скопировано', message: 'Ссылка для оплаты скопирована', buttons: [{ type: 'ok' }] });
    }
}

function inviteBuyer() {
    if (!currentDeal) {
        if (tg && typeof tg.showPopup === 'function') {
            tg.showPopup({ title: 'Ошибка', message: 'Сначала создайте сделку', buttons: [{ type: 'ok' }] });
        }
        return;
    }
    const link = `https://t.me/${BOT_USERNAME}?start=deal_${currentDeal.id.replace('#', '')}`;
    navigator.clipboard.writeText(link);
    if (tg && typeof tg.showPopup === 'function') {
        tg.showPopup({
            title: 'Ссылка скопирована',
            message: `Ссылка для покупателя:\n${link}\n\nПосле того как покупатель перейдет по ссылке, его username появится в поле "Покупатель".`,
            buttons: [{ type: 'ok' }]
        });
    }
}

// ========== СОЗДАНИЕ СДЕЛКИ ==========
function createDeal() {
    const name = document.getElementById('dealName').value;
    let amount = parseFloat(document.getElementById('amount').value);
    const dealType = document.querySelector('input[name="dealType"]:checked')?.value || 'normal';
    const feePayer = document.querySelector('input[name="feePayer"]:checked')?.value || 'buyer';
    const additionalInfo = document.getElementById('additionalInfo').value;

    if (!name) {
        if (tg && typeof tg.showPopup === 'function') {
            tg.showPopup({ title: 'Ошибка', message: 'Введите название сделки', buttons: [{ type: 'ok' }] });
        }
        return;
    }
    if (!amount || amount < 0.1) {
        if (tg && typeof tg.showPopup === 'function') {
            tg.showPopup({ title: 'Ошибка', message: 'Минимальная сумма: 0.1', buttons: [{ type: 'ok' }] });
        }
        return;
    }

    const finalAmount = calculateAmountWithFee(amount, feePayer);
    const sellerUsername = currentUser.username ? `@${currentUser.username}` : `id${currentUser.id}`;

    currentDeal = {
        id: generateDealId(),
        name: name,
        originalAmount: amount,
        amount: finalAmount,
        currency: selectedCurrency,
        dealType: dealType,
        feePayer: feePayer,
        additionalInfo: additionalInfo,
        sellerId: currentUser.id,
        sellerUsername: sellerUsername,
        sellerName: currentUser.first_name || 'Продавец',
        createdAt: getFormattedDate(),
        status: 'waiting_buyer'
    };

    saveDeal(currentDeal);

    const dealNameEl = document.getElementById('dealNameValue');
    const dealAmountEl = document.getElementById('dealAmount');
    const sellerNameEl = document.getElementById('sellerName');
    const buyerNameEl = document.getElementById('buyerName');
    const createdDateEl = document.getElementById('createdDate');
    const dealIdEl = document.getElementById('dealIdValue');
    
    if (dealNameEl) dealNameEl.textContent = currentDeal.name;
    if (dealAmountEl) dealAmountEl.textContent = formatAmount(currentDeal.amount, currentDeal.currency);
    if (sellerNameEl) sellerNameEl.textContent = currentDeal.sellerUsername;
    if (buyerNameEl) buyerNameEl.textContent = 'Ожидается';
    if (createdDateEl) createdDateEl.textContent = currentDeal.createdAt;
    if (dealIdEl) dealIdEl.textContent = currentDeal.id;

    const dealCreatedAmount = document.getElementById('dealCreatedAmount');
    const dealCreatedDesc = document.getElementById('dealCreatedDesc');
    const dealCreatedId = document.getElementById('dealCreatedId');
    
    if (dealCreatedAmount) dealCreatedAmount.textContent = formatAmount(currentDeal.amount, currentDeal.currency);
    if (dealCreatedDesc) dealCreatedDesc.textContent = currentDeal.name;
    if (dealCreatedId) dealCreatedId.textContent = currentDeal.id;

    dealProgress = 0;
    updateProgressDisplay();
    
    showScreenById('dealCreatedScreen');
}

// ========== ОБРАБОТКА ДАННЫХ ОТ БОТА ==========
if (tg && typeof tg.onEvent === 'function') {
    tg.onEvent('web_app_data_sent', (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('Получены данные от бота:', data);

            if (data.action === 'deal_data') {
                const deal = {
                    id: data.id,
                    name: data.description || 'Без названия',
                    amount: data.amount,
                    currency: data.currency,
                    sellerUsername: data.seller_username,
                    sellerId: data.seller_id,
                    createdAt: data.created_at || getFormattedDate(),
                    status: data.status
                };
                openDeal(deal);
            } else if (data.action === 'deal_not_found') {
                if (tg && typeof tg.showPopup === 'function') {
                    tg.showPopup({ title: 'Ошибка', message: 'Сделка не найдена', buttons: [{ type: 'ok' }] });
                }
            } else if (data.action === 'joined_deal') {
                console.log('Успешно присоединились к сделке', data.deal_id);
            } else if (data.action === 'payment_confirmed') {
                if (currentDeal && currentDeal.id === data.deal_id) {
                    dealProgress = 2;
                    updateProgressDisplay();
                    updateDealStatus(currentDeal.id, 'paid');
                    if (tg && typeof tg.showPopup === 'function') {
                        tg.showPopup({ title: 'Оплата подтверждена', message: 'Администратор подтвердил оплату. Можете отправлять NFT.', buttons: [{ type: 'ok' }] });
                    }
                }
            } else if (data.action === 'deal_status_update') {
                if (currentDeal && currentDeal.id === data.deal_id) {
                    switch(data.status) {
                        case 'paid': 
                            dealProgress = 2; 
                            updateDealStatus(currentDeal.id, 'paid'); 
                            break;
                        case 'completed': 
                            dealProgress = 4; 
                            updateDealStatus(currentDeal.id, 'completed'); 
                            updateProgressDisplay(); 
                            setTimeout(() => showScreenById('successScreen'), 500); 
                            break;
                    }
                    updateProgressDisplay();
                }
            }
        } catch (e) { 
            console.error('Ошибка обработки данных:', e); 
        }
    });
}

// ========== ОТРИСОВКА ИКОНОК ==========
function renderAddUserIcon() {
    const container = document.getElementById('addUserIcon');
    if (!container) return;
    container.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M9.92234 21.8084C6.10834 21.8084 2.85034 21.2314 2.85034 18.9214C2.85034 16.6114 6.08734 14.5104 9.92234 14.5104C13.7363 14.5104 16.9943 16.5914 16.9943 18.9004C16.9943 21.2094 13.7573 21.8084 9.92234 21.8084Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path fill-rule="evenodd" clip-rule="evenodd" d="M9.92243 11.216C12.4254 11.216 14.4554 9.18602 14.4554 6.68302C14.4554 4.17902 12.4254 2.15002 9.92243 2.15002C7.41943 2.15002 5.38943 4.17902 5.38943 6.68302C5.38043 9.17702 7.39643 11.207 9.89043 11.216H9.92243Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M19.1313 8.12915V12.1392" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M21.1776 10.1339H17.0876" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
}

function renderInfoIcon() {
    const container = document.getElementById('infoIcon');
    if (!container) return;
    container.innerHTML = `<svg width="20" height="21" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M18.6963 19.696C19.9193 18.473 20.5002 16.4268 20.5002 12.9999C20.5002 9.57301 19.9193 7.52684 18.6963 6.30386C17.4733 5.08089 15.4271 4.49991 12.0002 4.49991C8.57334 4.49991 6.52717 5.08089 5.3042 6.30386C4.08123 7.52684 3.50024 9.57301 3.50024 12.9999C3.50024 16.4268 4.08123 18.473 5.3042 19.696C6.52717 20.9189 8.57334 21.4999 12.0002 21.4999C15.4271 21.4999 17.4733 20.9189 18.6963 19.696ZM19.7569 20.7566C18.0892 22.4244 15.5103 22.9999 12.0002 22.9999C8.49015 22.9999 5.91132 22.4244 4.24354 20.7566C2.57576 19.0888 2.00024 16.51 2.00024 12.9999C2.00024 9.48981 2.57576 6.91098 4.24354 5.2432C5.91132 3.57543 8.49015 2.99991 12.0002 2.99991C15.5103 2.99991 18.0892 3.57543 19.7569 5.2432C21.4247 6.91098 22.0002 9.48981 22.0002 12.9999C22.0002 16.51 21.4247 19.0888 19.7569 20.7566Z" fill="#FFFFFF"/>
        <path fill-rule="evenodd" clip-rule="evenodd" d="M12.0002 17.645C11.586 17.645 11.2502 17.3092 11.2502 16.895V13C11.2502 12.5858 11.586 12.25 12.0002 12.25C12.4145 12.25 12.7502 12.5858 12.7502 13V16.895C12.7502 17.3092 12.4145 17.645 12.0002 17.645Z" fill="#FFFFFF"/>
        <path fill-rule="evenodd" clip-rule="evenodd" d="M12.7546 9.5C12.7546 9.91421 12.4189 10.25 12.0046 10.25H11.9956C11.5814 10.25 11.2456 9.91421 11.2456 9.5C11.2456 9.08579 11.5814 8.75 11.9956 8.75H12.0046C12.4189 8.75 12.7546 9.08579 12.7546 9.5Z" fill="#FFFFFF"/>
    </svg>`;
}

function renderProfileIcon() {
    const container = document.getElementById('profileIcon');
    if (!container) return;
    container.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M7.17048 12.5317C3.30286 12.5317 -4.08562e-14 13.1165 -4.08562e-14 15.4584C-4.08562e-14 17.8003 3.2819 18.406 7.17048 18.406C11.0381 18.406 14.34 17.8203 14.34 15.4793C14.34 13.1384 11.059 12.5317 7.17048 12.5317Z"/>
            <path d="M7.17048 9.19143C9.70857 9.19143 11.7657 7.13333 11.7657 4.59524C11.7657 2.05714 9.70857 -5.32907e-15 7.17048 -5.32907e-15C4.63238 -5.32907e-15 2.57426 2.05714 2.57426 4.59524C2.56571 7.12476 4.60952 9.18286 7.1381 9.19143L7.17048 9.19143Z"/>
        </g>
    </svg>`;
}

function renderChartIcon() {
    const container = document.getElementById('chartIcon');
    if (!container) return;
    container.innerHTML = `<svg width="20" height="21" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M7.48315 10.5109C7.89737 10.5109 8.23315 10.8467 8.23315 11.2609V17.9546C8.23315 18.3688 7.89737 18.7046 7.48315 18.7046C7.06894 18.7046 6.73315 18.3688 6.73315 17.9546V11.2609C6.73315 10.8467 7.06894 10.5109 7.48315 10.5109Z" fill="#FFFFFF"/>
        <path fill-rule="evenodd" clip-rule="evenodd" d="M12.0369 7.30734C12.4511 7.30734 12.7869 7.64313 12.7869 8.05734V17.9552C12.7869 18.3695 12.4511 18.7052 12.0369 18.7052C11.6227 18.7052 11.2869 18.3695 11.2869 17.9552V8.05734C11.2869 7.64313 11.6227 7.30734 12.0369 7.30734Z" fill="#FFFFFF"/>
        <path fill-rule="evenodd" clip-rule="evenodd" d="M16.5157 14.0482C16.93 14.0482 17.2657 14.384 17.2657 14.7982V17.955C17.2657 18.3692 16.93 18.705 16.5157 18.705C16.1015 18.705 15.7657 18.3692 15.7657 17.955V14.7982C15.7657 14.384 16.1015 14.0482 16.5157 14.0482Z" fill="#FFFFFF"/>
        <path fill-rule="evenodd" clip-rule="evenodd" d="M4.96051 5.96045C3.66147 7.25949 3.05005 9.42738 3.05005 13.0368C3.05005 16.6463 3.66147 18.8142 4.96051 20.1132C6.25956 21.4123 8.42744 22.0237 12.0369 22.0237C15.6463 22.0237 17.8142 21.4123 19.1133 20.1132C20.4123 18.8142 21.0237 16.6463 21.0237 13.0368C21.0237 9.42738 20.4123 7.25949 19.1133 5.96045C17.8142 4.6614 15.6463 4.04999 12.0369 4.04999C8.42744 4.04999 6.25956 4.6614 4.96051 5.96045ZM3.89985 4.89979C5.6437 3.15594 8.34424 2.54999 12.0369 2.54999C15.7295 2.54999 18.4301 3.15594 20.1739 4.89979C21.9178 6.64364 22.5237 9.34418 22.5237 13.0368C22.5237 16.7295 21.9178 19.43 20.1739 21.1739C18.4301 22.9177 15.7295 23.5237 12.0369 23.5237C8.34424 23.5237 5.6437 22.9177 3.89985 21.1739C2.156 19.43 1.55005 16.7295 1.55005 13.0368C1.55005 9.34418 2.156 6.64364 3.89985 4.89979Z" fill="#FFFFFF"/>
    </svg>`;
}

function renderWalletIcon() {
    const container = document.getElementById('walletIcon');
    if (!container) return;
    container.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19.1389 11.3958L15.0906 11.3958C13.6042 11.3949 12.3994 10.1909 12.3985 8.70449C12.3985 7.21805 13.6042 6.01413 15.0906 6.01321L19.1389 6.01321"/>
            <line x1="15.5486" y1="8.64288" x2="15.2369" y2="8.64288"/>
            <path d="M5.24766 0L13.8911 0C16.7892 0 19.1388 2.34951 19.1388 5.24766L19.1388 12.4247C19.1388 15.3229 16.7892 17.6724 13.8911 17.6724L5.24766 17.6724C2.34951 17.6724 0 15.3229 0 12.4247L0 5.24766C0 2.34951 2.34951 0 5.24766 0Z"/>
            <line x1="4.53561" y1="4.53816" x2="9.93456" y2="4.53816"/>
        </g>
    </svg>`;
}

function renderWorkIcon() {
    const container = document.getElementById('workIcon');
    if (!container) return;
    container.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M11.9612 16.5168V13.8888" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M21.0895 11.4777L21.0605 11.4987C18.6385 12.9907 15.4405 13.8917 11.9565 13.8917C8.47252 13.8917 5.28352 12.9907 2.86252 11.4987L2.83252 11.4777" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path fill-rule="evenodd" clip-rule="evenodd" d="M2.75024 13.3507C2.75024 7.19871 5.05324 5.14771 11.9612 5.14771C18.8702 5.14771 21.1722 7.19871 21.1722 13.3507C21.1722 19.5027 18.8702 21.5537 11.9612 21.5537C5.05324 21.5537 2.75024 19.5027 2.75024 13.3507Z" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M15.2237 5.36932V4.73932C15.2237 3.47532 14.3007 2.45032 13.1637 2.45032H10.7587C9.62173 2.45032 8.69873 3.47532 8.69873 4.73932V5.36932" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
}

function renderNotificationIcon() {
    const container = document.getElementById('notificationIcon');
    if (!container) return;
    container.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18.5586 13.3986C18.5586 15.2846 19.1326 17.1266 20.2026 18.6796H4.29761C5.36861 17.1266 5.94161 15.2846 5.94161 13.3986V10.6056C5.94161 7.12163 8.76561 4.29663 12.2506 4.29663C15.4016 4.29663 18.0136 6.60763 18.4836 9.62763" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"/>
        <path d="M12.2505 4.29667V2.13867" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"/>
        <path d="M15.4802 18.6797V18.9097C15.4802 20.6927 14.0342 22.1387 12.2512 22.1387C10.4682 22.1387 9.02319 20.6927 9.02319 18.9097V18.6797" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"/>
    </svg>`;
}

function renderGiftIcon() {
    const container = document.getElementById('giftIcon');
    if (!container) return;
    container.innerHTML = `<svg width="34" height="34" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fillRule="evenodd" clipRule="evenodd" d="M12.7507 7.93699H8.70116C7.4577 7.93699 6.45068 6.92997 6.45068 5.68651C6.45068 4.44501 7.4577 3.43701 8.70116 3.43701C11.8507 3.43701 12.7507 7.93699 12.7507 7.93699Z" stroke="url(#grad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path fillRule="evenodd" clipRule="evenodd" d="M12.752 7.93699H16.8011C18.0445 7.93699 19.0515 6.92997 19.0515 5.68651C19.0515 4.44501 18.0445 3.43701 16.8011 3.43701C13.6516 3.43701 12.752 7.93699 12.752 7.93699Z" stroke="url(#grad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M5.7542 7.96436H19.6384C20.6756 7.96436 21.5163 8.805 21.5163 9.84218V10.6585C21.5163 11.6373 20.7223 12.4303 19.7445 12.4303H5.86025C4.82307 12.4303 3.98242 11.5896 3.98242 10.5534V9.73516C3.98242 8.75732 4.77539 7.96436 5.7542 7.96436Z" stroke="url(#grad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M19.973 12.4565V18.9647C19.973 20.3288 18.8677 21.4351 17.5036 21.4351H7.99771C6.63361 21.4351 5.52734 20.3288 5.52734 18.9647V12.4565" stroke="url(#grad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M12.75 21.4373V12.5347" stroke="url(#grad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#ffffff"/>
                <stop offset="100%" stop-color="#a855f7"/>
            </linearGradient>
        </defs>
    </svg>`;
}

function renderShieldIcon() {
    const container = document.getElementById('shieldIcon');
    if (!container) return;
    container.innerHTML = `<svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4.31245 12.879C4.31245 19.283 11.9845 21.606 11.9845 21.606C11.9845 21.606 19.6565 19.283 19.6565 12.879C19.6565 6.474 19.9345 5.974 19.3195 5.358C18.7035 4.742 12.9905 2.75 11.9845 2.75C10.9785 2.75 5.26545 4.742 4.65045 5.358C4.13767 5.87079 4.2445 5.17473 4.29467 9" stroke="#22c55e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M9.38574 11.8746L11.2777 13.7696L15.1757 9.8696" stroke="#22c55e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
}

// ========== ИНИЦИАЛИЗАЦИЯ ОБРАБОТЧИКОВ ==========
document.addEventListener('DOMContentLoaded', () => {
    // Основные кнопки навигации
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

    // Кнопки с data-action атрибутами
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
    
    Object.entries(backButtons).forEach(([id, screen]) => {
        const element = document.getElementById(id);
        if (element) {
            element.onclick = () => {
                if (id === 'backToMainFromProgress' && updateInterval) {
                    clearInterval(updateInterval);
                    updateInterval = null;
                }
                showScreenById(screen);
            };
        }
    });

    // Обработчики для форм
    const submitDealBtn = document.getElementById('submitDealBtn');
    if (submitDealBtn) submitDealBtn.onclick = createDeal;
    
    const saveCardBtn = document.getElementById('saveCardBtn');
    if (saveCardBtn) {
        saveCardBtn.addEventListener('click', () => {
            const cardNumber = document.getElementById('cardNumber').value.trim();
            if (!cardNumber) {
                if (tg && typeof tg.showPopup === 'function') {
                    tg.showPopup({ title: 'Ошибка', message: 'Введите номер карты', buttons: [{ type: 'ok' }] });
                }
                return;
            }
            wallets.card = { address: cardNumber };
            saveWallets();
            if (tg && typeof tg.showPopup === 'function') {
                tg.showPopup({ title: 'Успех', message: 'Карта сохранена', buttons: [{ type: 'ok' }] });
            }
            showScreenById('walletScreen');
        });
    }
    
    const saveCryptoBtn = document.getElementById('saveCryptoBtn');
    if (saveCryptoBtn) {
        saveCryptoBtn.addEventListener('click', () => {
            const address = document.getElementById('cryptoAddress').value.trim();
            if (!address) {
                if (tg && typeof tg.showPopup === 'function') {
                    tg.showPopup({ title: 'Ошибка', message: 'Введите адрес кошелька', buttons: [{ type: 'ok' }] });
                }
                return;
            }
            wallets[pendingCryptoType] = { address: address };
            saveWallets();
            if (tg && typeof tg.showPopup === 'function') {
                tg.showPopup({ title: 'Успех', message: `${pendingCryptoType.toUpperCase()} кошелек сохранен`, buttons: [{ type: 'ok' }] });
            }
            showScreenById('walletScreen');
        });
    }
    
    const saveTonBtn = document.getElementById('saveTonBtn');
    if (saveTonBtn) {
        saveTonBtn.addEventListener('click', () => {
            const address = document.getElementById('tonAddress').value.trim();
            if (!address) {
                if (tg && typeof tg.showPopup === 'function') {
                    tg.showPopup({ title: 'Ошибка', message: 'Введите адрес TON кошелька', buttons: [{ type: 'ok' }] });
                }
                return;
            }
            wallets.ton = { address: address };
            saveWallets();
            if (tg && typeof tg.showPopup === 'function') {
                tg.showPopup({ title: 'Успех', message: 'TON кошелек сохранен', buttons: [{ type: 'ok' }] });
            }
            showScreenById('walletScreen');
        });
    }
    
    const copyReferralLinkBtn = document.getElementById('copyReferralLinkBtn');
    if (copyReferralLinkBtn) copyReferralLinkBtn.addEventListener('click', copyReferralLink);

    // Выбор криптовалюты
    document.querySelectorAll('[data-crypto-type]').forEach(el => {
        el.addEventListener('click', () => {
            pendingCryptoType = el.dataset.cryptoType;
            const titles = { btc: 'Bitcoin', eth: 'Ethereum', usdt: 'USDT' };
            const prompts = { btc: 'Введите адрес BTC кошелька:', eth: 'Введите адрес ETH кошелька:', usdt: 'Введите адрес USDT кошелька:' };
            const titleEl = document.getElementById('cryptoScreenTitle');
            const promptEl = document.getElementById('cryptoPrompt');
            if (titleEl) titleEl.textContent = `Добавление ${titles[pendingCryptoType]}`;
            if (promptEl) promptEl.textContent = prompts[pendingCryptoType];
            showScreenById('addCryptoScreen');
        });
    });

    // Выбор валюты
    document.querySelectorAll('.currency-item').forEach(el => {
        el.addEventListener('click', () => {
            document.querySelectorAll('.currency-item').forEach(c => c.classList.remove('selected'));
            el.classList.add('selected');
            selectedCurrency = el.dataset.currency;
        });
    });
    
    const firstCurrency = document.querySelector('.currency-item');
    if (firstCurrency) firstCurrency.classList.add('selected');

    // Счётчик символов
    const additionalInfo = document.getElementById('additionalInfo');
    if (additionalInfo) {
        additionalInfo.addEventListener('input', function(e) {
            const count = e.target.value.length;
            const charCount = document.getElementById('charCount');
            if (charCount) charCount.textContent = `${count} / 20`;
            if (count > 20) e.target.value = e.target.value.slice(0, 20);
        });
    }

    // Выбор радио
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

    // Инициализация иконок
    renderGiftIcon();
    renderShieldIcon();
    renderWorkIcon();
    renderNotificationIcon();
    renderInfoIcon();
    renderProfileIcon();
    renderChartIcon();
    renderWalletIcon();
    renderAddUserIcon();

    // Скрываем кнопки Telegram
    if (tg && tg.MainButton && typeof tg.MainButton.hide === 'function') {
        tg.MainButton.hide();
    }
    if (tg && tg.BackButton && typeof tg.BackButton.hide === 'function') {
        tg.BackButton.hide();
    }

    // Показываем главный экран
    showScreenById('mainScreen');
});

// Глобальная функция для тестирования прогресса
window.advanceProgress = function() {
    if (dealProgress < 4 && currentDeal) {
        dealProgress++;
        updateProgressDisplay();
        if (dealProgress === 4 && currentDeal) {
            updateDealStatus(currentDeal.id, 'completed');
            setTimeout(() => showScreenById('successScreen'), 500);
        }
    }
};

// Генерация рандомного ID сделки (формат: #Sf3ko1lsapa4k)
function generateDealId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '#';
    for (let i = 0; i < 12; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function createDeal() {
    const name = document.getElementById('dealName').value;
    let amount = parseFloat(document.getElementById('amount').value);
    const dealType = document.querySelector('input[name="dealType"]:checked')?.value || 'normal';
    const feePayer = document.querySelector('input[name="feePayer"]:checked')?.value || 'buyer';
    const additionalInfo = document.getElementById('additionalInfo').value;
    
    if (!name) {
        tg.showPopup({ title: 'Ошибка', message: 'Введите название сделки', buttons: [{ type: 'ok' }] });
        return;
    }
    if (!amount || amount < 0.1) {
        tg.showPopup({ title: 'Ошибка', message: 'Минимальная сумма: 0.1', buttons: [{ type: 'ok' }] });
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
    
    // Обновляем экран прогресса
    document.getElementById('dealNameValue').textContent = currentDeal.name;
    document.getElementById('dealAmount').textContent = formatAmount(currentDeal.amount, currentDeal.currency);
    document.getElementById('sellerName').textContent = currentDeal.sellerUsername;
    document.getElementById('buyerName').textContent = 'Ожидается';
    document.getElementById('createdDate').textContent = currentDeal.createdAt;
    document.getElementById('dealIdValue').textContent = currentDeal.id;
    
    dealProgress = 0;
    updateProgressDisplay();
    
    showScreen('progress');
}

// Копирование ID сделки (по клику на ID)
function setupCopyDealId() {
    const dealIdElement = document.getElementById('dealIdValue');
    if (dealIdElement) {
        dealIdElement.onclick = () => {
            if (currentDeal) {
                navigator.clipboard.writeText(currentDeal.id);
                tg.showPopup({
                    title: 'Скопировано',
                    message: `ID сделки ${currentDeal.id} скопирован`,
                    buttons: [{ type: 'ok' }]
                });
            }
        };
    }
}

// ========== ИКОНКА ADD USER ==========
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

// ========== РЕФЕРАЛЬНАЯ ССЫЛКА ==========
function updateReferralLink() {
    const linkInput = document.getElementById('referralLinkInput');
    if (linkInput) {
        const botUsername = 'TrustZipperBot';
        const refLink = `https://t.me/${botUsername}?start=ref_${currentUser.id}`;
        linkInput.value = refLink;
    }
}

function copyReferralLink() {
    const linkInput = document.getElementById('referralLinkInput');
    if (linkInput && linkInput.value) {
        navigator.clipboard.writeText(linkInput.value);
        tg.showPopup({ title: 'Скопировано', message: 'Реферальная ссылка скопирована', buttons: [{ type: 'ok' }] });
    }
}

// ========== ДОБАВЬ В showScreen ==========
// В функцию showScreen добавь:
if (screenName === 'referral') {
    updateReferralLink();
}

// ========== ДОБАВЬ В НАВИГАЦИЮ ==========
// Добавь обработчик для кнопки реферальной программы
document.querySelectorAll('[data-action="referral"]').forEach(el => {
    el.addEventListener('click', () => showScreen('referral'));
});
document.getElementById('backToMainFromReferral')?.addEventListener('click', () => showScreen('main'));
document.getElementById('copyReferralLinkBtn')?.addEventListener('click', copyReferralLink);

// ========== ДОБАВЬ В ИНИЦИАЛИЗАЦИЮ ИКОНОК ==========
renderAddUserIcon();

// ========== ОБРАБОТКА ДАННЫХ ОТ БОТА ==========
tg.onEvent('web_app_data_sent', (event) => {
    try {
        const data = JSON.parse(event.data);
        console.log('Получены данные от бота:', data);
        
        if (data.action === 'payment_confirmed') {
            // Оплата подтверждена админом
            if (currentDeal && currentDeal.id === data.deal_id) {
                dealProgress = 2; // Переход на "Оплата подтверждена"
                updateProgressDisplay();
                tg.showPopup({
                    title: 'Оплата подтверждена',
                    message: 'Администратор подтвердил оплату. Можете отправлять NFT.',
                    buttons: [{ type: 'ok' }]
                });
            }
        } else if (data.action === 'deal_status_update') {
            // Обновление статуса сделки
            if (currentDeal && currentDeal.id === data.deal_id) {
                switch(data.status) {
                    case 'paid':
                        dealProgress = 2;
                        break;
                    case 'completed':
                        dealProgress = 4;
                        updateProgressDisplay();
                        setTimeout(() => showScreen('success'), 500);
                        break;
                }
                updateProgressDisplay();
            }
        } else if (data.action === 'deal_info_response') {
            // Обновляем данные о покупателе
            if (data.buyer_username && data.buyer_username !== 'Ожидается') {
                document.getElementById('buyerName').textContent = data.buyer_username;
                if (dealProgress === 0) {
                    dealProgress = 1;
                    updateProgressDisplay();
                }
            }
        }
    } catch (e) {
        console.error('Ошибка обработки данных:', e);
    }
});

// Функция для отправки запроса на подтверждение оплаты (для админа)
function requestPaymentConfirmation(dealId) {
    tg.sendData(JSON.stringify({
        action: 'request_payment_confirmation',
        deal_id: dealId
    }));
}

function inviteBuyer() {
    if (!currentDeal) {
        tg.showPopup({ title: 'Ошибка', message: 'Сначала создайте сделку', buttons: [{ type: 'ok' }] });
        return;
    }
    const botUsername = 'TrustZipperBot'; // ЗАМЕНИ НА СВОЙ USERNAME БОТА
    const link = `https://t.me/${botUsername}?start=deal_${currentDeal.id.replace('#', '')}`;
    
    // Копируем ссылку в буфер
    navigator.clipboard.writeText(link);
    
    tg.showPopup({
        title: 'Ссылка скопирована',
        message: `Ссылка для покупателя:\n${link}\n\nПосле того как покупатель перейдет по ссылке, его username появится в поле "Покупатель".`,
        buttons: [{ type: 'ok' }]
    });
}

// Принудительно устанавливаем тёмную тему (игнорируем системную тему Telegram)
const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// ПРИНУДИТЕЛЬНАЯ ТЁМНАЯ ТЕМА
document.body.style.backgroundColor = '#0a0c10';
document.body.style.color = '#ffffff';

// Также можно попробовать изменить тему самого WebApp (если поддерживается)
try {
    tg.setBackgroundColor('#0a0c10');
    tg.setHeaderColor('#0a0c10');
} catch(e) {}
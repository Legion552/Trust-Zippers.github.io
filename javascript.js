// ================= TELEGRAM INIT =================
const tg = (() => {
    try {
        const app = window.Telegram?.WebApp;

        if (!app) throw new Error("No Telegram");

        app.ready?.();
        app.expand?.();

        app.setBackgroundColor?.('#0a0c10');
        app.setHeaderColor?.('#0a0c10');

        return app;
    } catch (e) {
        console.warn("Telegram fallback mode");

        return {
            initDataUnsafe: { user: null },
            showPopup: ({ message }) => alert(message),
            sendData: (data) => console.log("SEND:", data),
            MainButton: { hide() {}, show() {} },
            BackButton: { hide() {}, show() {} }
        };
    }
})();

document.body.style.background = '#0a0c10';
document.body.style.color = '#fff';

// ================= USER =================
const currentUser = tg.initDataUnsafe?.user || {
    id: Date.now(),
    username: 'user_' + Math.floor(Math.random() * 9999),
    first_name: 'Пользователь'
};

// ================= STATE =================
const state = {
    wallets: {},
    deals: [],
    currentDeal: null,
    currency: 'USDT',
    progress: 0
};

// ================= STORAGE =================
const load = (key, fallback) => {
    try {
        return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch {
        return fallback;
    }
};

const save = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error("Storage error", e);
    }
};

state.wallets = load('wallets', {});
state.deals = load('deals', []);

// ================= UTILS =================
const currencySymbols = {
    TON: 'TON',
    USDT: 'USDT',
    RUB: '₽',
    EUR: '€'
};

const safePopup = (msg) => {
    try {
        tg.showPopup?.({
            title: 'Уведомление',
            message: msg,
            buttons: [{ type: 'ok' }]
        });
    } catch {
        alert(msg);
    }
};

const safeSend = (data) => {
    try {
        const str = JSON.stringify(data);
        if (str.length < 4000) tg.sendData(str);
    } catch (e) {
        console.error(e);
    }
};

const safeCopy = (text) => {
    try {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
        } else {
            const t = document.createElement("textarea");
            t.value = text;
            document.body.appendChild(t);
            t.select();
            document.execCommand("copy");
            t.remove();
        }
        safePopup("Скопировано");
    } catch {
        safePopup("Ошибка копирования");
    }
};

const formatAmount = (amount, currency) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return `0 ${currency}`;

    return `${num.toFixed(2).replace(/\.00$/, '')} ${currencySymbols[currency] || currency}`;
};

const generateId = () =>
    '#' + Math.random().toString(36).slice(2, 14);

// ================= DEAL =================
function createDeal() {
    try {
        const name = document.getElementById('dealName')?.value?.trim();
        const amount = parseFloat(document.getElementById('amount')?.value);

        if (!name) return safePopup("Введите название");
        if (!amount || amount < 0.1) return safePopup("Мин сумма 0.1");

        const deal = {
            id: generateId(),
            name,
            amount,
            currency: state.currency,
            sellerId: currentUser.id,
            sellerUsername: currentUser.username,
            createdAt: new Date().toLocaleString(),
            status: 'waiting'
        };

        state.currentDeal = deal;
        state.deals.push(deal);
        save('deals', state.deals);

        safeSend({ action: 'create', deal });

        updateDealUI();
        showScreen('dealCreatedScreen');

    } catch (e) {
        console.error(e);
        safePopup("Ошибка создания");
    }
}

// ================= UI =================
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(id)?.classList.remove('hidden');
}

function updateDealUI() {
    const d = state.currentDeal;
    if (!d) return;

    setText('dealNameValue', d.name);
    setText('dealAmount', formatAmount(d.amount, d.currency));
    setText('dealIdValue', d.id);
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

// ================= ACTIONS =================
function copyDealId() {
    if (!state.currentDeal) return;
    safeCopy(state.currentDeal.id);
}

function inviteBuyer() {
    if (!state.currentDeal) return;
    const link = `https://t.me/TrustZipperBot?start=${state.currentDeal.id.replace('#','')}`;
    safeCopy(link);
}

// ================= EVENTS =================
document.addEventListener('DOMContentLoaded', () => {

    document.getElementById('createDealBtn')?.addEventListener('click', () => {
        showScreen('createDealScreen');
    });

    document.getElementById('submitDealBtn')?.addEventListener('click', createDeal);

    document.getElementById('copyDealIdBtn')?.addEventListener('click', copyDealId);

    document.getElementById('inviteBuyerBtn')?.addEventListener('click', inviteBuyer);

    tg.MainButton?.hide();
    tg.BackButton?.hide();

    showScreen('mainScreen');
});

// ================= ERROR GUARD =================
window.onerror = (msg, src, line) => {
    console.error("Error:", msg, line);
};

window.onunhandledrejection = (e) => {
    console.error("Promise:", e.reason);
};


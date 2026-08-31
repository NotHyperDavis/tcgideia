const API_BASE = "http://localhost:3000"; // troca pelo domínio real quando publicares o site

const token = localStorage.getItem("token");

const loginWarning = document.getElementById("loginWarning");
const cartFlow = document.getElementById("cartFlow");
const cartItemsEl = document.getElementById("cartItems");
const summaryPanel = document.getElementById("summaryPanel");
const cartMessage = document.getElementById("cartMessage");

const CONDITION_LABELS = {
    mint: "Mint", near_mint: "Near Mint", excellent: "Excelente",
    good: "Boa", played: "Usada", poor: "Danificada",
};

if (!token) {
    loginWarning.style.display = "block";
    cartFlow.style.display = "none";
} else {
    loadCart();
}

async function loadCart() {
    cartItemsEl.innerHTML = "<p>A carregar...</p>";

    try {
        const response = await fetch(`${API_BASE}/cart`, {
            headers: { "Authorization": `Bearer ${token}` },
        });
        const data = await response.json();

        if (!response.ok) {
            cartItemsEl.innerHTML = `<p>${data.error || "Erro ao carregar o carrinho."}</p>`;
            return;
        }

        if (data.items.length === 0) {
            cartItemsEl.innerHTML = "<p>O teu carrinho está vazio. <a href='marketplace.html'>Ver marketplace</a>.</p>";
            summaryPanel.style.display = "none";
            return;
        }

        cartItemsEl.innerHTML = "";

        data.items.forEach(item => {
            const el = document.createElement("div");
            el.className = "listing-row";
            el.innerHTML = `
                <img src="${item.card_image ?? ""}">
                <div>
                    <h3>${item.card_name}</h3>
                    <p>Vendedor: ${item.seller_name} · ${CONDITION_LABELS[item.condition] ?? item.condition}</p>
                    <p>${Number(item.price).toFixed(2)} € / unidade</p>
                    <label>Quantidade</label>
                    <input type="number" class="qty-input" min="1" max="${item.available_quantity}" value="${item.quantity}" style="max-width:80px;">
                    <button class="remove-btn cancel-btn">Remover</button>
                </div>
            `;

            el.querySelector(".qty-input").addEventListener("change", (e) => updateQuantity(item.listing_id, e.target.value));
            el.querySelector(".remove-btn").addEventListener("click", () => removeItem(item.listing_id));

            cartItemsEl.appendChild(el);
        });

        document.getElementById("sumBase").textContent = data.base_price.toFixed(2);
        document.getElementById("sumShipping").textContent = (data.shipping_cost + data.platform_fee).toFixed(2);
        document.getElementById("sumTotal").textContent = data.total.toFixed(2);
        summaryPanel.style.display = "block";

        loadBalancePreview(data.total);

    } catch (error) {
        console.error(error);
        cartItemsEl.innerHTML = "<p>Erro ao ligar ao servidor.</p>";
    }
}

async function loadBalancePreview(total) {
    try {
        const response = await fetch(`${API_BASE}/wallet`, {
            headers: { "Authorization": `Bearer ${token}` },
        });
        const data = await response.json();
        document.getElementById("sumBalance").textContent = Number(data.balance).toFixed(2);

        const checkoutBtn = document.getElementById("checkoutBtn");
        if (Number(data.balance) < total) {
            checkoutBtn.disabled = true;
            checkoutBtn.textContent = "Saldo insuficiente — carrega a carteira";
        } else {
            checkoutBtn.disabled = false;
            checkoutBtn.textContent = "Finalizar compra (pagar com a carteira)";
        }
    } catch (error) {
        console.error(error);
    }
}

async function updateQuantity(listingId, quantity) {
    try {
        const response = await fetch(`${API_BASE}/cart/${listingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ quantity }),
        });

        if (!response.ok) {
            const data = await response.json();
            alert(data.error || "Erro ao atualizar quantidade.");
        }

        loadCart();
    } catch (error) {
        console.error(error);
        alert("Erro ao ligar ao servidor.");
    }
}

async function removeItem(listingId) {
    try {
        await fetch(`${API_BASE}/cart/${listingId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` },
        });
        loadCart();
    } catch (error) {
        console.error(error);
        alert("Erro ao ligar ao servidor.");
    }
}

document.getElementById("checkoutBtn")?.addEventListener("click", async () => {
    cartMessage.textContent = "A processar...";

    try {
        const response = await fetch(`${API_BASE}/cart/checkout`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` },
        });
        const data = await response.json();

        if (!response.ok) {
            cartMessage.textContent = data.error || "Erro ao finalizar compra.";
            return;
        }

        cartMessage.textContent = `Compra concluída! Total pago: ${Number(data.total).toFixed(2)} €. A redirecionar...`;
        setTimeout(() => { window.location.href = "encomendas.html"; }, 1500);

    } catch (error) {
        console.error(error);
        cartMessage.textContent = "Erro ao ligar ao servidor.";
    }
});

// Precisa de existir mesmo antes do primeiro loadBalancePreview
document.addEventListener("click", (e) => {
    if (e.target.id === "checkoutBtn" && e.target.disabled) {
        e.preventDefault();
    }
});
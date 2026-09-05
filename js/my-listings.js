const token = localStorage.getItem("token");

const loginWarning = document.getElementById("loginWarning");
const listingsContainer = document.getElementById("listings");

const CONDITION_LABELS = {
    mint: "Mint",
    near_mint: "Near Mint",
    excellent: "Excelente",
    good: "Boa",
    played: "Usada",
    poor: "Danificada",
};

const STATUS_LABELS = {
    active: "Ativo",
    sold: "Vendido",
    removed: "Removido",
};

const PAYMENT_STATUS_LABELS = { pending: "Pendente", paid: "Pago", cancelled: "Cancelado" };
const ORDER_STATUS_LABELS = { committed: "Comprometido", shipped: "Enviado", completed: "Concluído", cancelled: "Cancelado" };

if (!token) {
    loginWarning.style.display = "block";
} else {
    loadMyListings();
}

async function loadMyListings() {
    listingsContainer.innerHTML = "<p>A carregar...</p>";

    try {
        const [listingsResponse, ordersResponse] = await Promise.all([
            fetch(`${API_BASE}/listings/mine`, { headers: { "Authorization": `Bearer ${token}` } }),
            fetch(`${API_BASE}/orders/selling`, { headers: { "Authorization": `Bearer ${token}` } }),
        ]);

        if (!listingsResponse.ok) {
            listingsContainer.innerHTML = "<p>Erro ao carregar os teus anúncios.</p>";
            return;
        }

        const listings = await listingsResponse.json();
        const orders = ordersResponse.ok ? await ordersResponse.json() : [];

        // Agrupa as encomendas por anúncio, para mostrar cada venda junto do anúncio a que pertence.
        const ordersByListing = {};
        orders.forEach(order => {
            if (!ordersByListing[order.listing_id]) ordersByListing[order.listing_id] = [];
            ordersByListing[order.listing_id].push(order);
        });

        if (listings.length === 0) {
            listingsContainer.innerHTML = "<p>Ainda não tens nenhum anúncio. <a href='sell.html'>Vender uma carta</a>.</p>";
            return;
        }

        listingsContainer.innerHTML = "";
        listings.forEach(listing => renderListing(listing, ordersByListing[listing.id] || []));

    } catch (error) {
        console.error(error);
        listingsContainer.innerHTML = "<p>Erro ao ligar ao servidor.</p>";
    }
}

function renderListing(listing, orders) {
    const el = document.createElement("div");
    el.className = "listing-row";
    el.dataset.id = listing.id;

    el.innerHTML = `
        <img src="${listing.card_image ?? ""}">

        <div class="listing-info">
            <h3>${listing.card_name}</h3>
            <p>Estado: <strong>${STATUS_LABELS[listing.status] ?? listing.status}</strong></p>
        </div>

        <div class="listing-edit">
            <label>Preço (€)</label>
            <input type="number" step="0.01" min="0.01" class="edit-price" value="${listing.price}">

            <label>Condição</label>
            <select class="edit-condition">
                ${Object.entries(CONDITION_LABELS).map(([value, label]) =>
                    `<option value="${value}" ${value === listing.condition ? "selected" : ""}>${label}</option>`
                ).join("")}
            </select>

            <label>Quantidade</label>
            <input type="number" min="1" class="edit-quantity" value="${listing.quantity}">

            <label>Estado</label>
            <select class="edit-status">
                ${Object.entries(STATUS_LABELS).map(([value, label]) =>
                    `<option value="${value}" ${value === listing.status ? "selected" : ""} ${value === "sold" ? "disabled" : ""}>${label}</option>`
                ).join("")}
            </select>
            ${listing.status !== "sold" ? `<p style="font-size:12px; color:var(--text-dim);">"Vendido" só é atribuído automaticamente numa venda a sério.</p>` : ""}
        </div>

        <div class="listing-actions">
            <button class="save-btn">Guardar alterações</button>
            <button class="delete-btn">Remover anúncio</button>
        </div>

        <p class="listing-message"></p>

        ${orders.length > 0 ? `
            <div class="listing-sales">
                <h4>Vendas deste anúncio</h4>
                ${orders.map(order => renderOrder(order)).join("")}
            </div>
        ` : ""}
    `;

    el.querySelector(".save-btn").addEventListener("click", () => saveListing(el, listing.id));
    el.querySelector(".delete-btn").addEventListener("click", () => deleteListing(el, listing.id));

    orders.forEach(order => {
        el.querySelector(`.mark-shipped-btn[data-order-id="${order.id}"]`)
            ?.addEventListener("click", () => updateOrder(order.id, { status: "shipped" }, loadMyListings));

        el.querySelector(`.chat-btn[data-order-id="${order.id}"]`)
            ?.addEventListener("click", (e) => openConversation(e.currentTarget));

        el.querySelector(`.invoice-btn[data-order-id="${order.id}"]`)
            ?.addEventListener("click", () => downloadInvoice(order.id));
    });

    listingsContainer.appendChild(el);
}

function renderOrder(order) {
    return `
        <div class="order-row" style="margin-top:10px;">
            <div>
                <p>Comprador: ${escapeHtml(order.buyer_name)} — ${escapeHtml(order.buyer_email)} (x${order.quantity})</p>

                ${order.shipping_name ? `
                    <div style="background:var(--panel-2); border:1px solid var(--border); border-radius:10px; padding:12px; margin:10px 0;">
                        <strong style="font-size:13px; color:var(--text-dim);">📦 ENVIAR PARA</strong>
                        <p style="margin:6px 0 0; line-height:1.5;">
                            ${escapeHtml(order.shipping_name)}<br>
                            ${escapeHtml(order.shipping_address_line)}<br>
                            ${escapeHtml(order.shipping_postal_code)} ${escapeHtml(order.shipping_city)}<br>
                            ${order.shipping_country === "ES" ? "Espanha" : "Portugal"}
                        </p>
                    </div>
                ` : `<p style="color:var(--text-dim); font-size:13px;"><em>Sem morada registada — pede-a ao comprador pela conversa.</em></p>`}

                <p>Vais receber: <strong>${Number(order.seller_payout).toFixed(2)} €</strong>
                    ${order.payout_status === "paid_out"
                        ? ` <span style="color:var(--success, #4ADE80);">✓ já repassado</span>`
                        : ` <span style="color:var(--text-dim);">(retido até o comprador confirmar receção)</span>`}
                </p>
                <p>Pagamento: ${PAYMENT_STATUS_LABELS[order.payment_status]} · Estado: ${ORDER_STATUS_LABELS[order.status]}</p>
                ${order.payment_status === "paid" ? `<button class="invoice-btn" data-order-id="${order.id}">📄 Recibo</button>` : ""}

                ${order.payment_status === "paid" && order.status === "committed" ? `<button class="mark-shipped-btn" data-order-id="${order.id}">Marcar como enviado</button>` : ""}
                ${order.payment_status !== "paid" ? `<p><em>Aguarda a confirmação do pagamento pelo site antes de enviares.</em></p>` : ""}

                <button class="chat-btn" data-order-id="${order.id}" data-conversation-id="${order.conversation_id ?? ''}" data-other-user-id="${order.buyer_id}" data-listing-id="${order.listing_id}">💬 Conversa</button>
            </div>
        </div>
    `;
}

async function openConversation(button) {
    const conversationId = button.dataset.conversationId;

    if (conversationId) {
        window.location.href = `mensagens.html?conversation=${conversationId}`;
        return;
    }

    const otherUserId = button.dataset.otherUserId;
    const listingId = button.dataset.listingId;

    button.disabled = true;
    button.textContent = "A abrir...";

    try {
        const response = await fetch(`${API_BASE}/conversations`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({ other_user_id: otherUserId, listing_id: listingId }),
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || "Erro ao abrir a conversa.");
            button.disabled = false;
            button.textContent = "💬 Conversa";
            return;
        }

        window.location.href = `mensagens.html?conversation=${data.id}`;

    } catch (error) {
        console.error(error);
        alert("Erro ao ligar ao servidor.");
        button.disabled = false;
        button.textContent = "💬 Conversa";
    }
}

async function downloadInvoice(orderId) {
    try {
        const response = await fetch(`${API_BASE}/orders/${orderId}/invoice`, {
            headers: { "Authorization": `Bearer ${token}` },
        });

        if (!response.ok) {
            alert("Erro ao gerar o recibo.");
            return;
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `recibo-encomenda-${orderId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error(error);
        alert("Erro ao ligar ao servidor.");
    }
}

async function updateOrder(id, body, reload) {
    try {
        const response = await fetch(`${API_BASE}/orders/${id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || "Erro ao atualizar a encomenda.");
            return;
        }

        reload();

    } catch (error) {
        console.error(error);
        alert("Erro ao ligar ao servidor.");
    }
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text ?? "";
    return div.innerHTML;
}

async function saveListing(el, id) {
    const messageEl = el.querySelector(".listing-message");
    messageEl.textContent = "A guardar...";

    const body = {
        price: el.querySelector(".edit-price").value,
        condition: el.querySelector(".edit-condition").value,
        quantity: el.querySelector(".edit-quantity").value,
        status: el.querySelector(".edit-status").value,
    };

    try {
        const response = await fetch(`${API_BASE}/listings/${id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
            messageEl.textContent = data.error || "Erro ao guardar alterações.";
            return;
        }

        messageEl.textContent = "Guardado!";
        setTimeout(() => { messageEl.textContent = ""; }, 2000);

    } catch (error) {
        console.error(error);
        messageEl.textContent = "Erro ao ligar ao servidor.";
    }
}

async function deleteListing(el, id) {
    const confirmed = confirm("Tens a certeza que queres remover este anúncio? Não é possível desfazer.");
    if (!confirmed) return;

    try {
        const response = await fetch(`${API_BASE}/listings/${id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` },
        });

        const data = await response.json();

        if (!response.ok) {
            el.querySelector(".listing-message").textContent = data.error || "Erro ao remover anúncio.";
            return;
        }

        el.remove();

    } catch (error) {
        console.error(error);
        el.querySelector(".listing-message").textContent = "Erro ao ligar ao servidor.";
    }
}
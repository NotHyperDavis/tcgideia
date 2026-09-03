const token = localStorage.getItem("token");
const loginWarning = document.getElementById("loginWarning");
const wishlistItemsEl = document.getElementById("wishlistItems");

if (!token) {
    loginWarning.style.display = "block";
} else {
    loadWishlist();
}

async function loadWishlist() {
    wishlistItemsEl.innerHTML = "<p>A carregar...</p>";

    try {
        const response = await fetch(`${API_BASE}/wishlist`, {
            headers: { "Authorization": `Bearer ${token}` },
        });

        const items = await response.json();

        if (!response.ok) {
            wishlistItemsEl.innerHTML = `<p>${items.error || "Erro ao carregar a lista de desejos."}</p>`;
            return;
        }

        if (items.length === 0) {
            wishlistItemsEl.innerHTML = `<p>Ainda não tens nenhuma carta guardada. Vai ao <a href="marketplace.html">marketplace</a> e clica em "❤️ Adicionar aos desejos" numa carta.</p>`;
            return;
        }

        wishlistItemsEl.innerHTML = items.map(item => `
            <div class="order-row">
                <img src="${item.card_image ?? ""}">
                <div>
                    <h3>${item.card_name}</h3>
                    ${item.best_listing_id
                        ? `<p>Melhor preço disponível: <strong>${Number(item.best_price).toFixed(2)} €</strong> — ${item.best_seller_name}
                             <a href="product.html?id=${item.best_listing_id}">Ver anúncio</a></p>`
                        : `<p style="color:var(--text-dim);">Ninguém está a vender esta carta neste momento.</p>`}
                    <button class="remove-wishlist-btn" data-id="${item.id}" style="background:none; border:1px solid var(--border); color:var(--text-dim);">Remover</button>
                </div>
            </div>
        `).join("");

        document.querySelectorAll(".remove-wishlist-btn").forEach(btn => {
            btn.addEventListener("click", () => removeFromWishlist(btn.dataset.id));
        });

    } catch (error) {
        console.error(error);
        wishlistItemsEl.innerHTML = "<p>Erro ao ligar ao servidor.</p>";
    }
}

async function removeFromWishlist(id) {
    try {
        await fetch(`${API_BASE}/wishlist/${id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` },
        });
        loadWishlist();
    } catch (error) {
        console.error(error);
        alert("Erro ao remover.");
    }
}
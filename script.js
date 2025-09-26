async function loadData() {
    try {
        const response = await fetch(DATA_SOURCE);
        const data = await response.json();

        // =========================
        // Info del sitio
        // =========================
        document.getElementById("siteName").textContent = data.siteInfo.name;
        document.getElementById("siteTitle").textContent = data.siteInfo.title;
        document.getElementById("pageTitle").textContent = data.siteInfo.title;
        document.getElementById("pageSubtitle").textContent = data.siteInfo.subtitle;
        document.getElementById("copyright").textContent = data.siteInfo.copyright;

        // =========================
        // Navegación superior
        // =========================
        const nav = document.getElementById("topNavLinks");
        nav.innerHTML = "";
        data.topNavigation.forEach(item => {
            const div = document.createElement("div");
            div.className = "nav-item";

            const a = document.createElement("a");
            a.href = item.link || "#";
            a.innerHTML = `<i class="${item.icon}"></i> ${item.title}`;

            div.appendChild(a);

            // Dropdown si existe
            if (item.dropdown && item.dropdown.length) {
                const dropdown = document.createElement("div");
                dropdown.className = "dropdown-content";
                item.dropdown.forEach(sub => {
                    const subA = document.createElement("a");
                    subA.href = sub.link;
                    subA.textContent = sub.title;
                    dropdown.appendChild(subA);
                });
                div.classList.add("dropdown");
                div.appendChild(dropdown);
            }

            nav.appendChild(div);
        });

        // =========================
        // Cards horizontales (scroll)
        // =========================
        const cardsWrapper = document.getElementById("cardContainer");
        cardsWrapper.innerHTML = "";
        cardsWrapper.style.display = "flex";
        cardsWrapper.style.flexDirection = "row";
        cardsWrapper.style.gap = "20px";

        data.cards.forEach(cardData => {
            const card = document.createElement("div");
            card.className = "card";
            card.style.minWidth = "220px"; // ancho mínimo
            card.style.flexShrink = "0";  // evita que se encoja
            card.style.height = "300px";  // altura fija, se puede ajustar

            // Background
            if (cardData.backgroundImage) {
                card.style.background = cardData.backgroundImage.startsWith("linear-gradient")
                    ? cardData.backgroundImage
                    : `url(${cardData.backgroundImage}) center/cover no-repeat`;
            } else {
                card.style.background = `url('Resources/images/BG_placeholder.jpg') center/cover no-repeat`;
            }

            // Card inner
            const cardContent = document.createElement("div");
            cardContent.className = "card-content";

            const title = document.createElement("div");
            title.className = "card-title";
            title.textContent = cardData.title || "Sin título";

            const description = document.createElement("div");
            description.className = "card-text";
            description.textContent = cardData.description || "";

            // Botón
            const boton = document.createElement("a");
            boton.href = cardData.link || "#";
            boton.className = "boton";
            boton.textContent = "Ver más";

            cardContent.appendChild(title);
            cardContent.appendChild(description);
            cardContent.appendChild(boton);
            card.appendChild(cardContent);

            // Imagen frontal (opcional)
            if (cardData.image) {
                const cardImgDiv = document.createElement("div");
                cardImgDiv.className = "card-image";
                const img = document.createElement("img");
                img.src = cardData.image;
                img.alt = cardData.title || "Imagen";
                img.onerror = function() {
                    this.src = "Resources/images/BG_placeholder.jpg";
                };
                cardImgDiv.appendChild(img);
                card.appendChild(cardImgDiv);
            }

            cardsWrapper.appendChild(card);
        });

        // =========================
        // Footer social
        // =========================
        const socials = document.getElementById("socialLinks");
        socials.innerHTML = "";
        data.socialLinks.forEach(link => {
            const a = document.createElement("a");
            a.href = link.link;
            a.innerHTML = `<i class="${link.icon}"></i>`;
            a.target = "_blank";
            socials.appendChild(a);
        });

        // Footer links
        const footerLinks = document.getElementById("footerLinks");
        footerLinks.innerHTML = "";
        if (data.footerNavigation && data.footerNavigation.length) {
            data.footerNavigation.forEach(link => {
                if (!link.title) return;
                const a = document.createElement("a");
                a.href = link.link || "#";
                a.textContent = link.title;
                footerLinks.appendChild(a);
            });
        }

    } catch (err) {
        console.error("Error cargando JSON:", err);
    }
}

loadData();

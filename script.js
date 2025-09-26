async function loadData(jsonSource = DATA_SOURCE) {
    try {
        const response = await fetch(jsonSource);
        const data = await response.json();

        // Info del sitio
        document.getElementById("siteName").textContent = data.siteInfo.name;
        document.getElementById("pageTitle").textContent = data.siteInfo.title;
        document.getElementById("pageSubtitle").textContent = data.siteInfo.subtitle;
        document.getElementById("copyright").textContent = data.siteInfo.copyright;

        // Top nav
        const nav = document.getElementById("topNavLinks");
        nav.innerHTML = "";
        data.topNavigation.forEach(item => {
            const a = document.createElement("a");
            a.href = item.link || "#";
            a.innerHTML = `<i class="${item.icon}"></i> ${item.title}`;
            a.addEventListener("click", e => {
                if(item.json){
                    e.preventDefault();
                    loadData(item.json); // carga el JSON de la página
                }
            });
            nav.appendChild(a);
        });

        // Cards
        const cardsWrapper = document.getElementById("cardsWrapper");
        const textpageWrapper = document.getElementById("textpageWrapper");

        // Si hay cards, mostrar carrusel
        if(data.cards && data.cards.length > 0){
            cardsWrapper.style.display = "flex";
            textpageWrapper.style.display = "none";
            const cards = document.getElementById("cardContainer");
            cards.innerHTML = "";
            data.cards.forEach(cardData => {
                const card = document.createElement("div");
                card.className = "card";
                card.style.minWidth = "220px";
                card.style.flexShrink = "0";
                card.style.height = "300px";
                card.style.background = cardData.backgroundImage
                    ? (cardData.backgroundImage.startsWith("linear-gradient")
                        ? cardData.backgroundImage
                        : `url(${cardData.backgroundImage}) center/cover no-repeat`)
                    : `url('Material/imgs/BG_placeholder.png') center/cover no-repeat`;

                // Card inner
                const cardContent = document.createElement("div");
                cardContent.className = "card-content";

                const title = document.createElement("div");
                title.className = "card-title";
                title.textContent = cardData.title || "Sin título";

                const description = document.createElement("div");
                description.className = "card-text";
                description.textContent = cardData.description || "";

                const boton = document.createElement("a");
                boton.href = cardData.link || "#";
                boton.className = "boton";
                boton.textContent = "Ver más";

                // Si la card tiene JSON, abrir text page
                if(cardData.json){
                    boton.addEventListener("click", e=>{
                        e.preventDefault();
                        loadData(cardData.json);
                    });
                }

                cardContent.appendChild(title);
                cardContent.appendChild(description);
                cardContent.appendChild(boton);
                card.appendChild(cardContent);

                // Imagen frontal
                if(cardData.image){
                    const imgDiv = document.createElement("div");
                    imgDiv.className = "card-image";
                    const img = document.createElement("img");
                    img.src = cardData.image;
                    img.alt = cardData.title || "Imagen";
                    img.onerror = ()=>{ img.src = "Material/imgs/BG_placeholder.png"; };
                    imgDiv.appendChild(img);
                    card.appendChild(imgDiv);
                }

                cards.appendChild(card);
            });
        }
        // Si no hay cards pero sí secciones de texto
        else if(data.sections && data.sections.length > 0){
            cardsWrapper.style.display = "none";
            textpageWrapper.style.display = "block";

            const container = document.getElementById("textPageContainer");
            container.innerHTML = "";

            data.sections.forEach(sec=>{
                const section = document.createElement("div");
                section.className = "text-page-section";

                if(sec.title){
                    const h2 = document.createElement("h2");
                    h2.className = "text-page-title";
                    h2.textContent = sec.title;
                    section.appendChild(h2);
                }

                if(sec.subtitle){
                    const h3 = document.createElement("h3");
                    h3.className = "text-page-subtitle";
                    h3.textContent = sec.subtitle;
                    section.appendChild(h3);
                }

                if(sec.paragraphs){
                    sec.paragraphs.forEach(pText=>{
                        const p = document.createElement("p");
                        p.className = "text-page-paragraph";
                        p.textContent = pText;
                        section.appendChild(p);
                    });
                }

                if(sec.images){
                    sec.images.forEach(imgData=>{
                        const imgWrapper = document.createElement("div");
                        imgWrapper.className = "text-page-image-wrapper";
                        const img = document.createElement("img");
                        img.src = imgData.src;
                        img.alt = imgData.alt || "";
                        img.className = "text-page-image";
                        img.onerror = ()=>{ img.src = "Material/imgs/BG_placeholder.png"; };
                        imgWrapper.appendChild(img);
                        if(imgData.caption){
                            const cap = document.createElement("div");
                            cap.className = "text-page-image-caption";
                            cap.textContent = imgData.caption;
                            imgWrapper.appendChild(cap);
                        }
                        section.appendChild(imgWrapper);
                    });
                }

                container.appendChild(section);
            });
        }

        // Sociales
        const socials = document.getElementById("socialLinks");
        socials.innerHTML = "";
        if(data.socialLinks){
            data.socialLinks.forEach(link=>{
                const a = document.createElement("a");
                a.href = link.link;
                a.innerHTML = `<i class="${link.icon}"></i>`;
                a.target = "_blank";
                socials.appendChild(a);
            });
        }

    } catch(err){
        console.error("Error cargando JSON:", err);
    }
}

// Carga inicial
loadData();

// imagina que abelito lea esto... que miedo



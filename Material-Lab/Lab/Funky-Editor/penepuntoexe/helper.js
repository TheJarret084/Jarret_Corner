export function log(message) {
    const logEL = document.getElementById("logger");
    logEL.textContent = message;
}

export function showError(message) {
    const logEL = document.getElementById("logger");
    logEL.textContent = `❌ ${message}`;
}

export function showWarning(message) {
    const logEL = document.getElementById("logger");
    logEL.textContent = `⚠️ ${message}`;
}

export function showInfo(message) {
    const logEL = document.getElementById("logger");
    logEL.textContent = `ℹ️ ${message}`;
}

export function toCompactJSON(obj) {
    return JSON.stringify(obj);
}

export function normalizeJson(obj) {

    // fuerza números limpios
    const clean = JSON.parse(JSON.stringify(obj, (k, v) => {

        if (typeof v === "number") {
            return Number(v); // elimina cosas raras tipo 1.0000000000000
        }

        return v;
    }));

    // stringify ultra compacto
    return JSON.stringify(clean);
}

/**
 * editor.js
 * cosas que debe hacer esta mierda:
 * - modificar jsons 
 * - exportar jsons modificados
 * - mostrar errores
 * - mostrar logs
 */

import { log, showError, showWarning } from "./helper.js";

/**
 * Modifica valores dentro de un JSON del nivel
 *
 * @param {Object} levelData  ← lo que devuelve descompacter
 * @param {String} jsonName  ← nombre del json (ej: "data.json")
 * @param {Object} changes   ← { bpm: 180}
 */

export function MDdata(levelData, jsonName, changes) {

    try {

        const target = levelData.jsons[jsonName];
        if (!target) return showWarning(`No existe ${jsonName}`);

        for (const path in changes) {

            const keys = path.split(".");
            let obj = target;

            while (keys.length > 1) {
                const k = keys.shift();
                if (!obj[k]) obj[k] = {};
                obj = obj[k];
            }

            obj[keys[0]] = changes[path];
        }

        log(`✏️ ${jsonName} actualizado`);

    } catch (err) {
        showError(err.message);
    }
}

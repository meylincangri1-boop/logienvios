
"use strict";

/*
 * LogiEnvíos — prototipo de interfaz.
 * Los datos de esta versión se guardan en localStorage del navegador.
 * La persistencia definitiva, SQL Server, MVC, DAO, autenticación y
 * exportación XLSX se implementarán en el backend Java.
 */

const STORAGE_KEY = "logienvios_prototipo_v2";
const ESTADOS = ["Registrado", "En envío", "Entregado"];
const PAGINAS = {
    inicio: "Resumen",
    registrar: "Registrar envío",
    envios: "Gestión de envíos",
    seguimiento: "Consultar seguimiento",
    reportes: "Reportes"
};

let envios = cargarEnvios();
let toastTimer = null;
let ultimoFoco = null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function escapar(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, caracter => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[caracter]);
}

function cargarEnvios() {
    try {
        const guardados = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        return Array.isArray(guardados)
            ? guardados.filter(item =>
                item && typeof item.codigo === "string" &&
                typeof item.remitente === "string" &&
                typeof item.destinatario === "string" &&
                ESTADOS.includes(item.estado)
            )
            : [];
    } catch (error) {
        console.warn("No se pudieron leer los datos locales.", error);
        return [];
    }
}

function guardarEnvios() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(envios));
        return true;
    } catch (error) {
        console.error("No se pudieron guardar los datos.", error);
        mostrarToast("No se pudieron guardar los cambios en este navegador.", true);
        return false;
    }
}

function fechaLegible(fecha) {
    const date = new Date(fecha);
    if (Number.isNaN(date.getTime())) return "Fecha no disponible";
    return new Intl.DateTimeFormat("es-PE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(date);
}

function fechaCorta(fecha) {
    const date = new Date(fecha);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("es-PE", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    }).format(date);
}

function claseEstado(estado) {
    if (estado === "Entregado") return "badge-entregado";
    if (estado === "En envío") return "badge-transito";
    return "badge-registrado";
}

function iconoEstado(estado) {
    if (estado === "Entregado") return "✓";
    if (estado === "En envío") return "➜";
    return "◷";
}

function contarEstado(estado) {
    return envios.filter(envio => envio.estado === estado).length;
}

function siguienteCodigo() {
    const mayor = envios.reduce((maximo, envio) => {
        const match = envio.codigo.match(/^ENV-(\d+)$/i);
        return match ? Math.max(maximo, Number(match[1])) : maximo;
    }, 1000);
    return `ENV-${mayor + 1}`;
}

function mostrarToast(mensaje, error = false) {
    const toast = $("#toast");
    $("#toastMessage").textContent = mensaje;
    $("#toastIcon").textContent = error ? "!" : "✓";
    toast.classList.toggle("error", error);
    toast.classList.remove("hidden");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add("hidden"), 3500);
}

function cambiarPagina(pagina) {
    if (!PAGINAS[pagina]) return;

    $$(".page-section").forEach(seccion => {
        seccion.classList.toggle("active", seccion.id === `page-${pagina}`);
    });

    $$(".nav-link").forEach(boton => {
        const activa = boton.dataset.page === pagina;
        boton.classList.toggle("active", activa);
        if (activa) boton.setAttribute("aria-current", "page");
        else boton.removeAttribute("aria-current");
    });

    $("#breadcrumbCurrent").textContent = PAGINAS[pagina];
    cerrarMenuMovil();
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (pagina === "inicio") renderInicio();
    if (pagina === "envios") renderLista();
    if (pagina === "reportes") renderReportes();
}

function cerrarMenuMovil() {
    $("#sidebar").classList.remove("open");
    $("#mobileOverlay").classList.remove("visible");
}

function abrirMenuMovil() {
    $("#sidebar").classList.add("open");
    $("#mobileOverlay").classList.add("visible");
}

function actualizarEstadisticas() {
    const total = envios.length;
    const registrado = contarEstado("Registrado");
    const transito = contarEstado("En envío");
    const entregado = contarEstado("Entregado");

    const valores = {
        statTotal: total,
        statRegistrado: registrado,
        statTransito: transito,
        statEntregado: entregado,
        listTotal: total,
        listRegistrado: registrado,
        listTransito: transito,
        listEntregado: entregado,
        reportTotal: total,
        reportRegistrado: registrado,
        reportTransito: transito,
        reportEntregado: entregado
    };

    Object.entries(valores).forEach(([id, valor]) => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.textContent = valor;
    });
}

function filaReciente(envio) {
    return `
        <tr>
            <td><span class="code-cell">${escapar(envio.codigo)}</span></td>
            <td><div class="person-cell"><strong>${escapar(envio.destinatario)}</strong><small>De: ${escapar(envio.remitente)}</small></div></td>
            <td>${escapar(envio.destino)}</td>
            <td><span class="status-badge ${claseEstado(envio.estado)}">${escapar(envio.estado)}</span></td>
            <td><button class="row-action" data-action="detalle" data-code="${escapar(envio.codigo)}" aria-label="Ver detalle de ${escapar(envio.codigo)}">···</button></td>
        </tr>`;
}

function renderInicio() {
    actualizarEstadisticas();

    const recientes = [...envios]
        .sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion))
        .slice(0, 5);

    $("#recentTable").innerHTML = recientes.map(filaReciente).join("");
    $("#recentEmpty").classList.toggle("hidden", recientes.length > 0);
    $(".recent-panel .table-wrap").classList.toggle("hidden", recientes.length === 0);
}

function renderLista() {
    actualizarEstadisticas();

    const texto = ($("#filtroTexto").value || "").trim().toLocaleLowerCase("es");
    const estado = $("#filtroEstado").value;

    const filtrados = [...envios]
        .filter(envio => {
            const cadena = [
                envio.codigo, envio.remitente, envio.destinatario,
                envio.origen, envio.destino, envio.descripcion
            ].join(" ").toLocaleLowerCase("es");

            return cadena.includes(texto) && (!estado || envio.estado === estado);
        })
        .sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion));

    $("#allTable").innerHTML = filtrados.map(envio => `
        <tr>
            <td><span class="code-cell">${escapar(envio.codigo)}</span></td>
            <td>${escapar(envio.remitente)}</td>
            <td>${escapar(envio.destinatario)}</td>
            <td title="${escapar(envio.origen)} → ${escapar(envio.destino)}">${escapar(envio.origen)} → ${escapar(envio.destino)}</td>
            <td>${escapar(fechaCorta(envio.fechaCreacion))}</td>
            <td><span class="status-badge ${claseEstado(envio.estado)}">${escapar(envio.estado)}</span></td>
            <td>
                <button class="row-action" data-action="detalle" data-code="${escapar(envio.codigo)}" title="Ver detalle" aria-label="Ver detalle">⌕</button>
                <button class="row-action" data-action="actualizar" data-code="${escapar(envio.codigo)}" title="Actualizar estado" aria-label="Actualizar estado">↻</button>
            </td>
        </tr>
    `).join("");

    $("#allEmpty").classList.toggle("hidden", filtrados.length > 0);
    $(".table-panel .table-wrap").classList.toggle("hidden", filtrados.length === 0);
    $("#tableCount").textContent = `${filtrados.length} ${filtrados.length === 1 ? "registro" : "registros"}`;
}

function renderReportes() {
    actualizarEstadisticas();

    const total = envios.length || 1;
    const estados = [
        { nombre: "Registrados", valor: contarEstado("Registrado"), clase: "fill-registrado" },
        { nombre: "En envío", valor: contarEstado("En envío"), clase: "fill-transito" },
        { nombre: "Entregados", valor: contarEstado("Entregado"), clase: "fill-entregado" }
    ];

    $("#reportBars").innerHTML = estados.map(item => {
        const porcentaje = Math.round(item.valor / total * 100);
        return `
            <div class="report-bar-row">
                <span>${item.nombre}</span>
                <div class="report-bar-track" role="progressbar" aria-label="${item.nombre}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${porcentaje}">
                    <div class="report-bar-fill ${item.clase}" style="width:${envios.length ? porcentaje : 0}%"></div>
                </div>
                <strong>${item.valor}</strong>
            </div>`;
    }).join("");
}

function crearEnvio(datos) {
    const ahora = new Date().toISOString();
    const envio = {
        codigo: siguienteCodigo(),
        remitente: datos.remitente.trim(),
        destinatario: datos.destinatario.trim(),
        origen: datos.origen.trim(),
        destino: datos.destino.trim(),
        descripcion: datos.descripcion.trim(),
        estado: "Registrado",
        fechaCreacion: ahora,
        historial: [{
            estado: "Registrado",
            fecha: ahora,
            nota: "Envío registrado en el sistema."
        }]
    };

    envios.push(envio);

    if (!guardarEnvios()) {
        envios.pop();
        return;
    }

    $("#formEnvio").reset();
    $("#contadorDescripcion").textContent = "0/500";
    renderTodo();
    mostrarToast(`Envío creado correctamente. Código: ${envio.codigo}`);

    abrirModal(envio.codigo, false);
}

function buscarEnvio(codigo) {
    const limpio = String(codigo || "").trim().toUpperCase();
    return envios.find(envio => envio.codigo.toUpperCase() === limpio);
}

function mostrarSeguimiento(codigo) {
    const envio = buscarEnvio(codigo);
    const resultado = $("#trackingResult");
    const placeholder = $("#trackingPlaceholder");

    if (!envio) {
        resultado.classList.add("hidden");
        placeholder.classList.remove("hidden");
        mostrarToast("No encontramos ese código. Revisa que esté escrito correctamente.", true);
        $("#codigoBusqueda").focus();
        return;
    }

    const orden = ESTADOS.indexOf(envio.estado);

    const pasos = ESTADOS.map((estado, indice) => {
        const completado = indice < orden;
        const actual = indice === orden;
        const evento = [...(envio.historial || [])]
            .reverse()
            .find(item => item.estado === estado);

        let detalle = "Pendiente de actualización";
        if (evento) detalle = fechaLegible(evento.fecha);
        if (actual && !evento) detalle = "Estado actual";

        return `
            <div class="timeline-item ${completado ? "done" : ""} ${actual ? "current" : ""}">
                <span class="timeline-marker">${completado ? "✓" : indice + 1}</span>
                <div class="timeline-copy">
                    <strong>${escapar(estado)}${actual ? " · Estado actual" : ""}</strong>
                    <small>${escapar(detalle)}</small>
                    ${evento && evento.nota ? `<small>${escapar(evento.nota)}</small>` : ""}
                </div>
            </div>`;
    }).join("");

    resultado.innerHTML = `
        <article class="tracking-card">
            <div class="tracking-card-head">
                <div><p>CÓDIGO DE SEGUIMIENTO</p><h2>${escapar(envio.codigo)}</h2></div>
                <span class="status-badge ${claseEstado(envio.estado)}">${escapar(envio.estado)}</span>
            </div>
            <div class="tracking-route">
                <div class="route-point"><small>Origen</small><strong>${escapar(envio.origen)}</strong></div>
                <div class="route-arrow">→</div>
                <div class="route-point"><small>Destino</small><strong>${escapar(envio.destino)}</strong></div>
            </div>
            <div class="tracking-timeline">
                <h3>Historial de seguimiento</h3>
                ${pasos}
                <p class="page-subtitle">Destinatario: ${escapar(envio.destinatario)} · Registro: ${escapar(fechaCorta(envio.fechaCreacion))}</p>
            </div>
        </article>`;

    resultado.classList.remove("hidden");
    placeholder.classList.add("hidden");
}

function abrirModal(codigo, editarEstado = true) {
    const envio = buscarEnvio(codigo);
    if (!envio) {
        mostrarToast("El envío ya no está disponible.", true);
        return;
    }

    ultimoFoco = document.activeElement;

    const historial = [...(envio.historial || [])].reverse().map(item => `
        <div class="history-line">
            <span class="history-bullet"></span>
            <div><strong>${escapar(item.estado)}</strong><small>${escapar(fechaLegible(item.fecha))} · ${escapar(item.nota || "")}</small></div>
        </div>
    `).join("");

    const opciones = ESTADOS.map(estado =>
        `<option value="${escapar(estado)}" ${estado === envio.estado ? "selected" : ""}>${escapar(estado)}</option>`
    ).join("");

    $("#modalTitle").textContent = `Envío ${envio.codigo}`;
    $("#modalContent").innerHTML = `
        <div class="modal-body">
            <div class="detail-grid">
                <div class="detail-item"><small>Código de seguimiento</small><strong>${escapar(envio.codigo)}</strong></div>
                <div class="detail-item"><small>Estado actual</small><strong><span class="status-badge ${claseEstado(envio.estado)}">${escapar(envio.estado)}</span></strong></div>
                <div class="detail-item"><small>Remitente</small><strong>${escapar(envio.remitente)}</strong></div>
                <div class="detail-item"><small>Destinatario</small><strong>${escapar(envio.destinatario)}</strong></div>
                <div class="detail-item"><small>Origen</small><strong>${escapar(envio.origen)}</strong></div>
                <div class="detail-item"><small>Destino</small><strong>${escapar(envio.destino)}</strong></div>
                <div class="detail-item detail-full"><small>Descripción</small><strong>${escapar(envio.descripcion)}</strong></div>
                <div class="detail-item detail-full"><small>Fecha de registro</small><strong>${escapar(fechaLegible(envio.fechaCreacion))}</strong></div>
            </div>
            <div class="detail-history"><h3>Historial de cambios de estado</h3>${historial || "<p>No hay movimientos registrados.</p>"}</div>
            ${editarEstado ? `
                <div class="status-editor">
                    <label for="nuevoEstado">Actualizar estado del envío</label>
                    <div class="status-editor-row">
                        <select id="nuevoEstado">${opciones}</select>
                        <button class="btn btn-primary" id="btnGuardarEstado" data-code="${escapar(envio.codigo)}">Guardar estado</button>
                    </div>
                </div>` : ""}
        </div>`;

    $("#modalBackdrop").classList.remove("hidden");
    $("#btnCerrarModal").focus();
}

function cerrarModal() {
    $("#modalBackdrop").classList.add("hidden");
    if (ultimoFoco && typeof ultimoFoco.focus === "function") ultimoFoco.focus();
}

function actualizarEstado(codigo, nuevoEstado) {
    const envio = buscarEnvio(codigo);
    if (!envio || !ESTADOS.includes(nuevoEstado)) {
        mostrarToast("No se pudo actualizar el estado.", true);
        return;
    }

    if (envio.estado === nuevoEstado) {
        mostrarToast("El envío ya tiene ese estado.");
        return;
    }

    const estadoAnterior = envio.estado;
    const historialAnterior = [...(envio.historial || [])];

    envio.estado = nuevoEstado;
    envio.historial = [
        ...(envio.historial || []),
        {
            estado: nuevoEstado,
            fecha: new Date().toISOString(),
            nota: `Estado actualizado de "${estadoAnterior}" a "${nuevoEstado}".`
        }
    ];

    if (!guardarEnvios()) {
        envio.estado = estadoAnterior;
        envio.historial = historialAnterior;
        return;
    }

    renderTodo();
    abrirModal(codigo, true);
    mostrarToast(`Estado actualizado a "${nuevoEstado}".`);
}

function exportarCSV() {
    if (envios.length === 0) {
        mostrarToast("No hay envíos para exportar.", true);
        return;
    }

    const columnas = [
        ["Código", "codigo"],
        ["Remitente", "remitente"],
        ["Destinatario", "destinatario"],
        ["Origen", "origen"],
        ["Destino", "destino"],
        ["Descripción", "descripcion"],
        ["Estado", "estado"],
        ["Fecha de registro", "fechaCreacion"]
    ];

    const protegerCSV = valor => {
        let texto = String(valor ?? "");
        // Evita que Excel interprete valores del usuario como fórmulas.
        if (/^[\s]*[=+\-@]/.test(texto)) texto = "'" + texto;
        return `"${texto.replace(/"/g, '""')}"`;
    };

    const filas = [
        columnas.map(columna => protegerCSV(columna[0])).join(";"),
        ...envios.map(envio => columnas.map(([, clave]) => {
            const valor = clave === "fechaCreacion"
                ? fechaLegible(envio[clave])
                : envio[clave];
            return protegerCSV(valor);
        }).join(";"))
    ];

    const contenido = "\uFEFF" + filas.join("\r\n");
    const blob = new Blob([contenido], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = `reporte_envios_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);

    mostrarToast("Reporte CSV descargado. Puedes abrirlo con Excel.");
}

function renderTodo() {
    renderInicio();
    renderLista();
    renderReportes();
}

function validarCampo(input) {
    const valor = input.value.trim();
    if (input.required && !valor) {
        input.setCustomValidity("Completa este campo.");
        return false;
    }
    if (valor.length > Number(input.maxLength) && input.maxLength > 0) {
        input.setCustomValidity("El texto es demasiado largo.");
        return false;
    }
    input.setCustomValidity("");
    return true;
}

function mostrarAyuda() {
    ultimoFoco = document.activeElement;
    $("#modalTitle").textContent = "Guía rápida de LogiEnvíos";
    $("#modalContent").innerHTML = `
        <div class="modal-body">
            <div class="detail-item"><strong>1. Registrar un envío</strong><p class="page-subtitle">Completa remitente, destinatario, origen, destino y descripción. El prototipo asigna un código único.</p></div>
            <div class="detail-item" style="margin-top:17px"><strong>2. Gestionar el estado</strong><p class="page-subtitle">En Gestión de envíos, abre el detalle del pedido y selecciona Registrado, En envío o Entregado. El cambio queda en el historial local.</p></div>
            <div class="detail-item" style="margin-top:17px"><strong>3. Consultar un pedido</strong><p class="page-subtitle">En Consultar seguimiento, introduce el código del envío para ver el estado y los movimientos disponibles.</p></div>
            <div class="detail-item" style="margin-top:17px"><strong>4. Exportar los datos</strong><p class="page-subtitle">La versión de demostración permite descargar un CSV compatible con Excel. La exportación XLSX real requiere el servicio Java con Apache POI.</p></div>
            <div class="form-notice" style="margin-top:20px"><span>ⓘ</span><p>Los registros se almacenan únicamente en este navegador. No son visibles desde otros dispositivos ni constituyen todavía una base de datos centralizada.</p></div>
        </div>`;
    $("#modalBackdrop").classList.remove("hidden");
    $("#btnCerrarModal").focus();
}

function inicializarEventos() {
    $$("[data-page]").forEach(boton => {
        boton.addEventListener("click", () => cambiarPagina(boton.dataset.page));
    });

    $$("[data-go]").forEach(boton => {
        boton.addEventListener("click", () => cambiarPagina(boton.dataset.go));
    });

    $("#btnMenu").addEventListener("click", abrirMenuMovil);
    $("#mobileOverlay").addEventListener("click", cerrarMenuMovil);

    $("#btnAyuda").addEventListener("click", mostrarAyuda);
    $("#btnAyudaTop").addEventListener("click", mostrarAyuda);
    $("#btnPerfil").addEventListener("click", () => {
        mostrarToast("Cuenta de demostración. El inicio de sesión real requiere el backend Java.");
    });

    $("#formEnvio").addEventListener("submit", evento => {
        evento.preventDefault();

        const form = evento.currentTarget;
        const campos = ["remitente", "destinatario", "origen", "destino", "descripcion"]
            .map(id => document.getElementById(id));

        let valido = true;
        campos.forEach(campo => {
            if (!validarCampo(campo)) valido = false;
        });

        if (!valido || !form.reportValidity()) {
            mostrarToast("Revisa los campos obligatorios antes de guardar.", true);
            return;
        }

        crearEnvio({
            remitente: $("#remitente").value,
            destinatario: $("#destinatario").value,
            origen: $("#origen").value,
            destino: $("#destino").value,
            descripcion: $("#descripcion").value
        });
    });

    $("#formEnvio").addEventListener("reset", () => {
        setTimeout(() => $("#contadorDescripcion").textContent = "0/500", 0);
    });

    $("#descripcion").addEventListener("input", evento => {
        $("#contadorDescripcion").textContent = `${evento.target.value.length}/500`;
    });

    $("#filtroTexto").addEventListener("input", renderLista);
    $("#filtroEstado").addEventListener("change", renderLista);

    $("#btnLimpiarFiltros").addEventListener("click", () => {
        $("#filtroTexto").value = "";
        $("#filtroEstado").value = "";
        renderLista();
    });

    $("#formSeguimiento").addEventListener("submit", evento => {
        evento.preventDefault();
        mostrarSeguimiento($("#codigoBusqueda").value);
    });

    document.addEventListener("click", evento => {
        const boton = evento.target.closest("[data-action]");
        if (!boton) return;

        const codigo = boton.dataset.code;
        if (boton.dataset.action === "detalle") abrirModal(codigo, true);
        if (boton.dataset.action === "actualizar") abrirModal(codigo, true);
    });

    $("#modalContent").addEventListener("click", evento => {
        const boton = evento.target.closest("#btnGuardarEstado");
        if (!boton) return;
        actualizarEstado(boton.dataset.code, $("#nuevoEstado").value);
    });

    $("#btnCerrarModal").addEventListener("click", cerrarModal);
    $("#btnCerrarModalFooter").addEventListener("click", cerrarModal);

    $("#modalBackdrop").addEventListener("click", evento => {
        if (evento.target === $("#modalBackdrop")) cerrarModal();
    });

    document.addEventListener("keydown", evento => {
        if (evento.key === "Escape") {
            cerrarModal();
            cerrarMenuMovil();
        }
    });

    $("#btnExportar").addEventListener("click", exportarCSV);
    $("#btnExportarReportes").addEventListener("click", exportarCSV);
}

function iniciar() {
    inicializarEventos();
    renderTodo();
}

iniciar();

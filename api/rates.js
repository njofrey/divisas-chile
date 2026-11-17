// Cada moneda se pide a varias fuentes a la vez y gana la primera respuesta
// valida. Desde nov 2026 mindicador.cl tarda 20-60 s o no responde, y
// datos.gov.co tarda entre 2 y 14 s.

const CHILE_TZ = 'America/Santiago';
const TIMEOUT_MS = 9000;

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const esNumeroValido = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;

// Devuelve el dia actual en Chile como "YYYY-MM-DD".
export function diaEnChile(fecha = new Date()) {
    const partes = new Intl.DateTimeFormat('en-US', {
        timeZone: CHILE_TZ, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(fecha);
    const v = (tipo) => partes.find((p) => p.type === tipo).value;
    return `${v('year')}-${v('month')}-${v('day')}`;
}

async function pedir(url, tipo = 'json') {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    return tipo === 'json' ? response.json() : response.text();
}

function exigirNumero(valor, fuente) {
    if (!esNumeroValido(valor)) throw new Error(`${fuente}: valor invalido`);
    return valor;
}

// mindicador.cl y findic.cl usan el mismo formato: { serie: [{ fecha, valor }] }.
async function desdeSerie(base, codigo) {
    const data = await pedir(`${base}/api/${codigo}`);
    return exigirNumero(data?.serie?.[0]?.valor, base);
}

async function desdeBoostr(codigo) {
    const data = await pedir(`https://api.boostr.cl/economy/indicator/${codigo}.json`);
    return exigirNumero(data?.data?.value, 'boostr');
}

// Lee la tabla anual de UF del SII y devuelve el valor de un dia.
// Cada mes es un bloque id='mes_noviembre' con pares
// <th><strong>DIA</strong></th><td>41.350,42</td>.
export function leerTablaSii(html, dia) {
    const [, mes, d] = dia.split('-');
    const inicio = html.indexOf(`id='mes_${MESES[Number(mes) - 1]}'`);
    if (inicio === -1) return null;
    const fin = html.indexOf("class='meses'", inicio + 1);
    const bloque = html.slice(inicio, fin === -1 ? undefined : fin);
    const patron = /<strong>\s*(\d{1,2})\s*<\/strong>\s*<\/th>\s*<td[^>]*>\s*([\d.]+,\d+)\s*<\/td>/g;
    for (const [, diaTabla, texto] of bloque.matchAll(patron)) {
        if (Number(diaTabla) === Number(d)) {
            const valor = Number(texto.replace(/\./g, '').replace(',', '.'));
            return esNumeroValido(valor) ? valor : null;
        }
    }
    return null;
}

async function ufDesdeSii() {
    const hoy = diaEnChile();
    const html = await pedir(`https://www.sii.cl/valores_y_fechas/uf/uf${hoy.slice(0, 4)}.htm`, 'text');
    return exigirNumero(leerTablaSii(html, hoy), 'sii');
}

// Pesos colombianos por dolar (TRM oficial de Colombia).
async function copDesdeDatosGov() {
    const data = await pedir('https://www.datos.gov.co/resource/mcec-87by.json?$limit=1&$order=vigenciadesde%20DESC');
    return exigirNumero(parseFloat(data?.[0]?.valor), 'datos.gov.co');
}

// Respaldo del peso colombiano: tasa de mercado, no la TRM oficial.
async function copDesdeErApi() {
    const data = await pedir('https://open.er-api.com/v6/latest/USD');
    return exigirNumero(data?.rates?.COP, 'open.er-api');
}

async function arsDesdeBluelytics() {
    const data = await pedir('https://api.bluelytics.com.ar/v2/latest');
    return exigirNumero(data?.blue?.value_sell, 'bluelytics');
}

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Primera fuente que responde bien, o null si todas fallan.
const primera = (intentos) => Promise.any(intentos.map((f) => f())).catch(() => null);

const MINDICADOR = 'https://mindicador.cl';
const FINDIC = 'https://findic.cl';

export async function obtenerTasas() {
    const [uf, usd, eur, ars, cop] = await Promise.all([
        primera([() => desdeSerie(MINDICADOR, 'uf'), ufDesdeSii, () => desdeSerie(FINDIC, 'uf')]),
        primera([() => desdeSerie(MINDICADOR, 'dolar'), () => desdeSerie(FINDIC, 'dolar'), () => desdeBoostr('dolar')]),
        primera([() => desdeSerie(MINDICADOR, 'euro'), () => desdeSerie(FINDIC, 'euro'), () => desdeBoostr('euro')]),
        primera([arsDesdeBluelytics]),
        // La TRM oficial tiene 3 s de ventaja antes de pedir la tasa de mercado.
        primera([copDesdeDatosGov, () => esperar(3000).then(copDesdeErApi)])
    ]);
    return { uf, usd, eur, ars, cop };
}

export default async function handler(req, res) {
    try {
        const rates = await obtenerTasas();
        const valores = Object.values(rates);
        if (valores.every((v) => v === null)) {
            throw new Error('All upstream APIs failed');
        }
        // Si falta alguna moneda, se cachea poco para reintentar pronto.
        res.setHeader('Cache-Control', valores.includes(null)
            ? 's-maxage=300, stale-while-revalidate=86400'
            : 's-maxage=3600, stale-while-revalidate=86400');
        res.status(200).json(rates);
    } catch (error) {
        res.setHeader('Cache-Control', 'no-store');
        res.status(500).json({ error: 'No se pudieron obtener las tasas de cambio' });
    }
}

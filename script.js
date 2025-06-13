document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos del DOM ---
    const amountInput = document.getElementById('amount-input');
    const currencySelector = document.getElementById('currency-selector');
    const resultsContainer = document.getElementById('results-container');
    const ufRateDisplay = document.getElementById('uf-rate-display');

    // --- Tasas de cambio ---
    let rates = { uf: 0, usd: 0, eur: 0, ars: 0, cop: 0 };

    // --- FUNCIÓN PRINCIPAL PARA OBTENER DATOS DE APIs ---
    async function fetchAllRates() {
        try {
            // ... (Peticiones a las APIs se mantienen igual)
            const [ufResponse, dolarResponse, euroResponse, arsResponse, copResponse] = await Promise.all([
                fetch('https://mindicador.cl/api/uf'),
                fetch('https://mindicador.cl/api/dolar'),
                fetch('https://mindicador.cl/api/euro'),
                fetch('https://api.bluelytics.com.ar/v2/latest'),
                fetch('https://www.datos.gov.co/resource/mcec-87by.json')
            ]);
            
            const ufData = await ufResponse.json();
            rates.uf = ufData.serie[0].valor;
            
            // <-- 2. AÑADIR LA FECHA ACTUAL ---
            const today = new Date();
            const dateOptions = { day: 'numeric', month: 'long', year: 'numeric' };
            const formattedDate = today.toLocaleDateString('es-CL', dateOptions);
            const formattedUfValue = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(rates.uf);
            ufRateDisplay.textContent = `UF hoy ${formattedDate}: ${formattedUfValue}`;

            // ... (El resto de la carga de datos se mantiene igual)
            const dolarData = await dolarResponse.json();
            rates.usd = dolarData.serie[0].valor;
            const euroData = await euroResponse.json();
            rates.eur = euroData.serie[0].valor;
            const arsData = await arsResponse.json();
            rates.ars = arsData.blue.value_sell;
            const copData = await copResponse.json();
            rates.cop = parseFloat(copData[0].valor);

            renderAndCalculate();
        } catch (error) {
            resultsContainer.innerHTML = `<p>Error al cargar las tasas de cambio.</p>`;
            console.error("Error fetching rates:", error);
        }
    }

    // --- FUNCIÓN PARA CALCULAR Y MOSTRAR RESULTADOS ---
    function renderAndCalculate() {
        const rawValue = amountInput.value.replace(/\./g, ''); 
        const amount = parseFloat(rawValue) || 0;
        const sourceCurrency = currencySelector.value;
        
        let primaryResult, secondaryResults;

        if (sourceCurrency === 'uf') {
            const totalClp = amount * rates.uf;
            primaryResult = { code: 'CLP', value: totalClp };
            secondaryResults = [
                { code: 'USD', value: totalClp / rates.usd },
                { code: 'EUR', value: totalClp / rates.eur },
                { code: 'ARS', value: (totalClp / rates.usd) * rates.ars },
                { code: 'COP', value: (totalClp / rates.usd) * rates.cop },
            ];
        } else {
            const totalUf = amount / rates.uf;
            primaryResult = { code: 'UF', value: totalUf };
            secondaryResults = [
                { code: 'USD', value: amount / rates.usd },
                { code: 'EUR', value: amount / rates.eur },
                { code: 'ARS', value: (amount / rates.usd) * rates.ars },
                { code: 'COP', value: (amount / rates.usd) * rates.cop },
            ];
        }
        displayResults(primaryResult, secondaryResults);
    }

    // --- FUNCIÓN PARA MOSTRAR LOS RESULTADOS EN EL HTML ---
    function displayResults(primary, secondaries) {
        // <-- 1. AJUSTE EN LOS FORMATEADORES PARA TRUNCAR DECIMALES ---
        const formatters = {
            // Monedas se muestran como enteros
            CLP: new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }),
            USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
            EUR: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }),
            ARS: new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }),
            COP: new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }),
            // UF mantiene sus decimales por ser un índice
            UF: new Intl.NumberFormat('es-CL', { minimumFractionDigits: 4, maximumFractionDigits: 4 }),
        };
        
        // Se añade el atributo data-code para saber qué moneda se copia
        let html = `<div class="result-main" data-value="${primary.value}" data-code="${primary.code}"><h2>Equivalente en ${primary.code}</h2><p>${formatters[primary.code].format(primary.value)}</p></div><div class="secondary-results">`;
        secondaries.forEach(result => {
            html += `<div class="secondary-result" data-value="${result.value}" data-code="${result.code}"><h2>${result.code}</h2><p>${formatters[result.code].format(result.value)}</p></div>`;
        });
        html += `</div>`;
        resultsContainer.innerHTML = html;
        addCopyListeners();
    }

    // --- FUNCIÓN PARA COPIAR AL PORTAPAPELES (VERSIÓN CON TRUNCAMIENTO) ---
    function addCopyListeners() {
        document.querySelectorAll('[data-value]').forEach(element => {
            let timeoutId = null;
            element.addEventListener('click', () => {
                if (element.dataset.timeoutId) {
                    clearTimeout(parseInt(element.dataset.timeoutId));
                }

                const valueToCopy = element.getAttribute('data-value');
                const code = element.getAttribute('data-code'); // Obtenemos el código de la moneda
                let stringToCopy;

                // <-- 1. LÓGICA DE COPIADO INTELIGENTE ---
                // Si es UF, copia con decimales. Para el resto, copia solo el entero.
                if (code === 'UF') {
                    stringToCopy = parseFloat(valueToCopy).toFixed(4);
                } else {
                    stringToCopy = parseInt(valueToCopy, 10).toString();
                }
                
                navigator.clipboard.writeText(stringToCopy)
                    .then(() => {
                        const originalText = element.querySelector('p').innerText;
                        element.querySelector('p').innerText = '¡Copiado!';
                        const newTimeoutId = setTimeout(() => {
                            element.querySelector('p').innerText = originalText;
                        }, 1200);
                        element.dataset.timeoutId = newTimeoutId;
                    })
                    .catch(err => console.error('Error al copiar:', err));
            });
        });
    }

    // --- FUNCIÓN PARA FORMATEAR EL INPUT MIENTRAS SE ESCRIBE ---
    amountInput.addEventListener('input', (e) => {
        let value = e.target.value;
        let numericValue = value.replace(/[^\d]/g, '');
        if (numericValue) {
            e.target.value = new Intl.NumberFormat('es-CL').format(numericValue);
        } else {
            e.target.value = '';
        }
        renderAndCalculate();
    });

    // --- INICIALIZACIÓN ---
    currencySelector.addEventListener('change', renderAndCalculate);
    fetchAllRates();
});
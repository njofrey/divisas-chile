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
            const [ufResponse, dolarResponse, euroResponse, arsResponse, copResponse] = await Promise.all([
                fetch('https://mindicador.cl/api/uf'),
                fetch('https://mindicador.cl/api/dolar'),
                fetch('https://mindicador.cl/api/euro'),
                fetch('https://api.bluelytics.com.ar/v2/latest'),
                fetch('https://www.datos.gov.co/resource/mcec-87by.json')
            ]);
            
            // CORRECCIÓN DEL ERROR: Usar [0] en vez de ['0']
            const ufData = await ufResponse.json();
            rates.uf = ufData.serie[0].valor;
            const dolarData = await dolarResponse.json();
            rates.usd = dolarData.serie[0].valor;
            const euroData = await euroResponse.json();
            rates.eur = euroData.serie[0].valor;
            
            const arsData = await arsResponse.json();
            rates.ars = arsData.blue.value_sell;
            const copData = await copResponse.json();
            rates.cop = parseFloat(copData[0].valor);

            const today = new Date();
            const dateOptions = { day: 'numeric', month: 'long', year: 'numeric' };
            const formattedDate = today.toLocaleDateString('es-CL', dateOptions);
            const formattedUfValue = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(rates.uf);
            ufRateDisplay.textContent = `UF hoy ${formattedDate}: ${formattedUfValue}`;

            updateInputPlaceholder();
            renderAndCalculate();
        } catch (error) {
            resultsContainer.innerHTML = `<p>Error al cargar las tasas. Intenta de nuevo.</p>`;
            console.error("Error fetching rates:", error);
        }
    }

    // --- FUNCIÓN PARA ACTUALIZAR EL PLACEHOLDER DEL INPUT ---
    function updateInputPlaceholder() {
        const selectedCurrency = currencySelector.value;
        if (selectedCurrency === 'uf') amountInput.placeholder = 'Ej: 1';
        else if (selectedCurrency === 'clp') amountInput.placeholder = 'Ej: 1.000';
        else if (selectedCurrency === 'usd') amountInput.placeholder = 'Ej: 10';
    }

    // --- LÓGICA DE CÁLCULO REFACTORIZADA Y MÁS ROBUSTA ---
    function renderAndCalculate() {
        const rawValue = amountInput.value.replace(/\./g, ''); 
        const amount = parseFloat(rawValue) || 0;
        const sourceCurrency = currencySelector.value;

        // 1. Normalizar todo a un valor base: CLP
        let totalClp = 0;
        if (sourceCurrency === 'uf') totalClp = amount * rates.uf;
        else if (sourceCurrency === 'usd') totalClp = amount * rates.usd;
        else totalClp = amount;

        // 2. Calcular todos los posibles valores a partir del CLP base
        const allValues = {
            CLP: totalClp,
            UF: totalClp / rates.uf,
            USD: totalClp / rates.usd,
            EUR: totalClp / rates.eur,
            ARS: (totalClp / rates.usd) * rates.ars,
            COP: (totalClp / rates.usd) * rates.cop,
        };

        // 3. Decidir cuál es el resultado principal y cuáles los secundarios
        let primaryCode;
        if (sourceCurrency === 'clp') primaryCode = 'UF';
        else primaryCode = 'CLP';
        
        const primaryResult = { code: primaryCode, value: allValues[primaryCode] };
        
        const secondaryCodes = ['USD', 'EUR', 'ARS', 'COP', 'UF', 'CLP'].filter(
            code => code !== sourceCurrency.toUpperCase() && code !== primaryCode
        );
        const secondaryResults = secondaryCodes.map(code => ({ code, value: allValues[code] }));
        
        displayResults(primaryResult, secondaryResults);
    }

    // --- FUNCIÓN PARA MOSTRAR LOS RESULTADOS EN EL HTML ---
    function displayResults(primary, secondaries) {
        const formatters = {
            CLP: new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }),
            USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
            EUR: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }),
            ARS: new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }),
            COP: new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }),
            UF: new Intl.NumberFormat('es-CL', { minimumFractionDigits: 4, maximumFractionDigits: 4 }),
        };
        
        let html = `<div class="result-main" data-value="${primary.value}" data-code="${primary.code}"><h2>Equivalente en ${primary.code}</h2><p>${formatters[primary.code].format(primary.value)}</p></div><div class="secondary-results">`;
        secondaries.forEach(result => {
            html += `<div class="secondary-result" data-value="${result.value}" data-code="${result.code}"><h2>${result.code}</h2><p>${formatters[result.code].format(result.value)}</p></div>`;
        });
        html += `</div>`;
        resultsContainer.innerHTML = html;
        addCopyListeners();
    }

    // --- FUNCIÓN PARA COPIAR AL PORTAPAPELES ---
    function addCopyListeners() {
        document.querySelectorAll('[data-value]').forEach(element => {
            let timeoutId = null;
            element.addEventListener('click', () => {
                if (element.dataset.timeoutId) clearTimeout(parseInt(element.dataset.timeoutId));
                const valueToCopy = element.getAttribute('data-value');
                const code = element.getAttribute('data-code');
                let stringToCopy;
                if (code === 'UF') stringToCopy = parseFloat(valueToCopy).toFixed(4);
                else stringToCopy = parseInt(valueToCopy, 10).toString();
                navigator.clipboard.writeText(stringToCopy)
                    .then(() => {
                        const originalText = element.querySelector('p').innerText;
                        element.querySelector('p').innerText = '¡Copiado!';
                        const newTimeoutId = setTimeout(() => { element.querySelector('p').innerText = originalText; }, 1200);
                        element.dataset.timeoutId = newTimeoutId;
                    }).catch(err => console.error('Error al copiar:', err));
            });
        });
    }

    // --- FUNCIÓN PARA FORMATEAR EL INPUT MIENTRAS SE ESCRIBE ---
    amountInput.addEventListener('input', () => {
        let value = amountInput.value;
        let numericValue = value.replace(/[^\d]/g, '');
        if (numericValue) amountInput.value = new Intl.NumberFormat('es-CL').format(numericValue);
        else amountInput.value = '';
        renderAndCalculate();
    });

    // --- INICIALIZACIÓN ---
    currencySelector.addEventListener('change', () => {
        updateInputPlaceholder();
        renderAndCalculate();
    });
    fetchAllRates();
});

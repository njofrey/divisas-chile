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

            const ufData = await ufResponse.json();
            rates.uf = ufData.serie['0'].valor;

            const today = new Date();
            const dateOptions = { day: 'numeric', month: 'long', year: 'numeric' };
            const formattedDate = today.toLocaleDateString('es-CL', dateOptions);
            const formattedUfValue = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(rates.uf);
            ufRateDisplay.textContent = `UF hoy ${formattedDate}: ${formattedUfValue}`;

            const dolarData = await dolarResponse.json();
            rates.usd = dolarData.serie['0'].valor;
            const euroData = await euroResponse.json();
            rates.eur = euroData.serie['0'].valor;
            const arsData = await arsResponse.json();
            rates.ars = arsData.blue.value_sell;
            const copData = await copResponse.json();
            rates.cop = parseFloat(copData['0'].valor);

            updateInputPlaceholder(currencySelector.value);
            renderAndCalculate();
        } catch (error) {
            resultsContainer.innerHTML = `<p>Error al cargar las tasas de cambio.</p>`;
            console.error("Error fetching rates:", error);
        }
    }

    // --- FUNCIÓN PARA ACTUALIZAR EL PLACEHOLDER DEL INPUT ---
    function updateInputPlaceholder(currency) {
        if (currency === 'uf') {
            amountInput.placeholder = 'Ej: 1';
        } else if (currency === 'clp') {
            amountInput.placeholder = 'Ej: 1.000';
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
                { code: 'EUR', value: totalClp / rates.

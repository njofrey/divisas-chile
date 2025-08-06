document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos del DOM ---
    const amountInput = document.getElementById('amount-input');
    const currencySelector = document.getElementById('currency-selector');
    const resultsContainer = document.getElementById('results-container');
    const ufRateDisplay = document.getElementById('uf-rate-display');

    // --- Tasas de cambio ---
    let rates = { uf: 0, usd: 0, eur: 0, ars: 0, cop: 0 };

    // --- FUNCIÓN PRINCIPAL PARA OBTENER DATOS DE APIs (CON VALIDACIÓN) ---
    async function fetchAllRates() {
        try {
            const [ufResponse, dolarResponse, euroResponse, arsResponse, copResponse] = await Promise.all([
                fetch('https://mindicador.cl/api/uf'),
                fetch('https://mindicador.cl/api/dolar'),
                fetch('https://mindicador.cl/api/euro'),
                fetch('https://api.bluelytics.com.ar/v2/latest'),
                fetch('https://www.datos.gov.co/resource/mcec-87by.json')
            ]);
            
            // Validar respuestas HTTP
            if (!ufResponse.ok || !dolarResponse.ok || !euroResponse.ok || !arsResponse.ok || !copResponse.ok) {
                throw new Error('Error en la respuesta de una o más APIs');
            }
            
            const ufData = await ufResponse.json();
            const dolarData = await dolarResponse.json();
            const euroData = await euroResponse.json();
            const arsData = await arsResponse.json();
            const copData = await copResponse.json();
            
            // Validar y asignar datos de forma segura
            if (ufData?.serie?.[0]?.valor && typeof ufData.serie[0].valor === 'number') {
                rates.uf = ufData.serie[0].valor;
            } else {
                throw new Error('Datos de UF inválidos');
            }
            
            if (dolarData?.serie?.[0]?.valor && typeof dolarData.serie[0].valor === 'number') {
                rates.usd = dolarData.serie[0].valor;
            } else {
                throw new Error('Datos de USD inválidos');
            }
            
            if (euroData?.serie?.[0]?.valor && typeof euroData.serie[0].valor === 'number') {
                rates.eur = euroData.serie[0].valor;
            } else {
                throw new Error('Datos de EUR inválidos');
            }
            
            if (arsData?.blue?.value_sell && typeof arsData.blue.value_sell === 'number') {
                rates.ars = arsData.blue.value_sell;
            } else {
                throw new Error('Datos de ARS inválidos');
            }
            
            if (copData?.[0]?.valor && !isNaN(parseFloat(copData[0].valor))) {
                rates.cop = parseFloat(copData[0].valor);
            } else {
                throw new Error('Datos de COP inválidos');
            }
            
            // Mostrar UF del día de forma segura
            const today = new Date();
            const dateOptions = { day: 'numeric', month: 'long', year: 'numeric' };
            const formattedDate = today.toLocaleDateString('es-CL', dateOptions);
            const formattedUfValue = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(rates.uf);
            ufRateDisplay.textContent = `UF hoy ${formattedDate}: ${formattedUfValue}`;

            renderAndCalculate();
        } catch (error) {
            // Error handling mejorado
            ufRateDisplay.textContent = 'Error al cargar el valor de la UF';
            resultsContainer.innerHTML = '';
            const errorDiv = document.createElement('p');
            errorDiv.textContent = 'Error al cargar las tasas de cambio. Inténtalo más tarde.';
            errorDiv.style.color = '#d32f2f';
            errorDiv.style.textAlign = 'center';
            resultsContainer.appendChild(errorDiv);
            console.error("Error fetching rates:", error);
        }
    }

    // --- FUNCIÓN PARA CALCULAR Y MOSTRAR RESULTADOS (PARSING MEJORADO) ---
    function renderAndCalculate() {
        let rawValue = amountInput.value;
        // Regex mejorado: remover separadores de miles pero preservar coma decimal
        rawValue = rawValue.replace(/\.(?=\d{3}(?!\d))/g, '').replace(/,/, '.');
        const amount = parseFloat(rawValue) || 0;
        const sourceCurrency = document.querySelector('.currency-pills .pill.active').dataset.value;
        
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
        } else if (sourceCurrency === 'clp') {
            const totalUf = amount / rates.uf;
            primaryResult = { code: 'UF', value: totalUf };
            secondaryResults = [
                { code: 'USD', value: amount / rates.usd },
                { code: 'EUR', value: amount / rates.eur },
                { code: 'ARS', value: (amount / rates.usd) * rates.ars },
                { code: 'COP', value: (amount / rates.usd) * rates.cop },
            ];
        } else if (sourceCurrency === 'usd') {
            const totalClp = amount * rates.usd;
            primaryResult = { code: 'CLP', value: totalClp };
            secondaryResults = [
                { code: 'UF', value: totalClp / rates.uf },
                { code: 'EUR', value: amount * rates.usd / rates.eur },
                { code: 'ARS', value: amount * rates.ars },
                { code: 'COP', value: amount * rates.cop },
            ];
        } else if (sourceCurrency === 'cop') {
            const amountInUsd = amount / rates.cop;
            const totalClp = amountInUsd * rates.usd;
            primaryResult = { code: 'CLP', value: totalClp };
            secondaryResults = [
                { code: 'UF', value: totalClp / rates.uf },
                { code: 'USD', value: amountInUsd },
                { code: 'EUR', value: totalClp / rates.eur },
                { code: 'ARS', value: amountInUsd * rates.ars },
            ];
        }
        displayResults(primaryResult, secondaryResults);
    }

    // --- FUNCIÓN PARA MOSTRAR LOS RESULTADOS EN EL HTML (VERSIÓN SEGURA) ---
    function displayResults(primary, secondaries) {
        const formatters = {
            CLP: new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }),
            USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }),
            EUR: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }),
            ARS: new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }),
            COP: new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }),
            UF: new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 4 }),
        };
        
        // Limpiar contenedor
        resultsContainer.innerHTML = '';
        
        // Crear elemento principal de forma segura
        const mainResult = document.createElement('div');
        mainResult.className = 'result-main';
        mainResult.setAttribute('data-value', primary.value);
        mainResult.setAttribute('data-code', primary.code);
        
        const mainTitle = document.createElement('h2');
        mainTitle.textContent = `Equivalente en ${primary.code}`;
        
        const mainValue = document.createElement('p');
        mainValue.textContent = formatters[primary.code].format(primary.value);
        
        mainResult.appendChild(mainTitle);
        mainResult.appendChild(mainValue);
        resultsContainer.appendChild(mainResult);
        
        // Crear contenedor de resultados secundarios
        const secondaryContainer = document.createElement('div');
        secondaryContainer.className = 'secondary-results';
        
        secondaries.forEach(result => {
            const resultDiv = document.createElement('div');
            resultDiv.className = 'secondary-result';
            resultDiv.setAttribute('data-value', result.value);
            resultDiv.setAttribute('data-code', result.code);
            
            const title = document.createElement('h2');
            title.textContent = result.code;
            
            const value = document.createElement('p');
            value.textContent = formatters[result.code].format(result.value);
            
            resultDiv.appendChild(title);
            resultDiv.appendChild(value);
            secondaryContainer.appendChild(resultDiv);
        });
        
        resultsContainer.appendChild(secondaryContainer);
        addCopyListeners();
    }

    // --- FUNCIÓN PARA COPIAR AL PORTAPAPELES (VERSIÓN CON FORMATO MEJORADO) ---
    function addCopyListeners() {
        document.querySelectorAll('[data-value]').forEach(element => {
            let timeoutId = null;
            element.addEventListener('click', () => {
                if (element.dataset.timeoutId) {
                    clearTimeout(parseInt(element.dataset.timeoutId));
                }

                const valueToCopy = parseFloat(element.getAttribute('data-value'));
                const code = element.getAttribute('data-code');
                let stringToCopy;

                // Formatear para copia usando los mismos formatos que la visualización
                if (code === 'UF') {
                    stringToCopy = new Intl.NumberFormat('es-CL', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 4 
                    }).format(valueToCopy);
                } else if (code === 'ARS' || code === 'COP' || code === 'CLP') {
                    // Monedas sin decimales
                    stringToCopy = new Intl.NumberFormat('es-CL', { 
                        maximumFractionDigits: 0 
                    }).format(valueToCopy);
                } else {
                    // USD y EUR con hasta 2 decimales
                    stringToCopy = new Intl.NumberFormat('es-CL', { 
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2 
                    }).format(valueToCopy);
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
        
        // Permitir números, puntos y comas
        let cleanValue = value.replace(/[^\d.,]/g, '');
        
        // Si hay una coma, separarla en parte entera y decimal
        let parts = cleanValue.split(',');
        let integerPart = parts[0].replace(/\./g, ''); // Quitar puntos de la parte entera
        let decimalPart = parts[1] || '';
        
        // Limitar decimales a 3 dígitos
        if (decimalPart.length > 3) {
            decimalPart = decimalPart.substring(0, 3);
        }
        
        // Limitar el valor máximo a 99 millones
        const maxValue = 99000000;
        const numericValue = parseInt(integerPart.replace(/\./g, '')) || 0;
        if (numericValue > maxValue) {
            integerPart = new Intl.NumberFormat('es-CL').format(maxValue);
        } else if (integerPart) {
            integerPart = new Intl.NumberFormat('es-CL').format(parseInt(integerPart.replace(/\./g, '')));
        }
        
        // Reconstruir el valor
        if (parts.length > 1 || value.includes(',')) {
            // Si hay coma o se escribió una coma
            e.target.value = integerPart + (parts.length > 1 ? ',' + decimalPart : ',');
        } else {
            e.target.value = integerPart;
        }
        
        renderAndCalculate();
    });

    // --- INICIALIZACIÓN ---
    document.querySelectorAll('.currency-pills .pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelector('.currency-pills .pill.active').classList.remove('active');
            pill.classList.add('active');
            renderAndCalculate();
        });
    });
    fetchAllRates();
});
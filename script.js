document.addEventListener('DOMContentLoaded', () => {
    const amountInput = document.getElementById('amount-input');
    const currencySelector = document.getElementById('currency-selector');
    const resultsContainer = document.getElementById('results-container');
    const ufRateDisplay = document.getElementById('uf-rate-display');

    let rates = { uf: 0, usd: 0, eur: 0, ars: 0, cop: 0 };

    async function fetchAllRates() {
        try {
            const [ufResponse, dolarResponse, euroResponse, arsResponse, copResponse] = await Promise.all([
                fetch('https://mindicador.cl/api/uf'),
                fetch('https://mindicador.cl/api/dolar'),
                fetch('https://mindicador.cl/api/euro'),
                fetch('https://api.bluelytics.com.ar/v2/latest'),
                fetch('https://www.datos.gov.co/resource/mcec-87by.json')
            ]);
            
            if (!ufResponse.ok || !dolarResponse.ok || !euroResponse.ok || !arsResponse.ok || !copResponse.ok) {
                throw new Error('Error en la respuesta de una o más APIs');
            }
            
            const ufData = await ufResponse.json();
            const dolarData = await dolarResponse.json();
            const euroData = await euroResponse.json();
            const arsData = await arsResponse.json();
            const copData = await copResponse.json();
            
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
            
            const today = new Date();
            const dateOptions = { day: 'numeric', month: 'long', year: 'numeric' };
            const formattedDate = today.toLocaleDateString('es-CL', dateOptions);
            const formattedUfValue = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(rates.uf);
            ufRateDisplay.innerHTML = `UF hoy: ${formattedUfValue}<br><span class="uf-date">${formattedDate}</span>`;

            renderAndCalculate();
        } catch (error) {
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

    function renderAndCalculate() {
        let rawValue = amountInput.value;
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

    function displayResults(primary, secondaries) {
        const formatters = {
            CLP: new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }),
            USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }),
            EUR: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }),
            ARS: new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }),
            COP: new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }),
            UF: new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 4 }),
        };
        
        resultsContainer.innerHTML = '';
        
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

    function addCopyListeners() {
        document.querySelectorAll('[data-value]').forEach(element => {
            let timeoutId = null;
            element.addEventListener('click', () => {
                if (element.dataset.timeoutId) {
                    clearTimeout(parseInt(element.dataset.timeoutId));
                }

                const valueToCopy = parseFloat(element.getAttribute('data-value'));
                const code = element.getAttribute('data-code');
                
                // No permitir copiar si el valor es 0 y hacer shake
                if (valueToCopy === 0) {
                    element.classList.add('shake');
                    setTimeout(() => element.classList.remove('shake'), 350);
                    return;
                }
                let stringToCopy;

                if (code === 'UF') {
                    stringToCopy = new Intl.NumberFormat('es-CL', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 4 
                    }).format(valueToCopy);
                } else if (code === 'ARS' || code === 'COP' || code === 'CLP') {
                    stringToCopy = new Intl.NumberFormat('es-CL', { 
                        maximumFractionDigits: 0 
                    }).format(valueToCopy);
                } else {
                    stringToCopy = new Intl.NumberFormat('es-CL', { 
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2 
                    }).format(valueToCopy);
                }
                
                navigator.clipboard.writeText(stringToCopy)
                    .then(() => {
                        const originalText = element.querySelector('p').innerText;
                        element.querySelector('p').innerText = 'Copiado!';
                        const newTimeoutId = setTimeout(() => {
                            element.querySelector('p').innerText = originalText;
                        }, 1200);
                        element.dataset.timeoutId = newTimeoutId;
                    })
                    .catch(err => console.error('Error al copiar:', err));
            });
        });
    }

    amountInput.addEventListener('input', (e) => {
        let value = e.target.value;
        let cleanValue = value.replace(/[^\d.,]/g, '');
        let parts = cleanValue.split(',');
        let integerPart = parts[0].replace(/\./g, '');
        let decimalPart = parts[1] || '';
        
        if (decimalPart.length > 3) {
            decimalPart = decimalPart.substring(0, 3);
        }
        
        // Límites máximos por moneda basados en transacciones inmobiliarias típicas
        const activeCurrency = document.querySelector('.currency-pills .pill.active').dataset.value;
        const maxLimits = {
            'clp': 2000000000,   // 2,000 millones CLP
            'usd': 5000000,      // 5 millones USD
            'uf': 99000,         // 99,000 UF
            'cop': 2500000000,   // 2,500 millones COP (aprox. 500k USD)
            'ars': 2000000000    // 2 mil millones ARS
        };
        
        const maxValue = maxLimits[activeCurrency] || 99000000;
        const numericValue = parseInt(integerPart.replace(/\./g, '')) || 0;
        if (numericValue > maxValue) {
            integerPart = new Intl.NumberFormat('es-CL').format(maxValue);
        } else if (integerPart) {
            integerPart = new Intl.NumberFormat('es-CL').format(parseInt(integerPart.replace(/\./g, '')));
        }
        
        if (parts.length > 1 || value.includes(',')) {
            e.target.value = integerPart + (parts.length > 1 ? ',' + decimalPart : ',');
        } else {
            e.target.value = integerPart;
        }
        
        // Shake si el usuario borra todo el input
        if (!e.target.value) {
            resultsContainer.classList.add('shake');
            setTimeout(() => resultsContainer.classList.remove('shake'), 350);
        }
        
        renderAndCalculate();
    });

    // Restaurar última moneda seleccionada
    const savedCurrency = localStorage.getItem('selectedCurrency');
    if (savedCurrency) {
        const currentActive = document.querySelector('.currency-pills .pill.active');
        const savedPill = document.querySelector(`.currency-pills .pill[data-value="${savedCurrency}"]`);
        if (savedPill && currentActive !== savedPill) {
            currentActive.classList.remove('active');
            savedPill.classList.add('active');
        }
    }
    
    function updatePlaceholder() {
        const activeCurrency = document.querySelector('.currency-pills .pill.active').dataset.value;
        const placeholders = {
            'uf': 'Ej: 100 UF',
            'clp': 'Ej: 1.000.000',
            'usd': 'Ej: 500',
            'cop': 'Ej: 1.400.000',
            'ars': 'Ej: 300.000'
        };
        amountInput.placeholder = placeholders[activeCurrency] || 'Ej: 1.000,50';
    }
    
    document.querySelectorAll('.currency-pills .pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelector('.currency-pills .pill.active').classList.remove('active');
            pill.classList.add('active');
            localStorage.setItem('selectedCurrency', pill.dataset.value);
            updatePlaceholder();
            renderAndCalculate();
        });
    });
    
    updatePlaceholder();
    fetchAllRates();
});
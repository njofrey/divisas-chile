export default async function handler(req, res) {
    try {
        const [ufRes, dolarRes, euroRes, arsRes, copRes] = await Promise.all([
            fetch('https://mindicador.cl/api/uf'),
            fetch('https://mindicador.cl/api/dolar'),
            fetch('https://mindicador.cl/api/euro'),
            fetch('https://api.bluelytics.com.ar/v2/latest'),
            fetch('https://www.datos.gov.co/resource/mcec-87by.json')
        ]);

        if (!ufRes.ok || !dolarRes.ok || !euroRes.ok || !arsRes.ok || !copRes.ok) {
            throw new Error('One or more APIs failed');
        }

        const [ufData, dolarData, euroData, arsData, copData] = await Promise.all([
            ufRes.json(), dolarRes.json(), euroRes.json(), arsRes.json(), copRes.json()
        ]);

        const rates = {
            uf: ufData.serie[0].valor,
            usd: dolarData.serie[0].valor,
            eur: euroData.serie[0].valor,
            ars: arsData.blue.value_sell,
            cop: parseFloat(copData[0].valor)
        };

        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
        res.status(200).json(rates);
    } catch (error) {
        res.status(500).json({ error: 'No se pudieron obtener las tasas de cambio' });
    }
}

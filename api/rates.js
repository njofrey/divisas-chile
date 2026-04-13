export default async function handler(req, res) {
    try {
        const results = await Promise.allSettled([
            fetch('https://mindicador.cl/api/uf', { signal: AbortSignal.timeout(9000) }),
            fetch('https://mindicador.cl/api/dolar', { signal: AbortSignal.timeout(9000) }),
            fetch('https://mindicador.cl/api/euro', { signal: AbortSignal.timeout(9000) }),
            fetch('https://api.bluelytics.com.ar/v2/latest', { signal: AbortSignal.timeout(9000) }),
            fetch('https://www.datos.gov.co/resource/mcec-87by.json', { signal: AbortSignal.timeout(9000) })
        ]);

        // Intenta parsear JSON solo si fulfilled y ok
        const parsed = await Promise.all(results.map(async (r) => {
            if (r.status === 'fulfilled' && r.value.ok) {
                try { return await r.value.json(); } catch { return null; }
            }
            return null;
        }));

        const [ufData, dolarData, euroData, arsData, copData] = parsed;

        const isValidNum = (v) => typeof v === 'number' && Number.isFinite(v);

        const ufValue = ufData?.serie?.[0]?.valor;
        const usdValue = dolarData?.serie?.[0]?.valor;
        const eurValue = euroData?.serie?.[0]?.valor;
        const arsValue = arsData?.blue?.value_sell;
        const copRaw = copData?.[0]?.valor;
        const copValue = copRaw !== undefined ? parseFloat(copRaw) : NaN;

        const rates = {
            uf: isValidNum(ufValue) ? ufValue : null,
            usd: isValidNum(usdValue) ? usdValue : null,
            eur: isValidNum(eurValue) ? eurValue : null,
            ars: isValidNum(arsValue) ? arsValue : null,
            cop: isValidNum(copValue) ? copValue : null
        };

        if (Object.values(rates).every(v => v === null)) {
            throw new Error('All upstream APIs failed');
        }

        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
        res.status(200).json(rates);
    } catch (error) {
        res.setHeader('Cache-Control', 'no-store');
        res.status(500).json({ error: 'No se pudieron obtener las tasas de cambio' });
    }
}

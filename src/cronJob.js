import cron from 'node-cron';
import { fetchDuolingoData } from './services/fetchData.js';
import { saveXPData } from './services/saveData.js';

cron.schedule('0 2 * * *', async () => {
    console.log('🕛 Fetching data form Duolingo...');

    try {
        const data = await fetchDuolingoData();
        if (!data || data.length === 0) {
            console.warn('⚠ No data fetched from Duolingo.');
            return;
        }

        await saveXPData(data);
        console.log('✅ Data successfully saved.');
    } catch (error) {
        console.error('❌ Error fetching or saving data:', error);
    }

});

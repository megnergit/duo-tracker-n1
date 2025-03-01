import { fetchDuolingoData } from './services/fetchData.js';
import { saveXPData } from './services/saveData.js';

async function main() {
    console.log('🚀 Fetching data and savig started');
    const usersData = await fetchDuolingoData();

    console.log("📌 Content of `usersData`: ", usersData);

    if (!usersData || usersData.length === 0) {
        console.error("❌ `usersData`is either empty or `undefined`.");
        return;
    }
    await saveXPData(usersData);
}

main();

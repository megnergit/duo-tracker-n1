import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const DUOLINGO_USERS = process.env.DUOLINGO_USERS.split(',') || [];

export async function fetchDuolingoData() {
    const results = [];
    for (const username of DUOLINGO_USERS) {

        try {
            const url = `https://www.duolingo.com/2017-06-30/users?username=${username.trim()}`;
            console.log(`🌍 Fetching: ${url}`);


            const res = await axios.get(url, {
                headers: {

                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
                    'Accept': 'application/json'
                }
            });

            if (res.data.users && res.data.users.length > 0) {
                const userData = res.data.users[0];
                results.push({
                    username: userData.username,
                    totalXp: userData.totalXp
                });
            } else {
                console.warn(`⚠️ Could not fetch Data for User ${username}`);
            }
        } catch (error) {
            console.error(`❌ Failed fetching data for ${username}`, error.response?.status, error.response?.statusText);
            console.log(`🌍 Requested URL: ${url} `);
        }
    }
    console.log("✅ fetchDuolingoData result: ", results);
    return results;
}



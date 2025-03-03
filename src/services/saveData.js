import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function saveXPData(usersData) {
    if (!usersData || usersData.length === 0) {
        console.error("❌ `usersData` is empty or `undefined`. Skip saving data.");
        return;
    }

    for (const userData of usersData) {
        //        if (!userData) continue;

        const { username, totalXp } = userData;
        console.log(`✅ Start saving data: user ${username}, XP ${totalXp}`);

        //        const today = new Date().toISOString().split('T')[0];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        console.log(today);
        //        debugger;
        console.log(typeof today);
        console.dir(today);


        // -------------
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        console.log(yesterday);
        //        debugger;
        console.log(typeof yesterday);
        console.dir(yesterday);

        // -------------
        const user = await prisma.user.upsert({
            where: { username },
            update: {},
            create: { username }
        });

        if (!user) {
            console.warn(`⚠️ No user ${username} found in the data base.`);
            continue;
        }

        const previousEntry = await prisma.xPEntry.findUnique({
            //            where: { userId_date: { userId: user.id, date: today } }
            where: {
                userId_date: { userId: user.id, date: yesterday },
            }
            //            orderBy: { createdAt: 'desc' }
        });

        console.log("Previous Entry:", previousEntry);

        const previousTotalXp = previousEntry ? previousEntry.totalXp : 0;
        console.log("Previous TotalXP", previousTotalXp);

        const dailyXp = totalXp - previousTotalXp;
        console.log("Current TotalXP", totalXp);
        console.log("Today's XP", dailyXp);

        await prisma.xPEntry.upsert({
            where: { userId_date: { userId: user.id, date: today } },
            update: { totalXp, dailyXp },
            create: {
                userId: user.id,
                date: today,
                totalXp,
                dailyXp
            },
        });
        console.log(`✅ Data saved: user ${username}, daily XP ${dailyXp}, total XP ${totalXp}`);
    }
}

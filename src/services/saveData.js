import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function saveXPData(usersData) {
    if (!usersData || usersData.length === 0) {
        console.error("❌ `usersData` is empty or `undefined`. Skip saving data.");
        return;
    }

    for (const userData of usersData) {
        if (!userData) continue;

        const { username, totalXp } = userData;
        console.log(`✅ Start saving data: user ${username}, XP ${totalXp}`);

        //        const today = new Date().toISOString().split('T')[0];
        const today = new Date().toISOString().split('T')[0];
        today.setHours(0, 0, 0, 0);

        const user = await prisma.user.upsert({
            where: { username },
            update: {},
            create: { username }
        });


        // await prisma.user.upsert({
        //     where: { username: username },
        //     update: {},
        //     create: { username }
        // });

        if (!user) {
            console.warn(`⚠️ No user ${username} found in the data base.`);
            continue;
        }

        const previousEntry = await prisma.xPEntry.findUnique({
            where: { userId_date: { userId: user.id, date: today } }
        });

        const previousTotalXp = previousEntry ? previousEntry.totalXp : 0;
        const dailyXp = totalXp - previousTotalXp;

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

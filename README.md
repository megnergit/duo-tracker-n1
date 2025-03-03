# Duolingo Daily Tracker!

## Motivation 

I have been engaged in Duolingo everyday to improve my German.
One can get overview of one week's progress, but not over longer spans. 
I would like to know the dependency of my progress on  weekdays etc. 
In order to do so, I have to record my acquired points daily.  
We will do that using Duolingo API (Duolingo does not publish official API, but 
there are lots of hints on the internet from Duolingo API enthusiasts), 
and automated it with the combination of Next.js, poastgreSQL, prisma and pm2. 

## Overview

1. Scout Duolingo API.

2. Set up a Next.js project.

3. Run postgreSQL in a Docker container.

4. Generate prisma.

5. Write following JavaScript codes. 
    + fetchData.js
    + saveData.js
    + app.js
    + cronJob.js

6. Test if I can fetch data from Duolingo and store it in postgreSQL.

7. Set up daily fetch with pm2. 

<!--- ---------------------------------------- --->

## 1. Scout Duolingo API

First we will see what is possible via Duolingo API. 

Duolingo does not publish details of its API, but some enthusiasts 
gave us a lots of hints. The following are the source of information. 

* [Duolingo API](https://forum.duome.eu/viewtopic.php?t=25167-duolingo-api)
* [duome.eu in general](https://duome.eu)
* [tshuy.com](https://tschuy.com/duolingo/api/data.html)

Major stuff learned. 

<!--- ---------------------------------------- --->

### 1. Just using 'username' (do not mix up with the name that shows up on the leaderboard. 
   In the case below, your username is 'moff_moff', not 'Mame'), one can extract 
   basic data of anyone. 

![Profile image](./images/profile-1.png)

```sh
$ curl -X GET "https://www.duolingo.com/2017-06-30/users?username=moff_moff"  | jq
{"users":[{"joinedClassroomIds":[],"streak":429
...
}%
```

To check the contents closely 
```sh
$ curl -X GET "https://www.duolingo.com/2017-06-30/users?username=moff_moff"  -o moff_moff-3.json
$ jq -C  . moff_moff-3.json  | less -R
...
      "id": XXXXXXXXXX,
...
```
Here is your user ID.

<!--- ---------------------------------------- --->

### 2. The avatar image is stored here. 
```sh
...
      "picture": "//simg-ssl.duolingo.com/ssr-avatars/XXXXXXXXXX/SSR-*********"
...
```
One can retrieve it, for instance
```
$ curl -X GET "//simg-ssl.duolingo.com/ssr-avatars/XXXXXXXXXX/SSR-*********/xlarge -o my_avatar.jpg"
```
On mac,

```
open -a preview my_avatar.jpg
```

![My Avatar](./images/my-avatar-1.jpg)

<!--- ---------------------------------------- --->

### 3. Get your API access token.

Open [Duolingo](https://www.duolingo.com).

Open developer console with `Cmd + Option + i`. 
Go to Network -> Fetch/XHR -> Header, and 
look for `Authorization`. The string is the token. 

![Where to look for token](./images/token-1.png)

Check if it is a token.
```sh
$ echo "your token" | cut -d "." -f2 | base64 -d
{"exp":XXXXXXXXXX,"iat":0,"sub":XXXXXXXXXX%}
```

<!--- ---------------------------------------- --->

### 4. Get more info with token. 

```sh
$ curl -X GET "https://www.duolingo.com/api/1/users/show?id=XXXXXXXXXX" \
     -H "Authorization: Bearer eyJ...vL7U" -o moff_moff-5.json
```
or

```sh
$ curl -X GET "https://www.duolingo.com/api/1/users/username=moff_moff" \
     -H "Authorization: Bearer eyJ...vL7U" -o moff_moff-6.json
```

```sh
$ jq -C . moff_moff-5.json | less -R
$ jq -C '.calendar.[].datetime' moff_moff-5.json  | head
1739607541000
1739607584000
1739607924000
1739607966000
1739608212000
1739608286000
1739608359000
1739608414000
1739608481000
1739608651000
...
```

To convert the datetime to human-readable form,

```sh
$ jq -C '.calendar[].datetime | tonumber / 1000 | strftime("%Y-%m-%d %H:%M:%S")' moff_moff-5.json 
"2025-02-15 08:19:01"
"2025-02-15 08:19:44"
...
"2025-03-01 10:15:56"
"2025-03-01 10:17:35"
```
We have about two weeks' of data, but not more. 

=> Okay, we will record daily XP ourselves and accumulate slowly. 

<!--- --------------------------------------------------------- --->

## 2. Set up a Next.js project.

```sh
 $ npx create-next-app@latest duo-tracker
```
This will create a new directory `duo-tracker`

![Create Next.js project](./images/create-project-1.png) 

```sh
$ cd duo-tracker
```

Directory structure looks like this.

```sh
$ tree -L 1
.
├── DUO_TRACKER
├── README.md
├── eslint.config.mjs
├── next-env.d.ts
├── next.config.ts
├── node_modules/
├── package-lock.json
├── package.json
├── postcss.config.mjs
├── public/
├── src/
└── tsconfig.json
```

We will change it slightly,
```sh
$ mkdir -p src/services
$ touch src/services/fetchData.js
$ touch src/services/saveData.js
$ touch src/app.js
```

```sh
$ tree ./src
./src
├── app
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── app.js
├── cronJob.js
└── services
    ├── fetchData.js
    └── saveData.js
```

Install packages. 

<!--- ---------------------------------------- --->

```sh
npm install @prisma/client axios dotenv pm2 
npm install -D prisma
```

<!--- ---------------------------------------- --->

**`@prisma/client`** is a JavaScript package that provides database client. 
This means that if you create a prisma client (like `PrismaClient`), 
you do not need to write SQL code yourself, when you would like 
to write to or read from a relational database. `prisma` is a prisma
CLI that we need development, like migration of the database. 

**`Axios`** is a JavaScript package that makes it easy to communicate 
with APIs. For instance, one can get data from `http://example.com:80`.

```js
import axios from 'axios'
...
const res = axios.get("http://example.com:80") 
...
```

**`dotenv`** is required to store environment variables in `.env` file
at the project root directory. 

**`pm2`** is to run a JavaScript application as a daemon. 'pm' stands 
for **Process manager**.


<!--- --------------------------------------------------------- --->

## 3. Run postgreSQL in a Docker container.

We will run postgreSQL in a container. 

Prepare `docker-compose.yaml` (This is not included in the repository).

```sh
$ cat docker-compose.yaml
version: "3.8"

services:
  posgres:
    image: postgres:15
    container_name: duolingo-db
    restart: always
    environment:
      POSTGRES_USER: ********
      POSTGRES_PASSWORD: ********
      POSTGRES_DB: duolingo
    ports:
      - "5432:5432"

    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:

```

This is create docker volume in the same time, however, when 
we use Docker Desktop on MacOSX, we do not see eth volume at 
`/var/lib/docker` on the host. This is because Docker Desktop 
runs a VM and serve whole docker environment inside that VM. 

To see the volume, we will use `nsenter` command provided 
by Justin Cormack. 

```
$ docker run --rm -it --privileged --pid=host justincormack/nsenter1

Unable to find image 'justincormack/nsenter1:latest' locally
latest: Pulling from justincormack/nsenter1
5bc638ae6f98: Pull complete
Digest: sha256:e876f694a4cb6ff9e6861197ea3680fe2e3c5ab773a1e37ca1f13171f7f5798e
Status: Downloaded newer image for justincormack/nsenter1:latest

~ # ls /var/lib
cni                 kubeadm             mount-docker-cache  wasm
containerd          kubelet-plugins     mutagen
desktop-containerd  lost+found          nfs
docker              machine-id          swap

~ # ls /var/lib/docker
buildkit    engine-id   network     plugins     stats       tmp         volumes
containers  image       overlay2    runtimes    swarm       trust

~ # ls /var/lib/docker/volumes
backingFsBlockDev          duo-tracker_postgres_data  metadata.db
```
Here it is (`duo-tracker_postgres_data`).

Then run docker compose.

```
$ docker compose up -d
```

Check it.

```
$ docker ps
CONTAINER ID   IMAGE         COMMAND                  CREATED        STATUS        PORTS                    NAMES
7c5cb917d292   postgres:15   "docker-entrypoint.s…
```

All right. 

<!--- --------------------------------------------------------- --->
## 4. Inialize prisma.


Initialize prisma.

```sh
$ npx prisma init

✔ Your Prisma schema was created at prisma/schema.prisma
  You can now open it in your favorite editor.

warn You already have a .gitignore file. Don't forget to add `.env` in it to not commit any private information.

Next steps:
1. Set the DATABASE_URL in the .env file to point to your existing database. If your database has no tables yet, read https://pris.ly/d/getting-started
2. Set the provider of the datasource block in schema.prisma to match your database: postgresql, mysql, sqlite, sqlserver, mongodb or cockroachdb.
3. Run npx prisma db pull to turn your database schema into a Prisma schema.
4. Run npx prisma generate to generate the Prisma Client. You can then start querying your database.
5. Tip: Explore how you can extend the ORM with scalable connection pooling, global caching, and real-time database events. Read: https://pris.ly/cli/beyond-orm

More information in our documentation:
https://pris.ly/d/getting-started

```


This will create a new directory `./prisma` and a file `schema.prisma` in it, 
and `.env` at the project root as well. 

```sh
$ tree . -L 1
.
├── DUO_TRACKER
├── README.md
├── docker-compose.yaml
├── eslint.config.mjs
├── images/
├── next-env.d.ts
├── next.config.ts
├── node_modules
├── package-lock.json
├── package.json
├── postcss.config.mjs
├── prisma/
├── public/
├── src/
└── tsconfig.json
```

```sh
$ cat .env
# Environment variables declared in this file are automatically made available to Prisma.
# See the documentation for more detail: https://pris.ly/d/prisma-schema#accessing-environment-variables-from-the-schema

# Prisma supports the native connection string format for PostgreSQL, MySQL, SQLite, SQL Server, MongoDB and CockroachDB.
# See the documentation for all the connection string options: https://pris.ly/d/connection-strings

DATABASE_URL="postgresql://johndoe:randompassword@localhost:5432/mydb?schema=public"
```

Set username and password that we set at `docker-compose.yaml`. 
Also, replace `/mydb?schema=public` with `POSTGRES_DB` in `docker-compose.yaml`
(you can just delete `?schema=public`). 


Edit `schema.prisma`. We only collect `dailyXp` and `totalXp` at the moment. 

```sh
$ cat ./prisma/schema.prisma
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

// Looking for ways to speed up your queries, or scale easily with your serverless or edge functions?
// Try Prisma Accelerate: https://pris.ly/cli/accelerate-init

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id       String @id @default(uuid())
  username String @unique
  logs     XPEntry[]
}

model XPEntry {
  id        String    @id @default(uuid())
  user      User      @relation(fields: [userId], references: [id])
  userId    String
  date      DateTime
  dailyXp   Int?
  totalXp   Int
  createdAt DateTime @default(now())

  @@unique([userId, date])
}
```

Then migrate prisma. Here "migrate" means to create a table with the scheme
shown above. It is called "migrate" although this is the first creation 
of the table, and nothing to migrate. 

```sh
npx prisma migrate dev --name init
```

Every time we change `schema.prisma` we will "migrate" prisma. 
`--name init` is the record, or label, of a specific migration (like message in git commit).

Generate prisma client 
```sh
npx prisma generate
```

Now we can use `PrismaClient` inside JavaScript code. 


<!--- --------------------------------------------------------- --->

## 5. Write following JavaScript codes. 

    + fetchData.js
    + saveData.js
    + app.js

**`fetchData.js`** is contact to Duolingo API and fetch XP data of given users.

**`saveData.js`** stores the data in postgresSQL using prisma client. 

**`app.js`** is used to run all the above. When the daemon process started, we 
do not use `app.js` any more. 

**`cronJob.js`** is to execute `fetchData.js` and `saveData.js` once a day.

Edit `.env` to add `DUOLINGO_USERS`. We will refer `DUOLINGO_USERS` in `fetschData.js`.

```sh
$ cat ./tmp/.env
# Environment variables declared in this file are automatically made available to Prisma.
# See the documentation for more detail: https://pris.ly/d/prisma-schema#accessing-environment-variables-from-the-schema

# Prisma supports the native connection string format for PostgreSQL, MySQL, SQLite, SQL Server, MongoDB and CockroachDB.
# See the documentation for all the connection string options: https://pris.ly/d/connection-strings

# DATABASE_URL="postgresql://johndoe:randompassword@localhost:5432/mydb?schema=public"
DATABASE_URL="postgresql://meg:meg@localhost:5432/duolingo?schema=public"
DUOLINGO_USERS=moff_moff,moff_moff-2,moff_moff-3,...
```

<!--- --------------------------------------------------------- --->
## 6. Test if I can fetch data from Duolingo and store it in postgreSQL.

```sh
$ node ./src/app.js

(node:41797) Warning: To load an ES module, set "type": "module" in the package.json or use the .mjs extension.
(Use `node --trace-warnings ...` to show where the warning was created)
/Users/meg/js/next/duo-tracker/src/app.js:1
import { fetchDuolingoData } from './services/fetchData.js';
^^^^^^
...
```

Node.js does not support `import` natively. 
Add "type": module in  `package.json`.

```sh
$ cat package.json
{
  "name": "duo-tracker",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "type": "module",                   # <====== HERE
  "dependencies": {
    "@prisma/client": "^6.4.1",
    "axios": "^1.8.1",
    .....
```

Test is once again...

```
$ node ./src/app.js
🚀 Fetching data and savig started
🌍 Fetching: https://www.duolingo.com/2017-06-30/users?username=moff_moff
...
✅ fetchDuolingoData result:  [
  { username: 'moff_moff', totalXp: 141014 },
...
]
📌 Content of `usersData`:  [
  { username: 'moff_moff', totalXp: 141014 },
... 
]
✅ Start saving data: user moff_moff, XP 141014
✅ Data saved: user moff_moff, daily XP 141014, total XP 141014
```

Wunderbar. 

Check if the data is properly stored in postgreSQL databasel. 

```sh
$ docker ps
CONTAINER ID   IMAGE         COMMAND                  CREATED        STATUS        PORTS                    NAMES
7c5cb917d292   postgres:15   "docker-entrypoint.s…"   29 hours ago   Up 28 hours   0.0.0.0:5432->5432/tcp   duolingo-db
```

The  container name is `duolingo-db` or `7c5`.

```
$ cat docker-compose.yaml
version: "3.8"
services:
...
      POSTGRES_DB: XXXXXX
...
```

The database name  is XXXXXX

```sh
$ docker exec -it duolingo-db psql -U XXXXXX -d XXXXXX
psql (15.12 (Debian 15.12-1.pgdg120+1))
Type "help" for help.

duolingo=# \dt
              List of relations
 Schema |        Name        | Type  | Owner
--------+--------------------+-------+-------
 public | User               | table | meg
 public | XPEntry            | table | meg
 public | _prisma_migrations | table | meg
(3 rows)

duolingo=# select * from "XPEntry";

                  id                  |                userId                |        date         |        createdAt        | dailyXp | totalXp
--------------------------------------+--------------------------------------+---------------------+-------------------------+---------+---------
 309e194b-5211-4c6e-a629-0478ddc4a588 | f280931f-b355-4172-91ef-016f79122010 | 2025-02-27 23:00:00 | 2025-02-28 18:07:13.473 |       0 |  140770
 ....
duolingo=# \q
```
or, 

```sh
psql -h localhost -p 5432 -U myuser -d mydatabase
```

To sort the database,
```
duolingo=# select * from "XPEntry" order by "createdAt" ASC;
```

All right.

### PostgreSQL Command Reference

#### 1. Basic Operations
| **Operation** | **Command** |
|--------------|------------|
| Connect to PostgreSQL in a Docker container | `docker exec -it <container_name> psql -U <user> -d <database>` |
| Exit PostgreSQL shell | `\q` |
| List all databases | `\l` or `\list` |
| Check current database | `SELECT current_database();` |
| Switch to another database | `\c <database_name>` |
| Create a new database | `CREATE DATABASE newdb;` |
| Delete a database | `DROP DATABASE newdb;` |

#### 2. Table Operations
| **Operation** | **Command** |
|--------------|------------|
| List all tables | `\dt` |
| Show table structure | `\d <table_name>` |
| Show all data in a table | `SELECT * FROM <table_name>;` |
| Create a new table | ```sql CREATE TABLE example (id SERIAL PRIMARY KEY, name TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW()); ``` |
| Delete a table | `DROP TABLE example;` |

#### 3. Data Manipulation
| **Operation** | **Command** |
|--------------|------------|
| Insert data | `INSERT INTO User (id, name, email) VALUES ('1234', 'Alice', 'alice@example.com');` |
| Update data | `UPDATE User SET name = 'Bob' WHERE id = '1234';` |
| Delete data | `DELETE FROM User WHERE id = '1234';` |
| Query with conditions | `SELECT * FROM User WHERE email LIKE '%example.com';` |
| Count rows | `SELECT COUNT(*) FROM User;` |

#### 4. User Management
| **Operation** | **Command** |
|--------------|------------|
| Show current user | `SELECT current_user;` |
| List all users | `\du` |
| Create a new user | `CREATE USER newuser WITH PASSWORD 'password';` |
| Grant privileges to a user | `GRANT ALL PRIVILEGES ON DATABASE mydatabase TO newuser;` |
| Delete a user | `DROP USER newuser;` |

#### 5. Indexing
| **Operation** | **Command** |
|--------------|------------|
| Create an index | `CREATE INDEX user_email_idx ON User(email);` |
| List all indexes | `\di` |
| Delete an index | `DROP INDEX user_email_idx;` |

#### 6. Backup & Restore
| **Operation** | **Command** |
|--------------|------------|
| Backup database | `pg_dump -U myuser -d mydatabase -F c -f backup.dump` |
| Restore database | `pg_restore -U myuser -d mydatabase -F c backup.dump` |

#### 7. Logs & Configuration
| **Operation** | **Command** |
|--------------|------------|
| Show PostgreSQL settings | `SHOW all;` |
| View Docker container logs | `docker logs <container_name>` |



<!--- --------------------------------------------------------- --->
## 7. Set up daily fetch with pm2. 

We will run `cronJob.js` as a daemon.

```js
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
```

### 📌 Cron Schedule Breakdown: `'0 2 * * *'`

| **Field**       | **Value** | **Meaning**             |
|----------------|----------|-------------------------|
| **Minute**     | `0`      | **Exactly at minute 0** |
| **Hour**       | `2`      | **At 2 AM (02:00)**     |
| **Day of Month** | `*`    | **Every day**           |
| **Month**      | `*`      | **Every month**         |
| **Day of Week** | `*`      | **Any day of the week** |


⏰ **This will execute the task every day at 2 AM (02:00).** 🚀


```sh
NODE_PATH=$(npm root) pm2 start ./src/cronJob.js --name duo-tracker 
```

Check if the environment variable is properly handed over.

For debugging, insert
```js
debugger;
```
at the point that you want the execution to halt,
and run the code with `--inspect`
```sh
node --inspect src/app.js
```
or
```sh
node --inspect-brk src/app.js
```



<!--
We will run `app.js` regularly instead. 
```sh
pm2 start src/app.js --name duo-tracker --cron "0 2 * * *"
```
-->

Check it

```sh
pm2 list
pm2 env 0
pm2 info 0
pm2 status
pm2 logs duo-tracker
```
`0` is an ID of the daemon.


![pm2 list](./images/pm2-list-1.png)

Register duo-tracker to the daemon list.

```sh
pm2 save
```

To stop and remove duo-tracker.
```sh
pm2 stop duo-tracker
pm2 delete duo-tracker
```

To stop and remove all daemons.
```sh
pm2 stop all
pm2 delete all
```

To flush log.
```sh
pm2 flush
rm -rf $HOME/.pm2/duo-tracker*.log
```


<!-- --------------------------------------- -->

In order to restart `pm2` itself every time my laptop is rebooted,

```sh
$ sudo env PATH=$PATH:/usr/local/Cellar/node@20/20.18.1/bin /usr/local/lib/node_modules/pm2/bin/pm2 startup launchd -u <username> --hp <home directory> 

```
like, 

```sh
$ sudo env PATH=$PATH:/usr/local/Cellar/node@20/20.18.1/bin /usr/local/lib/node_modules/pm2/bin/pm2 startup launchd -u meg --hp /Users/meg

Password:
[PM2] Init System found: launchd
Platform launchd
Template
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD
...
Target path
/Users/john/Library/LaunchAgents/pm2.john.plist
Command list
[
  'mkdir -p /Users/john/Library/LaunchAgents',
  'launchctl load -w /Users/john/Library/LaunchAgents/pm2.john.plist'
]
[PM2] Writing init configuration in /Users/john/Library/LaunchAgents/pm2.john.plist
[PM2] Making script booting at startup...
[PM2] [-] Executing: mkdir -p /Users/john/Library/LaunchAgents...
[PM2] [v] Command successfully executed.
[PM2] [-] Executing: launchctl load -w /Users/john/Library/LaunchAgents/pm2.john.plist...
Warning: Expecting a LaunchDaemons path since the command was ran as root. Got LaunchAgents instead.
`launchctl bootstrap` is a recommended alternative.
[PM2] [v] Command successfully executed.
+---------------------------------------+
[PM2] Freeze a process list on reboot via:
$ pm2 save

[PM2] Remove init script via:
$ pm2 unstartup launchd
```

Check if pm2 is in launchd,
```sh
ls ~/Library/LaunchAgents | grep pm2
```

<!--
launchctl list | grep pm2
-->
Remove from launchd list. 

```
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/pm2.meg.plistaun
```

In case, we have to manually load pm2 to launch list,
```sh
launchctl load ~/Library/LaunchAgents/pm2.meg.plist
```

<!--- --------------------------------------------------------- --->

<!---
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---------------------------------------- --->
---
# END
---
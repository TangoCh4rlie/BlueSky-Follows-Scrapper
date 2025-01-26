import { Follow, FollowsContainer } from "./models";
import { writeEdgesToCSV, writeNodesToCSV } from "./writer";

const queuedUsers: Set<string> = new Set<string>()
const treatedUsers: Set<string> = new Set<string>()
const followers: [string, string][] = []

let userLimit = -1
const MAX_CONCURRENT_REQUESTS = 100;

async function getAllFollowers(user: string): Promise<string[]> {
    let cursor: string | undefined = undefined;
    const follows: string[] = [];
    while (true) {
        const result = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.graph.getFollows?actor=${user}&limit=100&cursor=${cursor}`);
        const formatedResult: FollowsContainer = await result.json() as FollowsContainer;

        if (formatedResult.follows.length === 0) {
            break;
        }

        follows.push(...formatedResult.follows.map((follow: Follow) => follow.handle));
        cursor = formatedResult.cursor;
        
        if (cursor === undefined) {
            break;
        }
    }
    return follows;
}

function fillQueue(followers: string[]): void {
    followers.forEach(f => {
        if (!treatedUsers.has(f)) {
            queuedUsers.add(f)
        }   
    })
}

async function processUser(user: string): Promise<void> {
    if (user === "bsky.app") {
        console.log("Skipped user : ", user);
        return;
    }

    try {
        const followersResponse: string[] = await getAllFollowers(user);
        fillQueue(followersResponse);

        for (const follower of followersResponse) {
            followers.push([user, follower]);
        }

        console.info(`Treated user: ${user}`);
    } catch (e) {
        console.error(`Error processing user ${user}:`, e);
    } finally {
        treatedUsers.add(user);
        queuedUsers.delete(user);
    }
}

async function processFollows() {
    let nbUsers = 0;
    const activePromises: Set<Promise<void>> = new Set();

    while ((queuedUsers.size > 0 || activePromises.size > 0) && (userLimit === -1 || nbUsers < userLimit)) {
        while (activePromises.size < MAX_CONCURRENT_REQUESTS && queuedUsers.size > 0) {
            const user = queuedUsers.values().next().value;
            queuedUsers.delete(user);

            const promise = processUser(user).then(() => activePromises.delete(promise));
            activePromises.add(promise);

            nbUsers++;
        }

        await Promise.race(activePromises);
    }

    await Promise.all(activePromises);
    console.info(`${nbUsers} users processed in total.`);
}

async function main() {
    const user = process.argv[2];
    const usersLimitParam = parseInt(process.argv[3]);

    if (!user) {
        console.error("Please specify a user as entry like elouanreymond.com");
        process.exit(1);
    }

    if (usersLimitParam > 0) {
        console.log(`User limit : ${usersLimitParam}`);
        userLimit = usersLimitParam;
    } else {
        console.warn("User limit not specified");
    }

    queuedUsers.add(user)

    await processFollows()
    writeEdgesToCSV(followers, 'edges.csv')
}

main()
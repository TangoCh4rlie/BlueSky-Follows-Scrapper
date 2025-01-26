import { Follow, FollowsContainer } from "./models";
import { writeEdgesToCSV, writeNodesToCSV } from "./writer";

const queuedUsers: Set<string> = new Set<string>()
const treatedUsers: Set<string> = new Set<string>()
const followers: [string, string][] = []

let userLimit = -1

async function getAllFollowers(user: string): Promise<string[]> {
    let cursor: string | undefined = undefined;
    const follows: string[] = [];
    while (true) {
        const result = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.graph.getFollows?actor=${user}&limit=100&cursor=${cursor}`);
        const formatedResult: FollowsContainer = await result.json() as FollowsContainer;

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

async function processFollows() {
    let nbUsers = 0
    while (queuedUsers.size > 0 && (userLimit == -1 || nbUsers < userLimit)) {
        const user: string = queuedUsers.values().next().value
        if (user == "bsky.app") {
            console.log("Skipped user : ", user);
            queuedUsers.delete(user)
            continue
        }
        if (user in treatedUsers) {
            console.log("User already treated : ", user);
            queuedUsers.delete(user)
            continue
        }
        try {
            const followersResponse: string[] = await getAllFollowers(user)
            treatedUsers.add(user)
            queuedUsers.delete(user)
            fillQueue(followersResponse)
            
            for (const follower of followersResponse) {
                followers.push([user, follower])
            }

            console.info(`Treated user n°${++nbUsers} : ${user}`);
        } catch (e) {
            console.log(e)
            return
        }
    }
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

    const queuedUsersList = Array.from(queuedUsers);
    const treatedUsersList = Array.from(treatedUsers);
    queuedUsersList.push(...treatedUsersList)

    writeNodesToCSV(queuedUsersList, 'nodes.csv')
    writeEdgesToCSV(followers, 'edges.csv')
}

main()
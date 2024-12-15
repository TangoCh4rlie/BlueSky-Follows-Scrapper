import { AtpAgent } from '@atproto/api'
import * as fs from 'fs';
import * as path from 'path';

const agent = new AtpAgent({ service: 'https://public.api.bsky.app' })

const queuedUsers: Set<string> = new Set<string>()
const treatedUsers: Set<string> = new Set<string>()
const followers: [string, string][] = []
let nbAppels = 0
let apiLimit = -1
let userLimit = -1

function writeNodesToCSV(array: string[], filename: string) {
    const content = ['Id', ...array.map((item) => `${item}`)].join('\n');

    writer(filename, content);
}

function writeEdgesToCSV(array: [string, string][], filename: string) {
    const content = ['Source,Target', ...array.map(row => row.join(','))].join('\n'); 

    writer(filename, content);
}

function writer(filename: string, content: string) {
    const dirPath = path.join("./data");
    const filePath = path.join(dirPath, filename);

    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`${filename} écrit avec succès.`);
}


async function queryFollows(actor: string): Promise<string[]> {
    const response: string[] = []
    let cursor: string | undefined

    do {
        const res = await agent.getFollows({
            actor,
            limit: 100,
            cursor
        })
        nbAppels++
        cursor = res.data.cursor
        response.push(...res.data.follows.map(f => f.handle))
    } while (cursor && (apiLimit == -1 || nbAppels < apiLimit))

    return response
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
        const user = queuedUsers.values().next().value
        console.log(user);

        treatedUsers.add(user)
        
        queuedUsers.delete(user)
        if (user == "bsky.app") {
            console.log("Utilisateur ignoré : ", user);
            continue
        }
        if (user in treatedUsers) {
            console.log("Utilisateur déjà traité : ", user);
            continue
        }
        try {
            const followersResponse: string[] = await queryFollows(user)
            fillQueue(followersResponse)
            for (const follower of followersResponse) {
                followers.push([user, follower])
            }

            console.log(++nbUsers);
        } catch (e) {
            console.log(e)
            return
        }
    }
}

async function main() {
    const user = process.argv[2];
    const usersLimitParam = parseInt(process.argv[3]);
    const apiLimitParam = parseInt(process.argv[4]);

    if (!user) {
        console.log("Veuillez spécifier un utilisateur en argument.");
        process.exit(1);
    }

    if (usersLimitParam > 0) {
        console.log(`Limite d'utilisateurs : ${usersLimitParam}`);
        userLimit = usersLimitParam;
    } else {
        console.log("Limite d'utilisateurs non spécifiée.");
    }

    if (apiLimitParam > 0) {
        console.log(`Limite d'appels API : ${apiLimitParam}`);
        apiLimit = apiLimitParam;
    } else {
        console.log("Limite d'appels API non spécifiée.");
    }

    queuedUsers.add(user)

    await processFollows()

    console.log("---------------------------------------");
    console.log(`Nombre total d'appels API : ${nbAppels}`);

    const queuedUsersList = Array.from(queuedUsers);
    const treatedUsersList = Array.from(treatedUsers);
    queuedUsersList.push(...treatedUsersList)

    writeNodesToCSV(queuedUsersList, 'nodes.csv')
    writeEdgesToCSV(followers, 'edges.csv')
}

main()




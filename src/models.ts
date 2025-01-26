export interface Follow {
    did: string
    handle: string
    displayName: string
}

export interface FollowsContainer {
    follows: Follow[]
    subject: Follow
    cursor: string
}
    
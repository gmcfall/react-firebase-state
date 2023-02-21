import { FirebaseApp } from "firebase/app";
import { Unsubscribe } from "firebase/auth";
import produce from "immer";
import { Lease } from "./Lease";
import { setEntity } from "./setEntity";
import { EntityCache, EntityClientOptions, LeaseOptions } from "./types";

export function createEntityClient(
    firebaseApp: FirebaseApp,
    cache: EntityCache,
    setCache: React.Dispatch<React.SetStateAction<EntityCache>>,
    options?: EntityClientOptions
) {
    return new EntityClient(
        firebaseApp,
        cache,
        setCache,
        new Map<string, Lease>(),
        new Set<Lease>(),
        new Map<string, Set<Lease>>(),
        options
    )
}

export function updateEntityClient(client: EntityClient, cache: EntityCache) {
    return (cache === client.cache) ? client : new EntityClient(
        client.firebaseApp,
        cache,
        client.setCache,
        client.leases,
        client.abandonedLeases,
        client.leaseeLeases,
        client.options
    )
}

export class EntityClient {

    /** The FirebaseApp that will be used to fetch documents */
    readonly firebaseApp: FirebaseApp;

    /** The function used to set a new revision of the cache */
    readonly setCache: React.Dispatch<React.SetStateAction<EntityCache>>;
    
    /** The current state of the cache */
    readonly cache: EntityCache;

    /** A Map where the key is the hash of an EntityKey and the value is the Lease for the entity */
    readonly leases: Map<string, Lease>;

    /** 
     * A Map where the key is the hash of an EntityKey and the value is a Lease that has been abandonded,
     * i.e. the Lease has leasees. This map allows for quick garbage collection.
     */
    readonly abandonedLeases: Set<Lease>;

    /**
     * A Map where the key is the name for a leasee, and the value is the set of
     * Leases owned by the leasee.
     */
    readonly leaseeLeases: Map<string, Set<Lease>>;

    /** Options for managing expiry of entities in the cache */
    options: EntityClientOptions;

    constructor(
        firebaseApp: FirebaseApp,
        cache: EntityCache,
        setCache: React.Dispatch<React.SetStateAction<EntityCache>>,
        leases: Map<string, Lease>,
        abandonedLeases: Set<Lease>,
        leaseeLeases: Map<string, Set<Lease>>,
        options?: EntityClientOptions
    ) {
        this.firebaseApp = firebaseApp;
        this.cache = cache;
        this.setCache = setCache;
        this.leases = leases;
        this.abandonedLeases = abandonedLeases;
        this.leaseeLeases = leaseeLeases;
        this.options = options || {cacheTime: 300000};
        
        const self = this;

        setInterval(() => {
            const now = Date.now();
            const cacheTime = self.options.cacheTime;

            let mutated = false;
            const nextCache = produce(this.cache, draftCache => {
                self.abandonedLeases.forEach((lease) => {
                    if (lease.leasees.size===0 && (now > expiryTime(lease, cacheTime))) {
                        mutated = true;
                        removeEntity(this, lease.key, draftCache);
                    }
                })
            })
            if (mutated) {
                this.setCache(nextCache);
            }

        }, self.options.cacheTime)
    }

    /**
     * Remove a given leasee from all leases that it currently claims.
     * @param leasee The name of the leasee
     */
    disownAllLeases(leasee: string) {
        const set = this.leaseeLeases.get(leasee);
        if (set) {
            set.forEach(lease => {
                removeLeaseeFromLease(this, lease, leasee);
            })
            this.leaseeLeases.delete(leasee);
        }
    }
}

export function removeLeaseeFromLease(client: EntityClient, lease: Lease, leasee: string) {
    lease.removeLeasee(leasee);
    if (
        (lease.leasees.size===0) &&
        !client.abandonedLeases.has(lease)
    ) {
        client.abandonedLeases.add(lease);
    }
}


/**
 * Add a given entity to the cache on behalf of a given leasee.
 * @param key The hash of the EntityKey
 * @param entity The entity to be added
 * @param leasee The name of the leasee adding the entity
 * @param cache The cache proxy to which the entity will be added
 */
export function createLeasedEntity(
    client: EntityClient, 
    unsubscribe: Unsubscribe | undefined,
    key: string,
    leasee: string, 
    options?: LeaseOptions
) {
    setEntity(client, key, undefined);
    let lease = client.leases.get(key);
    if (!lease) {
        lease = new Lease(key, unsubscribe);
        client.leases.set(key, lease);
    }
    claimLease(client, key, leasee, options);
}



/**
 * Remove an entity from a given cache.
 * @param key The hash of the key under which the entity is stored in the cache
 * @param cache The cache containing the entity
 */
export function removeEntity(client: EntityClient, key: string, cache: EntityCache) {
    const entity = cache[key];
    const lease = client.leases.get(key);
    if (entity) {
        const unsubscribe = lease?.unsubscribe;
        if (unsubscribe) {
            unsubscribe();
        }
        delete cache[key];
    }
    if (lease) {
        lease.leasees.forEach(leasee => {
            const set = client.leaseeLeases.get(leasee);
            if (set) {
                set.delete(lease);
            }
        })
        client.abandonedLeases.delete(lease);
    }
    client.leases.delete(key);
}


export function claimLease(client: EntityClient, entityKey: string, leasee: string, options?: LeaseOptions) {

    let lease = client.leases.get(entityKey);
    if (!lease) {
        lease = new Lease(entityKey);
        client.leases.set(entityKey, lease);
    }
    if (!lease.leasees.has(leasee)) {
        if (client.abandonedLeases.has(lease)) {
            client.abandonedLeases.delete(lease);
        }
        lease.addLeasee(leasee);
        let set = client.leaseeLeases.get(leasee);
        if (!set) {
            set = new Set<Lease>();
            client.leaseeLeases.set(leasee, set);
        }
        if (!set.has(lease)) {
            set.add(lease);
        }
    }
    if (lease.options !== options) {
        if (options) {
            lease.options = options;
        } else if (lease.options) {
            delete lease.options;
        }
    }
}

function expiryTime(lease: Lease, cacheTime: number) {
    const options = lease.options;
    const abandonTime = lease.abandonTime;
    const extraTime = options?.cacheTime || cacheTime;
    return abandonTime + extraTime;
}
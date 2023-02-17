import { LeaseOptions, Unsubscribe } from "./types";

/**
 * A Lease for some entity held in the EntityCache.
 * 
 * Each Lease maintains a list of leasees, i.e. individual parts of the app which 
 * require access to the entity to fulfill their functions. Most leasees are React components 
 * that require the entity for rendering. In general, though a leasee may be any part of the 
 * app whether logical or physical. 
 * 
 * When the number of leasees drops to zero, we say that the lease as been "abandoned" 
 * and the associated entity becomes eligible for garbage collection.  The time to live 
 * after being abandoned is governed by the `cacheTime` option. The EntityClient contains 
 * a default `cacheTime` value, but each Lease may override the default with its own value.
 */
export class Lease {

    /** The hash of the EntityKey under which the entity is stored in the cache */
    readonly key: string;

    /** 
     * The set of names for individuals (typically components) that hold
     * a lease for a given entity.
     */
    readonly leasees: Set<string> = new Set<string>();

    readonly unsubscribe?: Unsubscribe;

    /**
     * The time when the number of leasees dropped to zero.
     * 
     * The entity is eligible for garbage collection after 
     * `abandonTime + cacheTime`, where `cacheTime` is defined by
     * the EntityClient options.
     */
    abandonTime: number = 0;

    options?: LeaseOptions;

    constructor(key: string, unsubscribe?: Unsubscribe) {
        this.key = key;
        this.unsubscribe = unsubscribe;
    }

    addLeasee(leasee: string) {
        this.leasees.add(leasee);
    }

    removeLeasee(leasee: string) {
        this.leasees.delete(leasee);
        if (this.leasees.size === 0) {
            this.abandonTime = Date.now();
        }
    }
}
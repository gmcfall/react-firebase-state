import { EntityApi } from "./EntityApi";

/**
 * Release all claims held by a given component.
 * 
 * This function is rarely used. Most components will utilize
 * the [useReleaseAllClaims](./useReleaseAllClaims.html) hook instead.
 * 
 * `releaseAllClaims` provides the same functionality as the hook, but 
 * it is designed for use within `useEffect` and event handlers.
 * 
 * @param api An EntityApi instance
 * @param leasee The name of the component that holds the claims
 */
export function releaseAllClaims(api: EntityApi, leasee: string) {
    api.getClient().disownAllLeases(leasee);
}
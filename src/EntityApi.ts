import { FirebaseApp } from "firebase/app";
import {EntityClient} from "./EntityClient";

/**
 * An interface that enables all the capabilities of the `react-firestore-state`
 * library.
 * 
 * The EntityApi provides:
 * - The FirebaseApp instance used by the React application.
 * - A local cache that stores both server-side and client-side data elements. 
 *   We call these data elements *entities*.
 * - A collection of [leases](../classes/Lease.html) which dictate when entities 
 *   are eligible for eviction from the cache. 
 * 
 * Most capabilities of the `react-firestore-state` library are exposed through 
 * hooks and functions that leverage an EntityApi instance to do their work.
 * 
 * #### Hooks
 * The EntityApi supports the following hooks:
 * - [useAuthListener](../functions/useAuthListener)
 * - [useAuthUser](../functions/useAuthUser)
 * - [useDocListener](../functions/useDocListener)
 * - [useData](../functions/useData)
 * - [useEntity](../functions/useEntity)
 * - [useEntityApi](../functions/useEntityApi)
 * - [useReleaseAllClaims](../functions/useReleaseAllClaims)
 * 
 * ### Functions
 * The following fuctions take an `EntitityApi` instance as the
 * first argument.
 * - [watchEntity](../functions/watchEntity.html)
 * - [setLeasedEntity](../functions/setLeasedEntity.html)
 * - [getAuthUser](../functions/getAuthUser.html)
 * - [setAuthUser](../functions/setAuthUser.html)
 * - [getEntity](../functions/getEntity.html)
 * - [setEntity](../functions/setEntity.html)
 * - [releaseClaim](../functions/releaseClaim.html)
 * 
 * These functions also accept the local cache as the first argument so they
 * can be used inside the {@link EntityApi.mutate} method, as discussed below.
 * 
 * #### Getting an EntityApi instance
 * 
 * Components invoke the [useEntityApi](../functions/useEntityApi) hook to
 * get an `EntityApi` instance.
 * 
 * #### Using the Cache
 * 
 * There is one, application-wide cache that stores server-side and client-side 
 * entities.  Functions that modify the cache (such as [setAuthUser](../functions/setAuthUser.html),
 * [setEntity](../functions/setEntity.html) and
 * [setLeasedEntity](../functions/setLeasedEntity.html)) do not update 
 * the cache immediately. Instead, they submit requests to modify the cache.
 * Those requests are queued and applied before the next render cycle.
 * 
 * This policy of queuing change requests can lead to some surprising behavior.
 * Consider the following snippet:
 * ```javascript
 *  setEntity(entityApi, "favoriteFruit", {type: "banana", color: "yellow"});
 *  const [, fruit] = getEntity<Fruit>(entityApi, "favoriteFruit");
 * ```
 * The value of the `fruit` variable returned by `getEntity` is NOT the banana object
 * passed to `setEntity`. Instead, it is whatever value was in the cache 
 * at the beginning of the most recent render cycle.
 * 
 * If you need an up-to-date view of the data including pending changes to the cache,
 * consider using the {@link EntityApi.mutate} method as illustrated by the following 
 * snippet:
 * ```typescript
 *  entityApi.mutate(
 *      (cache: object) => {
 *          setEntity(cache, "favoriteFruit", {type: "banana", color: "yellow"});
 *          const [, fruit] = getEntity(cache, "favoriteFruit");
 *      }
 *  )
 * ```
 * In this case, the value of the `fruit` variable WILL be the banana object
 * passed to the `setEntity` function. The `mutate` function exposes a working 
 * draft of the cache that includes all changes made since the last render cycle.  
 * When you modify the cache inside the `mutate` function those changes are applied 
 * to the draft.
 * 
 * The working draft is set as the new cache state at the beginning of the next render 
 * cycle so that it is available to components.
 */
export interface EntityApi {

    /**
     * The FirebaseApp currently used by the application
     */
    readonly firebaseApp: FirebaseApp;

    /**
     * A method for making changes to values in the local cache.
     * 
     * This method takes a mutator function as its sole argument. The mutator function
     * is passed a working draft of the cache cast to type `T`.
     * 
     * #### Usage
     * Suppose your React application uses client-side state matching the following interface.
     * ```typescript
     *  interface SampleApp {
     *      greeting: string;
     *      farewell: string;
     *  }
     * ```
     * 
     * You can use the `mutate` method to make changes to the client-side state
     * like this:
     * ```typescript
     *  api.mutate(
     *      (app: SampleApp) => {
     *          app.greeting = "Bonjour!";
     *          app.farewell = "Au revoir!";
     *      }
     *  )
     * ```
     * In this example, the `app` parameter of the mutator function is declared to be of
     * type `SampleApp`.  When the mutator function executes, it receives the local cache
     * as the value of the `app` parameter but that parameter value is cast to the `SampleApp` 
     * type so that you can manipulate client-side state in a type-safe way.  Because the 
     * `app` parameter is just an alias for the cache, you can also access server-side entities 
     * from within the `mutate` function.
     * 
     * For example, suppose you have a "preferences" Firestore collection that stores 
     * user preferences, including a language code for the user's preferred language. Then you 
     * could use the mutate function like this:
     * ```typescript
     *  api.mutate(
     *      (app: SampleApp) => {
     *         const cache = app as Cache;
     *         const [, user] = getAuthUser(cache);
     *         const [, preferences] = getEntity<UserPreferences>(
     *             cache, ["preferences", user?.uid]
     *         );
     *         if (preferences) {
     *             switch (preferences.langCode) {
     *                 case: "en":
     *                     app.greeting = "Hello!";
     *                     app.farewell = "Goodbye!";
     *                     break;
     * 
     *                 case: "fr":
     *                     app.greeting = "Bonjour!";
     *                     app.farewell = "Au revoir!";
     *                     break;
     *             }
     *         }
     *     }
     *  )
     * ```
     * @param mutator
     * @typeParam T The type to which the cache will be cast for use within the mutator.
     *      This template parameter does not need to be specified explicitly; the Typescript
     *      compiler will infer the type from the signature of the `mutator` function.
     */
    mutate<T>(mutator: (cache: T) => void): void;

    /**
     * Get the currently active EntityClient.
     * 
     * This method should be used only internally by the `react-firebase-state`
     * library. Applications should never call this function.
     */
    getClient() : EntityClient;
}
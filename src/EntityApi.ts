import { FirebaseApp } from "firebase/app";
import {EntityClient} from "./EntityClient";

/**
 * An interface that enables all the capabilities of the `react-firestore-state`
 * library.
 * 
 * The EntityApi provides:
 * - The FirebaseApp instance used by your React application.
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
 * Some of these functions also accept the local cache as the first argument so they
 * can be used inside the {@link EntityApi.mutate} method.
 * 
 * #### Getting an EntityApi instance
 * 
 * Components invoke the [useEntityApi](../functions/useEntityApi) hook to
 * get an `EntityApi` instance.
 * 
 * 
 * #### Entity Keys
 * There is one, application-wide cache that stores server-side and client-side 
 * entities.
 * 
 * The keys for client-side entities in the cache are strings. As a best practice, you 
 * should use keys that obey the grammar for Javascript 
 * [identifiers](https://developer.mozilla.org/en-US/docs/Glossary/Identifier) so that
 * your application can get client-side entities easily via the 
 * [useData](../functions/useData.html) hook and modify them via the {@link mutate} method.
 * 
 * The key for a Firestore document entity in the cache is an array of strings that defines 
 * the path to that document.  
 * 
 * For example, suppose your application has `UserPreference` documents in a Firestore 
 * collection named "preferences". The key for a `UserPreferences` entity in the 
 * cache would be an array of the form:
 * ```javascript
 *  ["preferences", userUid]
 * ```
 * where `userUid` is the document id, which in this case happens to be a user's `uid` value.
 * 
 * #### Using the Cache
 * 

 * 
 * Functions that modify the cache (such as [setAuthUser](../functions/setAuthUser.html),
 * [setEntity](../functions/setEntity.html) and
 * [setLeasedEntity](../functions/setLeasedEntity.html)) do not update 
 * the cache immediately. Instead, they submit requests to modify the cache.
 * Those requests are queued and applied before the next render cycle.
 * 
 * This policy of queuing change requests can lead to some surprising behavior.
 * Consider the following snippet:
 * ```javascript
 *  setEntity(entityApi, ["preferences", userUid], {langCode: "fr"});
 *  const [preferences, preferencesError, preferencesStatus] = 
 *      getEntity<UserPreferences>(entityApi, ["preferences", userUid]);
 * ```
 * This snippet sets the value of a `UserPreferences` entity and then immediately
 * gets that entity.
 * 
 * The value of the `preferences` variable returned by `getEntity` is NOT the value
 * passed to `setEntity`. Instead, it is whatever value was in the cache 
 * at the beginning of the most recent render cycle.
 * 
 * If you need an up-to-date view of the data including pending changes to the cache,
 * consider using the {@link EntityApi.mutate} method as illustrated by the following 
 * snippet:
 * ```typescript
 *  entityApi.mutate(
 *      (cache: object) => {
 *          setEntity(entityApi, ["preferences", userUid], {langCode: "fr"});
 *          const [preferences, preferencesError, preferencesStatus] =
 *              getEntity<UserPreferences>(entityApi, ["preferences", userUid]);
 *      }
 *  )
 * ```
 * In this case, the value of the `preferences` variable WILL be the object
 * passed to the `setEntity` function. The `mutate` function exposes a working 
 * draft of the cache that includes all changes made since the last render cycle.  
 * When you modify the cache inside the `mutate` function those changes are applied 
 * to the draft.
 * 
 * The working draft is set as the new cache state at the beginning of the next render 
 * cycle.
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
     *         const [user] = getAuthUser(cache);
     *         const [preferences] = getEntity<UserPreferences>(
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
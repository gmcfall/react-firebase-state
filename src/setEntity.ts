import produce from "immer";
import { toHashValue } from "./util";
import { EntityApi } from "./EntityApi";
import { Cache, EntityKey } from "./types";
import { CURRENT_USER } from "./common";

/**
 * Put a value into the local cache.
 * 
 * This function is rarely needed because entities are put into the cache automatically
 * by `useDocListener` as soon as they are received from Firestore.
 * 
 * You might consider using `setEntity` if you are concerned about latency after
 * creating or updating a Firestore document.  Typically, you would persist your data
 * to Firestore and let a document listener put that data into the cache asynchronously.
 * 
 * However, if latency is a problem and you need to make the data available to your application
 * immediately, you can use `setEntity` as shown in the following example.
 * 
 * #### Example 1
 * ```typescript
 *  const api = useEntityApi();
 * 
 *  function handleClick() {
 *      const auth = getAuth(api.firebaseApp);
 *      const user = auth.currentUser;
 *      if (user) {
 *          const data = createUpdatedPreferences();
 *          const db = getFirestore(api.firebaseApp);
 *          const docRef = doc(db, "preferences", user.uid);
 *          setDoc(docRef, data);
 *          setEntity(api, ["preferences", user.uid], data);
 *      }
 *  }
 * ```
 * This example updates user preferences. It assumes:
 * - There is a Firestore collection named "preferences".
 * - Some other component started a document listener by invoking the `useDocListener` hook.
 * 
 * `handleClick` is an event handler that fires when a button is clicked.  It creates
 * an updated user preferences object and calls `setDoc` to save the preferences to Firestore.
 * Then it calls `setEntity` to make the data available immediately to the application.
 * 
 * #### Example 2
 * 
 * If you need to mutate client-side state and you want to set server-side data immediately, 
 * you can call  `setEntity` from within {@link EntityApi.mutate | EntityApi.mutate} 
 * as shown in this example.
 * 
 * ```typescript
 *  entityApi.mutate(
 *      (app: ClientSideStateType) => {
 * 
 *          // ... Make client-side state changes here ...
 * 
 *          setEntity(app as Cache, ["preferences", userUid], preferencesData);
 *      }
 *  )
 * ```
 * 
 * @param entityProvider An EntityApi instance or the cache
 * @param key The key under which the value is stored in the cache
 * @param value The value to be added to the cache
 * 
 * @throws Error if the key is an EntityKey containing an undefined value.
 */
export function setEntity(
    entityProvider: EntityApi | Cache,
    key: string | EntityKey,
    value: unknown
) {
 
    const hashValue = toHashValue(key);
    if (!hashValue) {
        throw new Error("Invalid key");
    }

    if ("getClient" in entityProvider) {
        const api = entityProvider as EntityApi;
        const client = api.getClient();
        
        client.setCache(
            oldCache => {
                const nextCache = produce(oldCache, draftCache => {
                    draftCache[hashValue] = value;
                })
    
                return nextCache;
            }
        )
    } else {
        const cache = entityProvider as any;
        cache[hashValue] = value;
    }
}
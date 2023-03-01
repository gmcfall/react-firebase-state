

import { FirebaseApp } from 'firebase/app';
import React, { useState } from 'react';
import { createEntityClient, EntityClient, updateEntityClient } from '../../EntityClient';
import { Cache, EntityApiOptions } from '../../types';


export const FirebaseContext = React.createContext<EntityClient | null>(null);


/**
 * The props to be passed to the {@link FirebaseProvider}
 */
export interface FirebaseProviderProps {
    /** The FirebaseApp used by the React application */
    firebaseApp: FirebaseApp;

    /** The child components nested with the {@link FirebaseProvider} */
    children?: React.ReactNode;

    /** 
     * The initial client-side state. If not defined, an empty object is used 
     * by default.
     */
    initialState?: object;

    /**
     * Contains default settings used when creating new [Leases](../classes/Lease.html)
     */
    options?: EntityApiOptions;
}

/**
 * A React component that exposes the `react-firebase-state` api to components
 * nested within it.
 * 
 * Internally, it uses a [React Context](https://reactjs.org/docs/context.html)
 * with an {@link EntityClient} as its value.
 * 
 * Child components do not access the context or client directly. 
 * Instead they use hooks, functions and events supported by the `EntityApi`.
 * See the [EntityApi](../interfaces/EntityApi.html) documentation for details.
 * 
 * Your React application should include only one `FirebaseProvider` component
 * which wraps all the other components that use the `EntityApi`.
 * 
 * ### Usage
 * 
 * ```typescript 
 * // You must initialize the FirebaseApp instance that your application uses
 * // and pass it to the <FirebaseProvider> component.
 * //
 * // It is not necessary to implement a function called "initializeFirebaseApp".  
 * // You could initialize Firebase in a module and simply export `firebaseApp` 
 * // as a constant. How you perform the initialization is up to you.
 * 
 * const firebaseApp = initializeFirebaseApp();
 * 
 * // By default, the FirebaseProvider uses an empty object as the initial
 * // state for client-side entities.  You may optionally define your own initial
 * // state populated with default entities.
 * //
 * // It is not necessary to implement a function called "createInitialState".
 * // How you create the initial state object is up to you.
 * 
 * const initialState = createInitialState();
 * 
 * // The `abandonTime` parameter specifies the number of milliseconds that a leased
 * // entity can linger in the cache after it has been abandonded. The default
 * // `abandonTime` value is `300000` (5 minutes).
 * // You can override this value by passing `options` to the FirebaseProvider.
 * 
 * const options = {
 *     abandonTime: 120000 // 2 minutes
 * }
 * 
 *  export function App() {
 * 
 *      return (
 *          <FirebaseProvider 
 *              firebaseApp={firebaseApp}
 *              initialState={initialState}
 *              options={options}
 *          >
 *              { 
 *                  // Add your child components here
 *              }
 *          </FirebaseProvider>
 *      )
 *  }
```  
 * @param props
 */
export function FirebaseProvider(props: FirebaseProviderProps) {
    const {firebaseApp, children, initialState, options} = props;

    const [cache, setCache] = useState<Cache>((initialState || {}) as Cache)
    const [client] = useState<EntityClient>(createEntityClient(firebaseApp, cache, setCache, options));

    const clientValue = updateEntityClient(client, cache);

    return (
        <FirebaseContext.Provider value={clientValue}>
            {children}
        </FirebaseContext.Provider>
    )

}





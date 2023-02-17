

import { FirebaseApp } from 'firebase/app';
import React, { useState } from 'react';
import { EntityClient, createEntityClient, updateEntityClient } from '../../EntityClient';
import { MutableEntityApi } from '../../MutableEntityApi';
import { EntityCache, EntityClientOptions } from '../../types';


export const FirebaseContext = React.createContext<EntityClient | null>(null);

export const entityApi = new MutableEntityApi();

interface FirebaseProviderProps {
    firebaseApp: FirebaseApp;
    children?: React.ReactNode;
    initialState?: Object;
    options?: EntityClientOptions;
}

export function FirebaseProvider(props: FirebaseProviderProps) {
    const {firebaseApp, children, initialState, options} = props;

    const [cache, setCache] = useState<EntityCache>((initialState || {}) as EntityCache)
    const [client] = useState<EntityClient>(createEntityClient(firebaseApp, cache, setCache, options));

    const clientValue = updateEntityClient(client, cache);
    entityApi.setClient(clientValue);

    return (
        <FirebaseContext.Provider value={clientValue}>
            {children}
        </FirebaseContext.Provider>
    )

}





import fakeRestProvider from 'ra-data-fakerest';
import {
    CreateParams,
    DataProvider,
    GetListParams,
    GetOneParams,
    GetManyParams,
    GetManyReferenceParams,
    Identifier,
    DeleteParams,
    RaRecord,
    UpdateParams,
    UpdateManyParams,
    DeleteManyParams,
} from 'ra-core';
import pullAt from 'lodash/pullAt.js';
import localforage from 'localforage';

/**
 * Respond to react-admin data queries using a localForage for storage.
 *
 * Useful for local-first web apps.
 *
 * @example // initialize with no data
 *
 * import localForageDataProvider from 'ra-data-local-forage';
 * const dataProvider = localForageDataProvider();
 *
 * @example // initialize with default data (will be ignored if data has been modified by user)
 *
 * import localForageDataProvider from 'ra-data-local-forage';
 * const dataProvider = localForageDataProvider({
 *   defaultData: {
 *     posts: [
 *       { id: 0, title: 'Hello, world!' },
 *       { id: 1, title: 'FooBar' },
 *     ],
 *     comments: [
 *       { id: 0, post_id: 0, author: 'John Doe', body: 'Sensational!' },
 *       { id: 1, post_id: 0, author: 'Jane Doe', body: 'I agree' },
 *     ],
 *   }
 * });
 */
export default (params?: LocalForageDataProviderParams): DataProvider => {
    const {
        defaultData = {},
        prefixLocalForageKey = 'ra-data-local-forage-',
        loggingEnabled = false,
    } = params || {};

    let data: Record<string, any> | undefined;
    let baseDataProvider: DataProvider | undefined;
    let initializePromise: Promise<void> | undefined;

    const getLocalForageData = async (): Promise<any> => {
        const keys = await localforage.keys();
        const keyFiltered = keys.filter(key => {
            return key.includes(prefixLocalForageKey);
        });

        if (keyFiltered.length === 0) {
            return undefined;
        }
        const localForageData: Record<string, any> = {};

        for (const key of keyFiltered) {
            const keyWithoutPrefix = key.replace(prefixLocalForageKey, '');
            const res = await localforage.getItem(key);
            localForageData[keyWithoutPrefix] = res || [];
        }
        return localForageData;
    };

    const initialize = async () => {
        if (!initializePromise) {
            initializePromise = initializeProvider();
        }
        return initializePromise;
    };

    const initializeProvider = async () => {
        const localForageData = await getLocalForageData();
        data = localForageData ?? defaultData;

        baseDataProvider = fakeRestProvider(
            data,
            loggingEnabled
        ) as DataProvider;
    };

    // Persist in localForage
    const updateLocalForage = (resource: string) => {
        if (!data) {
            throw new Error('The dataProvider is not initialized.');
        }
        localforage.setItem(
            `${prefixLocalForageKey}${resource}`,
            data[resource]
        );
    };

    return {
        // read methods are just proxies to FakeRest
        getList: async <RecordType extends RaRecord = any>(
            resource: string,
            params: GetListParams
        ) => {
            await initialize();
            if (!baseDataProvider) {
                throw new Error('The dataProvider is not initialized.');
            }
            return baseDataProvider
                .getList<RecordType>(resource, params)
                .catch(error => {
                    if (error.code === 1) {
                        // undefined collection error: hide the error and return an empty list instead
                        return { data: [], total: 0 };
                    } else {
                        throw error;
                    }
                });
        },
        getOne: async <RecordType extends RaRecord = any>(
            resource: string,
            params: GetOneParams<any>
        ) => {
            await initialize();
            if (!baseDataProvider) {
                throw new Error('The dataProvider is not initialized.');
            }
            return baseDataProvider.getOne<RecordType>(resource, params);
        },
        getMany: async <RecordType extends RaRecord = any>(
            resource: string,
            params: GetManyParams<RecordType>
        ) => {
            await initialize();
            if (!baseDataProvider) {
                throw new Error('The dataProvider is not initialized.');
            }
            return baseDataProvider.getMany<RecordType>(resource, params);
        },
        getManyReference: async <RecordType extends RaRecord = any>(
            resource: string,
            params: GetManyReferenceParams
        ) => {
            await initialize();
            if (!baseDataProvider) {
                throw new Error('The dataProvider is not initialized.');
            }
            return baseDataProvider
                .getManyReference<RecordType>(resource, params)
                .catch(error => {
                    if (error.code === 1) {
                        // undefined collection error: hide the error and return an empty list instead
                        return { data: [], total: 0 };
                    } else {
                        throw error;
                    }
                });
        },

        // update methods need to persist changes in localForage
        update: async <RecordType extends RaRecord = any>(
            resource: string,
            params: UpdateParams<any>
        ) => {
            checkResource(resource);
            await initialize();
            if (!data) {
                throw new Error('The dataProvider is not initialized.');
            }
            if (!baseDataProvider) {
                throw new Error('The dataProvider is not initialized.');
            }

            assertRecordsExist(getResourceCollection(data, resource), [params.id]);
            const response = await baseDataProvider.update<RecordType>(
                resource,
                params
            );
            const resourceData = getResourceCollection(data, resource);
            const index = resourceData.findIndex(
                (record: { id: any }) => record.id === params.id
            );

            if (index === -1) {
                return response;
            }

            resourceData.splice(index, 1, {
                ...resourceData[index],
                ...params.data,
            });
            updateLocalForage(resource);
            return response;
        },
        updateMany: async (resource: string, params: UpdateManyParams<any>) => {
            checkResource(resource);
            await initialize();
            if (!baseDataProvider) {
                throw new Error('The dataProvider is not initialized.');
            }
            if (!data) {
                throw new Error('The dataProvider is not initialized.');
            }

            const resourceData = getResourceCollection(data, resource);
            assertRecordsExist(resourceData, params.ids);
            const response = await baseDataProvider.updateMany(resource, params);

            params.ids.forEach((id: Identifier) => {
                const index = resourceData.findIndex(
                    (record: { id: Identifier }) => record.id === id
                );

                if (index === -1) {
                    return;
                }

                resourceData.splice(index, 1, {
                    ...resourceData[index],
                    ...params.data,
                });
            });
            updateLocalForage(resource);
            return response;
        },
        create: async <RecordType extends Omit<RaRecord, 'id'> = any>(
            resource: string,
            params: CreateParams<any>
        ) => {
            checkResource(resource);
            await initialize();
            if (!baseDataProvider) {
                throw new Error('The dataProvider is not initialized.');
            }
            // we need to call the fakerest provider first to get the generated id
            return baseDataProvider
                .create<RecordType>(resource, params)
                .then(response => {
                    if (!data) {
                        throw new Error('The dataProvider is not initialized.');
                    }
                    const resourceData = getOrCreateResourceCollection(
                        data,
                        resource
                    );
                    resourceData.push(response.data);
                    updateLocalForage(resource);
                    return response;
                });
        },
        delete: async <RecordType extends RaRecord = any>(
            resource: string,
            params: DeleteParams<RecordType>
        ) => {
            checkResource(resource);
            await initialize();
            if (!baseDataProvider) {
                throw new Error('The dataProvider is not initialized.');
            }
            if (!data) {
                throw new Error('The dataProvider is not initialized.');
            }
            assertRecordsExist(getResourceCollection(data, resource), [params.id]);
            const response = await baseDataProvider.delete<RecordType>(
                resource,
                params
            );
            const resourceData = getResourceCollection(data, resource);
            const index = resourceData.findIndex(
                (record: { id: any }) => record.id === params.id
            );

            if (index === -1) {
                return response;
            }

            pullAt(resourceData, [index]);
            updateLocalForage(resource);
            return response;
        },
        deleteMany: async (resource: string, params: DeleteManyParams<any>) => {
            checkResource(resource);
            await initialize();
            if (!baseDataProvider) {
                throw new Error('The dataProvider is not initialized.');
            }
            if (!data) {
                throw new Error('The dataProvider is not initialized.');
            }
            const resourceData = getResourceCollection(data, resource);
            assertRecordsExist(resourceData, params.ids);
            const response = await baseDataProvider.deleteMany(resource, params);
            const indexes = params.ids
                .map((id: any) => {
                    return resourceData.findIndex(
                        (record: any) => record.id === id
                    );
                })
                .filter(index => index !== -1);

            pullAt(resourceData, indexes);
            updateLocalForage(resource);
            return response;
        },
    };
};

const getResourceCollection = (data: Record<string, any>, resource: string) => {
    if (!Object.prototype.hasOwnProperty.call(data, resource)) {
        throw new Error(`Unknown resource key: ${resource}`);
    }

    return data[resource];
};

const getOrCreateResourceCollection = (
    data: Record<string, any>,
    resource: string
) => {
    if (!Object.prototype.hasOwnProperty.call(data, resource)) {
        data[resource] = [];
    }

    return data[resource];
};

const checkResource = resource => {
    // Reject "__proto__" so dynamic writes like data[resource] = value don't
    // mutate Object.prototype instead of creating a normal resource collection.
    if (resource === '__proto__') {
        throw new Error(`Invalid resource key: ${resource}`);
    }
};

const assertRecordsExist = (resourceData, ids) => {
    ids.forEach(id => {
        if (
            resourceData.findIndex(
                (record: { id: Identifier }) => record.id === id
            ) === -1
        ) {
            throw new Error(`No item with identifier ${id}`);
        }
    });
};

export interface LocalForageDataProviderParams {
    defaultData?: any;
    prefixLocalForageKey?: string;
    loggingEnabled?: boolean;
}

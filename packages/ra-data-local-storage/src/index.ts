/* eslint-disable eqeqeq */
import fakeRestProvider from 'ra-data-fakerest';
import { DataProvider, RaRecord } from 'ra-core';
import pullAt from 'lodash/pullAt.js';

/**
 * Respond to react-admin data queries using a local database persisted in localStorage
 *
 * Useful for local-first web apps. The storage is shared between tabs.
 *
 * @example // initialize with no data
 *
 * import localStorageDataProvider from 'ra-data-local-storage';
 * const dataProvider = localStorageDataProvider();
 *
 * @example // initialize with default data (will be ignored if data has been modified by user)
 *
 * import localStorageDataProvider from 'ra-data-local-storage';
 * const dataProvider = localStorageDataProvider({
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
export default (params?: LocalStorageDataProviderParams): DataProvider => {
    const {
        defaultData = {},
        localStorageKey = 'ra-data-local-storage',
        loggingEnabled = false,
        localStorageUpdateDelay = 10, // milliseconds
    } = params || {};
    const localStorageData = localStorage.getItem(localStorageKey);
    let data = localStorageData ? JSON.parse(localStorageData) : defaultData;

    // change data by executing callback, then persist in localStorage
    const updateLocalStorage = callback => {
        // modify localStorage after the next tick
        setTimeout(() => {
            callback();
            localStorage.setItem(localStorageKey, JSON.stringify(data));
        }, localStorageUpdateDelay);
    };

    let baseDataProvider = fakeRestProvider(
        data,
        loggingEnabled
    ) as DataProvider;

    window?.addEventListener('storage', event => {
        if (event.key === localStorageKey) {
            const newData = event.newValue ? JSON.parse(event.newValue) : {};
            data = newData;
            baseDataProvider = fakeRestProvider(
                newData,
                loggingEnabled
            ) as DataProvider;
        }
    });

    return {
        // read methods are just proxies to FakeRest
        getList: <RecordType extends RaRecord = any>(resource, params) =>
            baseDataProvider
                .getList<RecordType>(resource, params)
                .catch(error => {
                    if (error.code === 1) {
                        // undefined collection error: hide the error and return an empty list instead
                        return { data: [], total: 0 };
                    } else {
                        throw error;
                    }
                }),
        getOne: <RecordType extends RaRecord = any>(resource, params) =>
            baseDataProvider.getOne<RecordType>(resource, params),
        getMany: <RecordType extends RaRecord = any>(resource, params) =>
            baseDataProvider.getMany<RecordType>(resource, params),
        getManyReference: <RecordType extends RaRecord = any>(
            resource,
            params
        ) =>
            baseDataProvider
                .getManyReference<RecordType>(resource, params)
                .catch(error => {
                    if (error.code === 1) {
                        // undefined collection error: hide the error and return an empty list instead
                        return { data: [], total: 0 };
                    } else {
                        throw error;
                    }
                }),

        // update methods need to persist changes in localStorage
        update: <RecordType extends RaRecord = any>(resource, params) => {
            checkResource(resource);
            try {
                assertRecordsExist(getResourceCollection(data, resource), [
                    params.id,
                ]);
            } catch (error) {
                return Promise.reject(error);
            }
            return baseDataProvider
                .update<RecordType>(resource, params)
                .then(response => {
                    updateLocalStorage(() => {
                        const resourceData = getResourceCollection(
                            data,
                            resource
                        );
                        const index = resourceData.findIndex(
                            record => record.id == params.id
                        );

                        if (index === -1) {
                            return;
                        }

                        resourceData.splice(index, 1, {
                            ...resourceData[index],
                            ...params.data,
                        });
                    });

                    return response;
                });
        },
        updateMany: (resource, params) => {
            checkResource(resource);
            try {
                assertRecordsExist(
                    getResourceCollection(data, resource),
                    params.ids
                );
            } catch (error) {
                return Promise.reject(error);
            }

            return baseDataProvider
                .updateMany(resource, params)
                .then(response => {
                    updateLocalStorage(() => {
                        const resourceData = getResourceCollection(
                            data,
                            resource
                        );
                        params.ids.forEach(id => {
                            const index = resourceData.findIndex(
                                record => record.id == id
                            );

                            if (index === -1) {
                                return;
                            }

                            resourceData.splice(index, 1, {
                                ...resourceData[index],
                                ...params.data,
                            });
                        });
                    });

                    return response;
                });
        },
        create: <RecordType extends Omit<RaRecord, 'id'> = any>(
            resource,
            params
        ) => {
            checkResource(resource);
            // we need to call the fakerest provider first to get the generated id
            return baseDataProvider
                .create<RecordType>(resource, params)
                .then(response => {
                    updateLocalStorage(() => {
                        const resourceData = getOrCreateResourceCollection(
                            data,
                            resource
                        );
                        resourceData.push(response.data);
                    });
                    return response;
                });
        },
        delete: <RecordType extends RaRecord = any>(resource, params) => {
            checkResource(resource);
            try {
                assertRecordsExist(getResourceCollection(data, resource), [
                    params.id,
                ]);
            } catch (error) {
                return Promise.reject(error);
            }
            return baseDataProvider
                .delete<RecordType>(resource, params)
                .then(response => {
                    updateLocalStorage(() => {
                        const resourceData = getResourceCollection(
                            data,
                            resource
                        );
                        const index = resourceData.findIndex(
                            record => record.id == params.id
                        );

                        if (index === -1) {
                            return;
                        }

                        pullAt(resourceData, [index]);
                    });

                    return response;
                });
        },
        deleteMany: (resource, params) => {
            checkResource(resource);
            try {
                assertRecordsExist(
                    getResourceCollection(data, resource),
                    params.ids
                );
            } catch (error) {
                return Promise.reject(error);
            }

            return baseDataProvider
                .deleteMany(resource, params)
                .then(response => {
                    updateLocalStorage(() => {
                        const resourceData = getResourceCollection(
                            data,
                            resource
                        );
                        const indexes = params.ids
                            .map(id =>
                                resourceData.findIndex(
                                    record => record.id == id
                                )
                            )
                            .filter(index => index !== -1);

                        pullAt(resourceData, indexes);
                    });

                    return response;
                });
        },
    };
};

const getResourceCollection = (data, resource) => {
    if (!Object.prototype.hasOwnProperty.call(data, resource)) {
        throw new Error(`Unknown resource key: ${resource}`);
    }

    return data[resource];
};

const getOrCreateResourceCollection = (data, resource) => {
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
        if (resourceData.findIndex(record => record.id == id) === -1) {
            throw new Error(`No item with identifier ${id}`);
        }
    });
};

export interface LocalStorageDataProviderParams {
    defaultData?: any;
    localStorageKey?: string;
    loggingEnabled?: boolean;
    localStorageUpdateDelay?: number;
}

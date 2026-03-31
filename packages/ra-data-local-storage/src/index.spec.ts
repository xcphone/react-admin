import expect from 'expect';

import localStorageDataProvider from './index';

describe('ra-data-local-storage', () => {
    const posts = [
        { id: 1, title: 'Hello world' },
        { id: 2, title: 'Second post' },
    ];

    beforeEach(() => {
        localStorage.clear();
    });

    it('creates missing resource collections safely', async () => {
        const dataProvider = localStorageDataProvider({
            localStorageKey: 'ra-data-local-storage-test',
            localStorageUpdateDelay: 0,
        });

        const response = await dataProvider.create('posts', {
            data: { title: 'Hello world' },
        } as any);

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(response.data.title).toEqual('Hello world');
        expect(
            JSON.parse(
                localStorage.getItem('ra-data-local-storage-test') || '{}'
            )
        ).toMatchObject({
            posts: [expect.objectContaining({ title: 'Hello world' })],
        });
    });

    it('rejects unsafe resource keys', () => {
        const dataProvider = localStorageDataProvider();

        expect(() =>
            dataProvider.update('__proto__', {
                id: 1,
                data: { title: 'bad' },
                previousData: { id: 1 },
            } as any)
        ).toThrow('Invalid resource key: __proto__');
    });

    it('supports resource keys inherited from Object.prototype', async () => {
        const dataProvider = localStorageDataProvider({
            localStorageKey: 'ra-data-local-storage-test',
            localStorageUpdateDelay: 0,
        });

        const response = await dataProvider.create('constructor', {
            data: { title: 'Hello world' },
        } as any);

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(response.data.title).toEqual('Hello world');
        expect(
            JSON.parse(
                localStorage.getItem('ra-data-local-storage-test') || '{}'
            )
        ).toMatchObject({
            constructor: [expect.objectContaining({ title: 'Hello world' })],
        });
    });

    it('does not corrupt local data when update targets an unknown id', async () => {
        localStorage.setItem(
            'ra-data-local-storage-test',
            JSON.stringify({ posts })
        );
        const dataProvider = localStorageDataProvider({
            localStorageKey: 'ra-data-local-storage-test',
            localStorageUpdateDelay: 0,
        });

        await expect(
            dataProvider.update('posts', {
                id: 3,
                data: { title: 'Updated' },
                previousData: { id: 3 },
            } as any)
        ).rejects.toThrow('No item with identifier 3');
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(
            JSON.parse(
                localStorage.getItem('ra-data-local-storage-test') || '{}'
            )
        ).toEqual({ posts });
    });

    it('does not partially update local data when updateMany includes an unknown id', async () => {
        localStorage.setItem(
            'ra-data-local-storage-test',
            JSON.stringify({ posts })
        );
        const dataProvider = localStorageDataProvider({
            localStorageKey: 'ra-data-local-storage-test',
            localStorageUpdateDelay: 0,
        });

        await expect(
            dataProvider.updateMany('posts', {
                ids: [1, 3],
                data: { title: 'Updated' },
            } as any)
        ).rejects.toThrow('No item with identifier 3');
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(
            JSON.parse(
                localStorage.getItem('ra-data-local-storage-test') || '{}'
            )
        ).toEqual({ posts });
    });

    it('does not corrupt local data when delete targets an unknown id', async () => {
        localStorage.setItem(
            'ra-data-local-storage-test',
            JSON.stringify({ posts })
        );
        const dataProvider = localStorageDataProvider({
            localStorageKey: 'ra-data-local-storage-test',
            localStorageUpdateDelay: 0,
        });

        await expect(
            dataProvider.delete('posts', {
                id: 3,
                previousData: { id: 3 },
            } as any)
        ).rejects.toThrow('No item with identifier 3');
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(
            JSON.parse(
                localStorage.getItem('ra-data-local-storage-test') || '{}'
            )
        ).toEqual({ posts });
    });

    it('does not partially delete local data when deleteMany includes an unknown id', async () => {
        localStorage.setItem(
            'ra-data-local-storage-test',
            JSON.stringify({ posts })
        );
        const dataProvider = localStorageDataProvider({
            localStorageKey: 'ra-data-local-storage-test',
            localStorageUpdateDelay: 0,
        });

        await expect(
            dataProvider.deleteMany('posts', {
                ids: [1, 3],
            } as any)
        ).rejects.toThrow('No item with identifier 3');
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(
            JSON.parse(
                localStorage.getItem('ra-data-local-storage-test') || '{}'
            )
        ).toEqual({ posts });
    });
});

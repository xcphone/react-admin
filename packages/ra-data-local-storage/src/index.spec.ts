import expect from 'expect';

import localStorageDataProvider from './index';

describe('ra-data-local-storage', () => {
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
});

import expect from 'expect';
import localforage from 'localforage';

import localForageDataProvider from './index';

jest.mock('localforage', () => ({
    __esModule: true,
    default: {
        keys: jest.fn(),
        getItem: jest.fn(),
        setItem: jest.fn(),
    },
}));

describe('ra-data-local-forage', () => {
    const posts = [
        { id: 1, title: 'Hello world' },
        { id: 2, title: 'Second post' },
    ];

    beforeEach(() => {
        jest.resetAllMocks();
        (localforage.keys as jest.Mock).mockResolvedValue([]);
        (localforage.getItem as jest.Mock).mockResolvedValue(undefined);
        (localforage.setItem as jest.Mock).mockResolvedValue(undefined);
    });

    it('creates missing resource collections safely', async () => {
        const dataProvider = localForageDataProvider();

        const response = await dataProvider.create('posts', {
            data: { title: 'Hello world' },
        } as any);

        expect(response.data.title).toEqual('Hello world');
        expect(localforage.setItem).toHaveBeenCalledWith(
            'ra-data-local-forage-posts',
            [expect.objectContaining({ title: 'Hello world' })]
        );
    });

    it('rejects unsafe resource keys', async () => {
        const dataProvider = localForageDataProvider();

        await expect(
            dataProvider.update('__proto__', {
                id: 1,
                data: { title: 'bad' },
                previousData: { id: 1 },
            } as any)
        ).rejects.toThrow('Invalid resource key: __proto__');
    });

    it('does not corrupt local data when update targets an unknown id', async () => {
        (localforage.keys as jest.Mock).mockResolvedValue([
            'ra-data-local-forage-posts',
        ]);
        (localforage.getItem as jest.Mock).mockResolvedValue([...posts]);
        const dataProvider = localForageDataProvider();

        await expect(
            dataProvider.update('posts', {
                id: 3,
                data: { title: 'Updated' },
                previousData: { id: 3 },
            } as any)
        ).rejects.toThrow('No item with identifier 3');

        expect(localforage.setItem).not.toHaveBeenCalled();
    });

    it('does not partially update local data when updateMany includes an unknown id', async () => {
        (localforage.keys as jest.Mock).mockResolvedValue([
            'ra-data-local-forage-posts',
        ]);
        (localforage.getItem as jest.Mock).mockResolvedValue([...posts]);
        const dataProvider = localForageDataProvider();

        await expect(
            dataProvider.updateMany('posts', {
                ids: [1, 3],
                data: { title: 'Updated' },
            } as any)
        ).rejects.toThrow('No item with identifier 3');

        expect(localforage.setItem).not.toHaveBeenCalled();
    });

    it('does not corrupt local data when delete targets an unknown id', async () => {
        (localforage.keys as jest.Mock).mockResolvedValue([
            'ra-data-local-forage-posts',
        ]);
        (localforage.getItem as jest.Mock).mockResolvedValue([...posts]);
        const dataProvider = localForageDataProvider();

        await expect(
            dataProvider.delete('posts', {
                id: 3,
                previousData: { id: 3 },
            } as any)
        ).rejects.toThrow('No item with identifier 3');

        expect(localforage.setItem).not.toHaveBeenCalled();
    });

    it('does not partially delete local data when deleteMany includes an unknown id', async () => {
        (localforage.keys as jest.Mock).mockResolvedValue([
            'ra-data-local-forage-posts',
        ]);
        (localforage.getItem as jest.Mock).mockResolvedValue([...posts]);
        const dataProvider = localForageDataProvider();

        await expect(
            dataProvider.deleteMany('posts', {
                ids: [1, 3],
            } as any)
        ).rejects.toThrow('No item with identifier 3');

        expect(localforage.setItem).not.toHaveBeenCalled();
    });
});
